/**
 * ProjectOverviewService.js
 *
 * 案件概览服务（用户手动触发，AI 生成摘要）
 *
 * 用户在 chat 页点「生成摘要」→ generateOverview：
 *   1. 读会话 JSONL 拿 transcript
 *   2. 调 provider Messages API（getSummaryModel + 提示词）生成摘要
 *   3. 写 project-overview/<sessionId>.md
 * 面板读缓存展示（listOverviews/readOverview）。删对话级联删缓存（deleteOverview）。
 *
 * 设计要点：
 * - 手动触发（用户点按钮），非自动
 * - 调模型生成（提示词控制内容/语言），复用 SummaryService 的 Messages 调用范式
 * - 异步、不阻塞 chat（generate 走后端独立调模型，不走 ClaudeQuery 管道）
 * - 安全：所有入口校验 projectName（防路径穿越）+ sessionId（uuid 白名单）
 *
 * @module services/projects/ProjectOverviewService
 */

import { PassThrough } from 'stream';
import { readFileInContainer, writeFileInContainer, deleteFileInContainer } from '../files/utils/index.js';
import { encodeProjectName } from '../sessions/container/containerPathEncoder.js';
import containerManager from '../container/core/index.js';
import { CONTAINER } from '../../config/config.js';
import { createLogger } from '../../utils/logger.js';
import { ValidationError } from '../../middleware/error-handler.middleware.js';
import { getSummaryModel, getModelProviderConfig } from '../../config/modelConfig.js';
import { PathValidator } from '../core/utils/path-utils.js';

const logger = createLogger('services/projects/ProjectOverviewService');

const OVERVIEW_DIR_NAME = 'project-overview';
const SUMMARY_MAX_TOKENS = 2000;
const SUMMARY_TIMEOUT_MS = 60_000;
/** transcript 截断上限（防超 token，长会话保护） */
const MAX_TRANSCRIPT_CHARS = 8000;

/**
 * 摘要提示词（占位，后续替换为正式版）
 * 占位约 80 字，用户发正式提示词后替换 SUMMARY_PROMPT。
 */
const SUMMARY_PROMPT = `请总结本会话的关键专利内容和要求，包括：用户的核心诉求、已完成的工作、关键决策、未完成事项。语言简洁，中文输出，500 字以内。`;

/** sessionId 合法性（uuid） */
const SESSION_ID_RE = /^[a-f0-9-]+$/i;

/**
 * 案件概览服务
 */
export class ProjectOverviewService {
  /**
   * 校验案件名合法性（防路径穿越，仿 ProjectPromptService）
   * @param {string} projectName
   * @throws {ValidationError} 案件名非法
   * @private
   */
  _assertProjectName(projectName) {
    const { valid, error } = PathValidator.validateProjectName(projectName);
    if (!valid) {
      throw new ValidationError(error || 'Invalid project name');
    }
  }

  /**
   * 手动生成/刷新某会话的摘要
   * @param {number} userId
   * @param {string} projectName
   * @param {string} sessionId
   * @returns {Promise<{success: boolean, sessionId: string}>}
   * @throws {ValidationError} sessionId/projectName 非法
   * @throws {Error} 无 transcript / 模型生成失败
   */
  async generateOverview(userId, projectName, sessionId) {
    this._assertProjectName(projectName);
    if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
      throw new ValidationError('Invalid sessionId');
    }

    // 1. 读会话 transcript
    const transcript = await this._readSessionTranscript(userId, projectName, sessionId);
    if (!transcript) {
      throw new Error('No transcript available for this session');
    }

    // 2. 调模型生成摘要
    const summary = await this._callSummaryModel(transcript);
    if (!summary) {
      throw new Error('Summary generation failed');
    }

    // 3. 写缓存文件（失败明确报错：summary 已生成但缓存写入失败，避免裸抛 IO 错误让用户困惑）
    const cachePath = `${CONTAINER.paths.workspace}/${projectName}/${OVERVIEW_DIR_NAME}/${sessionId}.md`;
    try {
      await writeFileInContainer(userId, cachePath, formatCache(sessionId, projectName, summary), {});
    } catch (writeErr) {
      logger.error({ err: writeErr, sessionId, projectName }, '[Overview] summary generated but cache write failed');
      throw new Error('摘要已生成，但缓存写入失败，请重试');
    }
    logger.info({ sessionId, projectName, summaryLen: summary.length }, '[Overview] generated');
    return { success: true, sessionId };
  }

  /**
   * 读会话 JSONL，拼成 transcript 文本
   * @private
   */
  async _readSessionTranscript(userId, projectName, sessionId) {
    const jsonlPath = `${CONTAINER.paths.projects}/${encodeProjectName(projectName)}/${sessionId}.jsonl`;
    let jsonlText;
    try {
      const result = await readFileInContainer(userId, jsonlPath, {});
      jsonlText = result?.content || '';
    } catch (err) {
      if (/not found|no such file|ENOENT/i.test(err.message)) return '';
      throw err;
    }
    return extractTranscript(jsonlText);
  }

  /**
   * 调 provider Messages API 生成摘要（仿 SummaryService._callAnthropicMessagesAPI）
   * @param {string} transcript
   * @returns {Promise<string|null>} 摘要文本，失败返回 null
   * @private
   */
  async _callSummaryModel(transcript) {
    const model = getSummaryModel();
    const config = getModelProviderConfig(model.name);
    if (!config.baseURL || !config.authToken) {
      logger.error({ model: model.name }, '[Overview] 模型缺少 API 配置');
      return null;
    }

    // 截断 transcript 防超 token（长会话保护）
    const trimmedTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
      ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n...(内容过长，已截断)'
      : transcript;

    const baseURL = config.baseURL.replace(/\/+$/, '');
    const url = `${baseURL}/v1/messages`;
    const body = {
      model: model.name,
      max_tokens: SUMMARY_MAX_TOKENS,
      messages: [{
        role: 'user',
        content: `${SUMMARY_PROMPT}\n\n=== 会话内容 ===\n${trimmedTranscript}`,
      }],
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.authToken}`,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SUMMARY_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error({ status: response.status, errorText, model: model.name }, '[Overview] AI API 返回错误');
        return null;
      }

      const data = await response.json();
      // 推理模型 content=[{type:'thinking'},{type:'text',text}]，取 text 块
      const textBlock = Array.isArray(data?.content)
        ? data.content.find((c) => c.type === 'text')
        : undefined;
      return textBlock?.text || null;
    } catch (err) {
      logger.error({ err, model: model.name }, '[Overview] AI API 调用失败');
      return null;
    }
  }

  /**
   * 删除单条会话概览（删对话级联删用）
   * @returns {Promise<boolean>} 是否删除（不存在返回 false，不报错）
   */
  async deleteOverview(userId, projectName, sessionId) {
    this._assertProjectName(projectName);
    if (!sessionId || !SESSION_ID_RE.test(sessionId)) return false;
    const filePath = `${CONTAINER.paths.workspace}/${projectName}/${OVERVIEW_DIR_NAME}/${sessionId}.md`;
    try {
      await deleteFileInContainer(userId, filePath, {});
      return true;
    } catch (err) {
      if (/not found|no such file|ENOENT/i.test(err.message)) return false;
      logger.warn({ err, sessionId }, '[Overview] delete failed');
      return false;
    }
  }

  /**
   * 列出案件的所有会话概览（扫 project-overview/*.md）
   * @returns {Promise<Array<{sessionId: string, mtime: number}>>} 按 mtime 倒序
   */
  async listOverviews(userId, projectName) {
    this._assertProjectName(projectName);
    const dir = `${CONTAINER.paths.workspace}/${projectName}/${OVERVIEW_DIR_NAME}`;
    let output;
    try {
      const { stream } = await containerManager.execInContainer(userId, ['sh', '-c', `find "${dir}" -maxdepth 1 -name "*.md" -printf "%f\\t%T@\\n" 2>/dev/null`]);
      output = await readExecStream(stream);
    } catch (err) {
      logger.warn({ err, projectName }, '[Overview] list find failed');
      return [];
    }
    if (!output || !output.trim()) return [];
    return output.trim().split('\n').filter(Boolean).map((line) => {
      const [fileName, mtime] = line.split('\t');
      return {
        sessionId: fileName.replace(/\.md$/, ''),
        mtime: parseInt(mtime, 10) * 1000 || 0,
      };
    }).sort((a, b) => b.mtime - a.mtime);
  }

  /**
   * 读取单条会话概览（缓存全文，去 frontmatter 供展示）
   * @throws {ValidationError} sessionId/projectName 非法
   */
  async readOverview(userId, projectName, sessionId) {
    this._assertProjectName(projectName);
    if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
      throw new ValidationError('Invalid sessionId');
    }
    const filePath = `${CONTAINER.paths.workspace}/${projectName}/${OVERVIEW_DIR_NAME}/${sessionId}.md`;
    let raw;
    try {
      raw = await readFileInContainer(userId, filePath, {});
    } catch (err) {
      if (/not found|no such file|ENOENT/i.test(err.message)) {
        return { content: '', path: filePath };
      }
      throw err;
    }
    return { content: cleanOverviewContent(raw?.content || ''), path: filePath };
  }

  /**
   * 读取所有会话概览拼成注入文本（发消息时给 AI 跨会话上下文用）
   *
   * AI 默认无状态、无跨会话记忆；本方法把案件历史摘要读出拼接，
   * 由 ClaudeQuery 注入 systemPrompt，让 AI "看到"之前会话的内容。
   *
   * @param {number} maxCount - 最多取最近 N 条（控 token，按 mtime 倒序）
   * @returns {Promise<string>} 拼接文本；无摘要返回 ''
   */
  async readAllForInjection(userId, projectName, maxCount = 10) {
    const overviews = await this.listOverviews(userId, projectName);
    if (!overviews.length) return '';
    const parts = [];
    for (const ov of overviews.slice(0, maxCount)) {
      try {
        const result = await this.readOverview(userId, projectName, ov.sessionId);
        if (result?.content) {
          const time = ov.mtime ? new Date(ov.mtime).toLocaleString('zh-CN') : '';
          parts.push(`【会话 ${ov.sessionId}${time ? ` · ${time}` : ''}】\n${result.content}`);
        }
      } catch { /* 单条失败跳过，不影响整体 */ }
    }
    return parts.join('\n\n---\n\n');
  }
}

/**
 * 从会话 JSONL 提取 user/assistant 消息拼成 transcript
 * @param {string} jsonlText
 * @returns {string}
 */
export function extractTranscript(jsonlText) {
  if (!jsonlText) return '';
  const lines = jsonlText.split('\n').filter(Boolean);
  const turns = [];
  for (const line of lines) {
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg?.type !== 'user' && msg?.type !== 'assistant') continue;
    const content = msg.message?.content;
    const text = Array.isArray(content)
      ? content.map((c) => (typeof c === 'string' ? c : c?.text || '')).join(' ')
      : (typeof content === 'string' ? content : '');
    const trimmed = text.trim();
    if (trimmed) turns.push(`${msg.type === 'user' ? '用户' : 'AI'}: ${trimmed}`);
  }
  return turns.join('\n\n');
}

/** 格式化缓存文件（frontmatter + 摘要） */
function formatCache(sessionId, projectName, summary) {
  return `---
session_id: ${sessionId}
project: ${projectName}
generated_at: ${new Date().toISOString()}
---

${summary}
`;
}

/** 读 docker exec 的 multiplexed stream 成字符串 */
function readExecStream(stream) {
  let settled = false;
  return new Promise((resolve, reject) => {
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    containerManager.docker.modem.demuxStream(stream, stdout, stderr);
    let output = '';
    stdout.on('data', (chunk) => { output += chunk.toString(); });
    // 互斥：resolve/reject 只触发一次，避免 resolve 后 error 静默吞错 + 监听器泄漏
    stream.on('error', (err) => { if (!settled) { settled = true; reject(err); } });
    stream.on('end', () => { if (!settled) { settled = true; resolve(output); } });
  });
}

/**
 * 清理概览内容供展示：去 frontmatter
 * （AI 生成内容无 SDK 模板话，只去 frontmatter）
 */
export function cleanOverviewContent(raw) {
  if (!raw) return '';
  return raw.replace(/^---\n[\s\S]*?\n---\s*\n/, '').trim();
}

// 导出单例实例
export default new ProjectOverviewService();
