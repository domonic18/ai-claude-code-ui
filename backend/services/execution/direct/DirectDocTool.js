/**
 * DirectDocTool.js
 *
 * 直连模式唯一文件写入工具（write_generated_doc）：把模型产出的 Markdown
 * 写入当前项目工作区的 generated_docs/ 目录（与 extensions/文档面板交付约定对齐，
 * DocumentService._scanGeneratedDir 自动发现该目录下的文件）。
 *
 * 安全边界：目标目录由后端拼死（/workspace/{projectName}/generated_docs），
 * 模型只能提供文件名与内容；文件名净化（剥路径/拒穿越/强制 .md/长度上限）后
 * 越界写入在结构上不可能。同名文件不覆盖，自动加 -1/-2 序号。
 *
 * 纯函数（sanitizeFileName / resolveUniqueFileName）可独立单测；
 * writeGeneratedDoc 是唯一 IO 入口（listDir/writeFile 可注入，测试用）。
 *
 * @module services/execution/direct/DirectDocTool
 */

import containerManager from '../../container/core/index.js';
import { writeFileViaPutArchive } from '../../container/utils/containerFileWriter.js';
import { execAndCollectOutput } from '../../sessions/container/containerFileReader.js';
import { GENERATED_DIR_NAME } from '../../../config/containerConfig.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/execution/direct/DirectDocTool');

/** 文档 content 上限（字符）：2MB，超出拒写（防单轮 tool_use 撑爆容器写入与内存） */
export const MAX_DOC_CONTENT_CHARS = 2 * 1024 * 1024;

/** 文件名主干（不含 .md）长度上限 */
export const MAX_FILE_NAME_STEM_LENGTH = 80;

/** 同名序号兜底上限（超过用时间戳，理论上不可达） */
const MAX_SUFFIX_ATTEMPTS = 999;

/**
 * write_generated_doc 工具定义（Anthropic tools 数组元素，直连请求体唯一工具）
 */
export const WRITE_GENERATED_DOC_TOOL = {
  name: 'write_generated_doc',
  description: '将 Markdown 文档写入当前项目工作区的 generated_docs/ 目录。仅当用户明确要求生成/导出/保存文档文件时调用；普通回答直接输出文本，禁止调用。同名文件不会覆盖（自动加序号），请一次性给出完整内容。',
  input_schema: {
    type: 'object',
    properties: {
      file_name: {
        type: 'string',
        description: '文件名（仅文件名，不含任何路径），以 .md 结尾，例如 "技术交底书.md"',
      },
      content: {
        type: 'string',
        description: '完整的 Markdown 文档内容',
      },
    },
    required: ['file_name', 'content'],
  },
};

/** 直连请求体携带的 tools 数组（单一收口工具，不开放扩展点） */
export const DIRECT_DOC_TOOLS = [WRITE_GENERATED_DOC_TOOL];

/**
 * 净化模型给出的文件名：剥路径分隔符、剔控制字符、强制 .md 后缀、截断超长主干
 *
 * @param {string} fileName - 模型 tool_use 的 file_name 入参
 * @returns {{ok: true, fileName: string}|{ok: false, error: string}}
 */
export function sanitizeFileName(fileName) {
  if (typeof fileName !== 'string') {
    return { ok: false, error: 'file_name 必须为字符串' };
  }
  // 剥路径分隔符：仅保留最后一段（模型给出 a/b.md、..\x.md 等一律取末段）
  const segments = fileName.split(/[/\\]/).filter(s => s.length > 0);
  const last = segments.length > 0 ? segments[segments.length - 1] : '';
  const cleaned = last.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return { ok: false, error: 'file_name 不能为空，且必须是纯文件名（不含路径）' };
  }
  let stem = cleaned.replace(/\.md$/i, '');
  if (stem.length > MAX_FILE_NAME_STEM_LENGTH) stem = stem.slice(0, MAX_FILE_NAME_STEM_LENGTH);
  if (!stem) {
    return { ok: false, error: 'file_name 缺少有效名称部分' };
  }
  return { ok: true, fileName: `${stem}.md` };
}

/**
 * 同名冲突解析：fileName 已存在时依次尝试 主干-1.md、主干-2.md …
 *
 * @param {Set<string>|Array<string>} existingNames - 目录内既有文件名
 * @param {string} fileName - 净化后的目标文件名（保证 .md 结尾）
 * @returns {string} 不冲突的文件名
 */
export function resolveUniqueFileName(existingNames, fileName) {
  const existing = existingNames instanceof Set ? existingNames : new Set(existingNames || []);
  if (!existing.has(fileName)) return fileName;
  const stem = fileName.slice(0, -'.md'.length);
  for (let i = 1; i <= MAX_SUFFIX_ATTEMPTS; i++) {
    const candidate = `${stem}-${i}.md`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${stem}-${Date.now()}.md`;
}

/**
 * 项目名校验（写入路径锚点，防 / \ .. 穿越容器目录）
 * @param {string} projectName
 * @returns {boolean}
 */
function isValidProjectName(projectName) {
  return typeof projectName === 'string'
    && projectName.length > 0
    && !projectName.includes('/')
    && !projectName.includes('\\')
    && !projectName.includes('..');
}

/**
 * 列出容器内 generated_docs 目录的文件名（默认实现，可注入替换）
 *
 * 目录不存在（首份文档）时 ls 非零退出但 stdout 为空 → 返回 []；
 * 其余异常同样降级为 []（唯一代价是可能少加一次序号，写入路径仍受净化保护）。
 *
 * @param {number} userId - 用户 ID
 * @param {string} docsDir - 容器内 generated_docs 绝对路径
 * @returns {Promise<string[]>} 文件名数组
 */
async function listGeneratedDocs(userId, docsDir) {
  const output = await execAndCollectOutput(userId, ['ls', '-1', docsDir]);
  return output.split('\n').map(s => s.trim()).filter(Boolean);
}

/**
 * 容器写入默认实现：putArchive 通道（自带目标目录 mkdir -p，无 exec 参数长度限制）
 *
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 容器内目标文件绝对路径
 * @param {string} content - 文件内容
 * @returns {Promise<void>}
 */
async function writeDocViaPutArchive(userId, filePath, content) {
  const container = await containerManager.getOrCreateContainer(userId);
  const dockerContainer = containerManager.docker.getContainer(container.id);
  await writeFileViaPutArchive(dockerContainer, filePath, content, { logLabel: 'DirectDocTool' });
}

/**
 * 执行 write_generated_doc：净化 → 校验 → 同名序号 → 容器写入
 *
 * 返回值直接 JSON.stringify 后作为 tool_result 回填给模型，ok/error 字段
 * 即模型可读的执行反馈（校验失败模型可在下一跳自行纠正重试）。
 *
 * @param {number} userId - 用户 ID
 * @param {string} projectName - 项目名（generated_docs 的父目录锚点）
 * @param {Object} input - 模型 tool_use 的 input（file_name/content）
 * @param {Object} [deps] - 依赖注入（测试用）
 * @param {(userId: number, docsDir: string) => Promise<string[]>} [deps.listDir]
 * @param {(userId: number, filePath: string, content: string) => Promise<void>} [deps.writeFile]
 * @returns {Promise<{ok: true, file_name: string, path: string, chars: number}|{ok: false, error: string}>}
 */
export async function writeGeneratedDoc(userId, projectName, input, deps = {}) {
  const { listDir = listGeneratedDocs, writeFile = writeDocViaPutArchive } = deps;

  if (!isValidProjectName(projectName)) {
    return { ok: false, error: '非法项目名，写入被拒绝' };
  }

  const nameCheck = sanitizeFileName(input?.file_name);
  if (!nameCheck.ok) return { ok: false, error: nameCheck.error };

  const content = input?.content;
  if (typeof content !== 'string' || content.length === 0) {
    return { ok: false, error: 'content 必须为非空字符串' };
  }
  if (content.length > MAX_DOC_CONTENT_CHARS) {
    return { ok: false, error: `content 超过上限 ${MAX_DOC_CONTENT_CHARS} 字符，请精简后重试` };
  }

  const docsDir = `/workspace/${projectName}/${GENERATED_DIR_NAME}`;
  let existing = [];
  try {
    existing = await listDir(userId, docsDir);
  } catch (err) {
    // 目录不存在属正常路径（首份文档）；其余读取异常降级为空列表
    logger.debug({ err, docsDir }, '[DirectDocTool] 列目录失败，按空目录处理');
  }
  const fileName = resolveUniqueFileName(existing, nameCheck.fileName);

  const filePath = `${docsDir}/${fileName}`;
  await writeFile(userId, filePath, content);

  logger.info({ userId, projectName, fileName, chars: content.length }, '[DirectDocTool] 文档已写入');
  return { ok: true, file_name: fileName, path: filePath, chars: content.length };
}
