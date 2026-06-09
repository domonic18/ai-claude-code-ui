/**
 * SummaryService.js
 *
 * 文档摘要生成服务
 * 上传文档后异步调用 AI API 生成 ~200 字摘要，写入 readme.md。
 *
 * 文档类型路由：
 * - 图片 → Kimi 多模态模型（base64 图片 + prompt）
 * - 其他 → 默认文本模型（提取文本 + prompt）
 *
 * 触发方式：fire-and-forget，不阻塞上传响应
 *
 * @module services/documents/SummaryService
 */

import { documentTextExtractor } from './DocumentTextExtractor.js';
import { readmeService } from './ReadmeService.js';
import { MODELS, getModelProviderConfig } from '../../config/modelConfig.js';
import containerManager from '../container/core/index.js';
import { PassThrough } from 'stream';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('services/documents/SummaryService');

/** 摘要生成 prompt */
const SUMMARY_PROMPT = '请用中文为以下文档生成约200字的摘要，概括文档的核心内容和关键信息。直接输出摘要文本，不要加任何前缀或标题：\n\n';
const IMAGE_SUMMARY_PROMPT = '请用中文为这张图片生成约200字的描述，概括图片的核心内容和关键信息。直接输出描述文本，不要加任何前缀或标题。';

/** AI 文档摘要重试配置 */
const AI_DOC_RETRY_DELAY_MS = 3_000;
const AI_DOC_MAX_RETRIES = 3;

/** 摘要生成失败时的占位文本 */
const FALLBACK_SUMMARY = '（摘要生成失败，请手动编辑）';

/** 图片扩展名集合 */
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);

/** 支持多模态的模型名称（用于图片摘要） */
const MULTIMODAL_MODEL_NAME = 'kimi-k2.6';

/**
 * 判断文件是否为图片
 * @param {string} fileName
 * @returns {boolean}
 */
function isImageFile(fileName) {
  const ext = '.' + (fileName.split('.').pop() || '').toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * 从 MIME 类型推断 media_type
 * @param {string} ext - 文件扩展名（含点）
 * @returns {string}
 */
function imageMediaType(ext) {
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return map[ext] || 'image/png';
}

/**
 * 判断 extractText 返回的是否为失败标记文本
 * @param {string} text
 * @returns {boolean}
 */
function _isExtractionFailure(text) {
  return text.startsWith('[无法提取文档内容:') || text.startsWith('[文档内容为空');
}

/**
 * Promise 延迟工具
 * @param {number} ms
 * @returns {Promise<void>}
 */
function _delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 文档摘要生成服务
 */
export class SummaryService {
  /**
   * 异步生成文档摘要并写入 readme.md
   * 此方法为 fire-and-forget，调用者不需要 await
   *
   * @param {number} userId
   * @param {string} projectName
   * @param {{file_path: string, file_name: string, file_size: number}} uploadResult
   */
  generateSummary(userId, projectName, uploadResult) {
    this._doGenerate(userId, projectName, uploadResult).catch((err) => {
      logger.error({ err, userId, projectName, fileName: uploadResult.file_name }, '[SummaryService] 摘要生成失败');
    });
  }

  /**
   * 实际的摘要生成逻辑
   *
   * AI 生成文档（file_size === 0）存在时序问题：
   * tool_use 消息到达时文件尚未写入，extractText 会失败。
   * 因此对 AI 文档增加重试机制（最多 3 次，间隔 3 秒）。
   *
   * @private
   */
  async _doGenerate(userId, projectName, uploadResult) {
    const { file_path, file_name, file_size } = uploadResult;
    const isAIDoc = file_size === 0;
    const maxAttempts = isAIDoc ? AI_DOC_MAX_RETRIES : 1;

    logger.info({ userId, projectName, fileName: file_name, isImage: isImageFile(file_name), isAIDoc }, '[SummaryService] 开始生成摘要');

    let summary;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (isImageFile(file_name)) {
          summary = await this._generateImageSummary(userId, file_path, file_name);
        } else {
          const text = await documentTextExtractor.extractText(userId, file_path, file_name);
          // 检测提取失败的标记文本，AI 文档需等待文件写入后重试
          if (isAIDoc && _isExtractionFailure(text) && attempt < maxAttempts) {
            logger.info({ userId, projectName, fileName: file_name, attempt }, '[SummaryService] 文件尚未就绪，等待重试');
            await _delay(AI_DOC_RETRY_DELAY_MS);
            continue;
          }
          summary = await this._callTextAIAPI(text, file_name);
        }

        if (summary) break;

        // AI 返回空摘要：AI 文档重试，普通文档直接结束
        if (isAIDoc && attempt < maxAttempts) {
          logger.info({ userId, projectName, fileName: file_name, attempt }, '[SummaryService] AI 返回空摘要，等待重试');
          await _delay(AI_DOC_RETRY_DELAY_MS);
        }
      } catch (err) {
        logger.warn({ err, userId, projectName, fileName: file_name, attempt }, '[SummaryService] 摘要生成异常');
        if (isAIDoc && attempt < maxAttempts) {
          await _delay(AI_DOC_RETRY_DELAY_MS);
        }
      }
    }

    // 兜底：生成失败时写入占位摘要，避免前端永远停留在 pending
    if (!summary) {
      logger.warn({ userId, projectName, fileName: file_name }, '[SummaryService] 摘要生成失败，写入兜底摘要');
      summary = FALLBACK_SUMMARY;
    }

    await readmeService.appendEntry(userId, projectName, {
      fileName: file_name,
      fileSize: file_size,
      summary,
    });

    logger.info({ userId, projectName, fileName: file_name, summaryLength: summary.length }, '[SummaryService] 摘要已写入 readme.md');
  }

  /**
   * 从容器读取图片并转为 base64
   * @private
   */
  async _readImageBase64(userId, filePath) {
    await containerManager.getOrCreateContainer(userId);
    const { stream } = await containerManager.execInContainer(userId, ['base64', filePath]);
    return new Promise((resolve, reject) => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      containerManager.docker.modem.demuxStream(stream, stdout, stderr);
      const chunks = [];
      stdout.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8').trim()));
      stream.on('error', reject);
    });
  }

  /**
   * 图片摘要：读取 base64 + 调用多模态模型
   * @private
   */
  async _generateImageSummary(userId, filePath, fileName) {
    // 查找多模态模型配置
    const multimodalModel = MODELS.available.find(m => m.name === MULTIMODAL_MODEL_NAME);
    const model = multimodalModel || MODELS.available[0];

    // 从容器读取图片 base64
    let base64Data;
    try {
      base64Data = await this._readImageBase64(userId, filePath);
    } catch (err) {
      logger.error({ err, userId, filePath }, '[SummaryService] 读取图片 base64 失败');
      return null;
    }

    if (!base64Data) {
      logger.warn({ filePath }, '[SummaryService] 图片 base64 为空');
      return null;
    }

    const ext = '.' + (fileName.split('.').pop() || '').toLowerCase();
    const mediaType = imageMediaType(ext);

    // Anthropic 多模态消息格式
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: IMAGE_SUMMARY_PROMPT,
          },
        ],
      },
    ];

    logger.info({ model: model.name, fileName }, '[SummaryService] 调用多模态 API 生成图片摘要');

    return this._callAnthropicMessagesAPI(model, messages, fileName);
  }

  /**
   * 调用 Anthropic Messages API（通用方法）
   *
   * 封装 Anthropic Messages 格式的请求/响应处理，
   * 被 _callTextAIAPI 和 _generateImageSummary 共用。
   *
   * TODO: 当项目需要支持非 Anthropic 模型时，可将此方法重构为
   * 按模型 provider 分发的策略模式。
   *
   * @param {Object} model - 模型配置对象（来自 MODELS.available）
   * @param {Array} messages - Anthropic Messages 格式的 messages 数组
   * @param {string} fileName - 文件名（用于日志）
   * @returns {Promise<string|null>} 摘要文本，失败返回 null
   * @private
   */
  async _callAnthropicMessagesAPI(model, messages, fileName) {
    const config = getModelProviderConfig(model.name);
    if (!config.baseURL || !config.authToken) {
      logger.error({ model: model.name }, '[SummaryService] 模型缺少 API 配置');
      return null;
    }

    const baseURL = config.baseURL.replace(/\/+$/, '');
    const url = `${baseURL}/v1/messages`;

    const body = {
      model: model.name,
      max_tokens: 500,
      messages,
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
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error({ status: response.status, errorText, model: model.name, fileName }, '[SummaryService] AI API 返回错误');
        return null;
      }

      const data = await response.json();
      const content = data?.content?.[0]?.text;

      if (!content) {
        logger.warn({ data, fileName }, '[SummaryService] AI API 返回空内容');
        return null;
      }

      return content.trim();
    } catch (err) {
      logger.error({ err, model: model.name, fileName }, '[SummaryService] AI API 调用异常');
      return null;
    }
  }

  /**
   * 文本摘要：调用默认文本模型
   * @private
   */
  async _callTextAIAPI(text, fileName) {
    const model = MODELS.available[0];
    if (!model) {
      logger.error('[SummaryService] 无可用模型');
      return null;
    }

    logger.debug({ model: model.name, textLength: text.length, fileName }, '[SummaryService] 调用文本 AI API');

    const messages = [
      { role: 'user', content: SUMMARY_PROMPT + text },
    ];

    return this._callAnthropicMessagesAPI(model, messages, fileName);
  }
}

/** 单例导出 */
export const summaryService = new SummaryService();
export default summaryService;
