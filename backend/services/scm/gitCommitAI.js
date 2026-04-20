/**
 * Git 提交 AI 辅助模块
 *
 * 负责 AI 生成提交消息的查询和解析逻辑
 *
 * @module services/scm/gitCommitAI
 */

import { queryClaudeSDK } from '../execution/claude/index.js';
import { spawnCursor } from '../execution/cursor/index.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('services/scm/gitCommitAI');

/**
 * AI 响应类型 → 文本提取器
 * 每种响应类型对应一个提取函数，返回文本或空字符串
 */
const RESPONSE_EXTRACTORS = {
  'claude-response': (parsed) => {
    const message = parsed.data?.message || parsed.data;
    return message?.content
      ?.filter(i => i.type === 'text' && i.text)
      ?.map(i => i.text)
      ?.join('') ?? '';
  },
  'cursor-output': (parsed) => parsed.output ?? '',
  'text': (parsed) => parsed.text ?? '',
};

/**
 * 从 AI 提供者的原始响应中提取文本
 * @param {string|Object} data - 原始响应数据
 * @returns {string} 提取的文本
 */
export function extractResponseText(data) {
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  const extractor = RESPONSE_EXTRACTORS[parsed.type];
  return extractor ? extractor(parsed) : '';
}

/**
 * AI provider registry — each provider implements a query function
 * @param {string} provider - AI 提供者
 * @param {string} prompt - 提示词
 * @param {string} cwd - 工作目录
 * @param {Object} writer - WebSocket writer
 * @returns {Promise<string>} 响应文本
 */
async function queryAIProvider(prompt, projectPath, provider) {
  const AI_PROVIDERS = {
    claude: (prompt, cwd, writer) => queryClaudeSDK(prompt, { cwd, permissionMode: 'bypassPermissions', model: 'sonnet' }, writer),
    cursor: (prompt, cwd, writer) => spawnCursor(prompt, { cwd, skipPermissions: true }, writer),
  };

  const queryFn = AI_PROVIDERS[provider];
  if (!queryFn) {
    logger.warn({ provider }, '[git] Unknown AI provider, falling back to claude');
    return '';
  }

  let responseText = '';
  const writer = {
    send: (data) => {
      try { responseText += extractResponseText(data); } catch { /* ignore */ }
    },
    setSessionId: () => {},
  };

  await queryFn(prompt, projectPath, writer);
  return responseText;
}

/**
 * 清理 AI 生成的提交消息
 * @param {string} text - 原始文本
 * @returns {string} 清理后的提交消息
 */
export function cleanCommitMessage(text) {
  if (!text || !text.trim()) return '';

  let cleaned = text.trim();
  cleaned = cleaned.replace(/```[a-z]*\n/g, '').replace(/```/g, '');
  cleaned = cleaned.replace(/^#+\s*/gm, '');
  cleaned = cleaned.replace(/^["']|["']$/g, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  const match = cleaned.match(/(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+?\))?:.+/s);
  if (match) cleaned = cleaned.substring(cleaned.indexOf(match[0]));

  return cleaned.trim();
}

/**
 * 使用 AI 生成提交消息
 * @param {string} projectPath - 项目路径
 * @param {string[]} files - 文件列表
 * @param {string} provider - AI 提供者：'claude' 或 'cursor'
 * @param {Function} collectDiffContext - 收集 diff 上下文的函数
 * @param {Function} collectUntrackedFileContent - 收集未跟踪文件内容的函数
 * @param {Function} createCommitPrompt - 创建 prompt 的函数
 * @returns {Promise<string>} 生成的提交消息
 */
export async function generateCommitMessage(
  projectPath,
  files,
  provider = 'claude',
  collectDiffContext,
  collectUntrackedFileContent,
  createCommitPrompt
) {
  try {
    // 步骤 1：收集 diff 上下文
    let diffContext = await collectDiffContext(projectPath, files);

    // 步骤 2：如果没有 diff，尝试读取未跟踪文件内容
    if (!diffContext.trim()) {
      diffContext = await collectUntrackedFileContent(projectPath, files);
    }

    // 步骤 3：构建 prompt
    const prompt = createCommitPrompt(files, diffContext);

    // 步骤 4：调用 AI 并解析响应
    const responseText = await queryAIProvider(prompt, projectPath, provider);
    const cleaned = cleanCommitMessage(responseText);
    return cleaned || 'chore: update files';
  } catch (error) {
    logger.error({ err: error }, '[git] Error generating commit message with AI');
    return `chore: update ${files.length} file${files.length !== 1 ? 's' : ''}`;
  }
}
