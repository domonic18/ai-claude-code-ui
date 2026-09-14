/**
 * DirectAttachmentInjector.js
 *
 * 直连模式附件注入器：把上传附件转换为 /v1/messages 请求的 content。
 * - 图片（base64 data URL / 容器路径）→ Anthropic image block
 * - word/pdf 等文档 → 用户容器内解析文本（DocumentTextExtractor）后注入文本前缀
 *
 * 纯函数（buildImageBlock / escapeFileName / buildDocumentSection）可单测；
 * buildDirectUserContent 是唯一 IO 入口。
 *
 * @module services/execution/direct/DirectAttachmentInjector
 */

import { PassThrough } from 'stream';
import containerManager from '../../container/core/index.js';
import { DocumentTextExtractor } from '../../documents/DocumentTextExtractor.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/execution/direct/DirectAttachmentInjector');

/** 单个文档注入的最大字符数（直连需喂全文，远大于摘要场景的 4000） */
export const DIRECT_DOC_MAX_CHARS = 100_000;

/** 多文档注入的总字符上限（超出从末尾截断并明确告知） */
export const DIRECT_DOCS_TOTAL_MAX_CHARS = 200_000;

/** 图片扩展名 → MIME 映射（dataURL 缺 MIME 时的兜底） */
const IMAGE_MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const IMAGE_EXTENSIONS = new Set(Object.keys(IMAGE_MIME_MAP));

const isImagePath = (filePath) =>
  IMAGE_EXTENSIONS.has('.' + (String(filePath).split('.').pop() || '').toLowerCase());

/**
 * 允许的附件子目录（相对 /workspace/{projectName}/）：
 * - documents/uploads/：聊天附件统一上传端点（DocumentService，与文档面板同源）
 * - uploads/：fileUploadHandler 的图片容器上传通道（历史路径）
 */
const ALLOWED_ATTACHMENT_SUBDIRS = ['documents/uploads/', 'uploads/'];

/**
 * 附件容器路径白名单校验
 *
 * file.path 来自前端消息，不可信任——越界路径（如 .claude/projects 下的会话
 * jsonl、配置/密钥文件）被读出后注入 prompt 会经第三方模型端点外泄。
 * 仅放行当前项目上传目录内的路径，同时防御 .. 穿越。
 *
 * @param {string} filePath - 容器内绝对路径
 * @param {string} projectName - 当前项目名
 * @returns {boolean} 路径在允许的上传目录内返回 true
 */
export function isAllowedAttachmentPath(filePath, projectName) {
  if (typeof filePath !== 'string' || typeof projectName !== 'string' || !projectName) return false;
  if (projectName.includes('/') || projectName.includes('\\') || projectName.includes('..')) return false;
  const base = `/workspace/${projectName}/`;
  if (!filePath.startsWith(base)) return false;
  if (filePath.split('/').includes('..')) return false;
  return ALLOWED_ATTACHMENT_SUBDIRS.some((sub) => filePath.startsWith(base + sub));
}

/**
 * 构造 Anthropic image block
 * @param {string} dataUrl - data:image/png;base64,xxx 格式
 * @returns {Object|null} image block；解析失败返回 null
 */
export function buildImageBlock(dataUrl) {
  const match = /^data:(image\/[\w.+-]+);base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!match) return null;
  return {
    type: 'image',
    source: { type: 'base64', media_type: match[1], data: match[2] },
  };
}

/**
 * 文件名转义：文件名是用户输入，拼入 prompt 前去除换行/反引号/路径分隔符（防 prompt 注入）
 * @param {string} name - 原始文件名
 * @returns {string} 转义后文件名
 */
export function escapeFileName(name) {
  return String(name || '').replace(/[\r\n`<>/\\]/g, ' ').trim() || 'unnamed';
}

/**
 * 构造文档注入文本段
 * @param {string} fileName - 文件名（将转义）
 * @param {string} extractedText - 提取的文本
 * @returns {string} 格式化文本段
 */
export function buildDocumentSection(fileName, extractedText) {
  return `=== 文件: ${escapeFileName(fileName)} ===\n${extractedText}\n=== 文件结束 ===`;
}

/**
 * 从容器读取图片文件并转 base64 data URL
 *
 * 复刻 chat.js readImageFromContainer 逻辑（不从 websocket handler 导入，
 * 避免 service 层反向依赖 handler 层）。
 *
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 容器内绝对路径
 * @returns {Promise<string>} data URL
 * @private
 */
async function readImageFromContainer(userId, filePath) {
  const ext = '.' + (String(filePath).split('.').pop() || '').toLowerCase();
  const mimeType = IMAGE_MIME_MAP[ext] || 'image/octet-stream';

  const { stream } = await containerManager.execInContainer(userId, ['base64', filePath]);
  const output = await new Promise((resolve, reject) => {
    const stdout = new PassThrough();
    containerManager.docker.modem.demuxStream(stream, stdout, new PassThrough());
    let data = '';
    stdout.on('data', (chunk) => { data += chunk.toString(); });
    stream.on('error', reject);
    stream.on('end', () => resolve(data));
  });

  const base64Data = output.replace(/\s/g, '');
  return `data:${mimeType};base64,${base64Data}`;
}

/**
 * 构造直连模式的用户 content
 *
 * - 无附件 → 纯字符串（历史渲染兼容性最好）
 * - 有附件 → blocks 数组：image 块在前（Anthropic 惯例），末尾一个 text 块（文档前缀 + 用户命令）
 * - 文档总长超限 → 截断并追加明确告知标记（禁止静默截断）
 *
 * @param {number} userId - 用户 ID
 * @param {Array<{name: string, data?: string, path?: string}>} attachments - 前端附件数组
 * @param {string} command - 用户原始命令
 * @param {Object} [options]
 * @param {string} [options.projectName] - 当前项目名（path 附件白名单锚点；缺失时 fail-closed 全部拒读）
 * @param {number} [options.maxDocChars] - 单文档上限
 * @param {Object} [options.extractor] - 文本提取器（依赖注入，测试用）
 * @returns {Promise<string|Array>} content 字符串或 blocks 数组
 */
export async function buildDirectUserContent(userId, attachments, command, options = {}) {
  const { maxDocChars = DIRECT_DOC_MAX_CHARS, extractor, projectName } = options;
  const files = Array.isArray(attachments) ? attachments.filter(f => f && (f.data || f.path)) : [];
  if (files.length === 0) return command;

  const imageBlocks = [];
  const docSections = [];
  let totalDocChars = 0;
  let truncatedTotal = false;

  for (const file of files) {
    // 路径白名单：越界路径拒读降级占位（data 附件不涉及容器读取，不受限）
    if (file.path && !isAllowedAttachmentPath(file.path, projectName)) {
      logger.warn({ filePath: file.path, projectName }, '[DirectAttachmentInjector] 附件路径不在允许上传目录内，拒读');
      docSections.push(`[附件路径不在允许上传目录，已跳过: ${escapeFileName(file.name)}]`);
      continue;
    }

    // 图片：data 直转；仅 path 时从容器读回再转
    if (file.data || isImagePath(file.path)) {
      let dataUrl = file.data;
      if (!dataUrl && file.path) {
        try {
          dataUrl = await readImageFromContainer(userId, file.path);
        } catch (err) {
          logger.warn({ err, filePath: file.path }, '[DirectAttachmentInjector] 容器图片读取失败，降级为占位');
        }
      }
      const block = dataUrl ? buildImageBlock(dataUrl) : null;
      if (block) imageBlocks.push(block);
      else docSections.push(`[图片读取失败: ${escapeFileName(file.name)}]`);
      continue;
    }

    // 文档：用户容器内解析文本
    const textExtractor = extractor || new DocumentTextExtractor();
    const extracted = await textExtractor.extractText(userId, file.path, file.name, { maxChars: maxDocChars });
    const section = buildDocumentSection(file.name, extracted);

    if (totalDocChars + section.length > DIRECT_DOCS_TOTAL_MAX_CHARS) {
      const remaining = Math.max(0, DIRECT_DOCS_TOTAL_MAX_CHARS - totalDocChars);
      docSections.push(section.slice(0, remaining));
      totalDocChars = DIRECT_DOCS_TOTAL_MAX_CHARS;
      truncatedTotal = true;
      break; // 总额已满，后续文档不再注入
    }
    docSections.push(section);
    totalDocChars += section.length;
  }

  const prefixParts = [];
  if (docSections.length > 0) {
    prefixParts.push('[以下是用户引用的文件内容]', ...docSections);
    if (truncatedTotal) prefixParts.push('[文件内容总长超限，已截断]');
    prefixParts.push('', '');
  }

  const text = prefixParts.length > 0 ? `${prefixParts.join('\n')}${command}` : command;
  if (imageBlocks.length === 0) return text;
  return [...imageBlocks, { type: 'text', text }];
}
