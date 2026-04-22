/**
 * Transcription Handler
 *
 * Handles audio transcription using Whisper API and GPT enhancement.
 * Supports multiple enhancement modes for transcribed text.
 *
 * @module routes/tools/transcriptionHandler
 */

import { createLogger } from '../../utils/logger.js';
import {
  getValidatedWhisperUrl,
  getValidatedModelName,
  isValidAudioMimeType,
  getAllowedAudioMimetypes
} from './uploadValidators.js';

const logger = createLogger('routes/tools/transcriptionHandler');

// 定义 HTTP 路由处理器
/**
 * Transcribe audio using Whisper API
 *
 * @param {Object} req - Request object with file buffer
 * @param {string} apiKey - OpenAI API key
 * @param {string} fileMimetype - File MIME type
 * @returns {Promise<string>} Transcribed text
 * @throws {Error} If transcription fails
 */
export async function transcribeAudio(req, apiKey, fileMimetype) {
  const FormData = (await import('form-data')).default;
  const formData = new FormData();
  formData.append('file', req.file.buffer, {
    filename: req.file.originalname,
    contentType: fileMimetype
  });
  formData.append('model', getValidatedModelName('WHISPER_MODEL', 'whisper-1'));
  formData.append('response_format', 'json');
  formData.append('language', 'en');

  // 向 OpenAI 兼容 API 发出请求（URL 经过 https 校验）
  const whisperApiUrl = getValidatedWhisperUrl();
  const fetch = (await import('node-fetch')).default;
  const response = await fetch(whisperApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      ...formData.getHeaders()
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Whisper API error: ${response.status}`);
  }

  const data = await response.json();
  return data.text || '';
}

// 定义 HTTP 路由处理器
/**
 * Enhance transcribed text using GPT
 *
 * @param {string} transcribedText - Raw transcribed text
 * @param {string} mode - Enhancement mode (prompt, vibe, instructions, architect)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} Enhanced text
 */
export async function enhanceTranscription(transcribedText, mode, apiKey) {
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });

  let prompt, systemMessage, temperature = 0.7, maxTokens = 800;

  switch (mode) {
    case 'prompt':
      systemMessage = 'You are an expert prompt engineer who creates clear, detailed, and effective prompts.';
      prompt = `You are an expert prompt engineer. Transform the following rough instruction into a clear, detailed, and context-aware AI prompt.

Your enhanced prompt should:
1. Be specific and unambiguous
2. Include relevant context and constraints
3. Specify the desired output format
4. Use clear, actionable language
5. Include examples where helpful
6. Consider edge cases and potential ambiguities

Transform this rough instruction into a well-crafted prompt:
"${transcribedText}"

Enhanced prompt:`;
      break;

    case 'vibe':
    case 'instructions':
    case 'architect':
      systemMessage = 'You are a helpful assistant that formats ideas into clear, actionable instructions for AI agents.';
      temperature = 0.5;
      prompt = `Transform the following idea into clear, well-structured instructions that an AI agent can easily understand and execute.

IMPORTANT RULES:
- Format as clear, step-by-step instructions
- Add reasonable implementation details based on common patterns
- Only include details directly related to what was asked
- Do NOT add features or functionality not mentioned
- Keep the original intent and scope intact
- Use clear, actionable language an agent can follow

Transform this idea into agent-friendly instructions:
"${transcribedText}"

Agent instructions:`;
      break;

    default:
      return transcribedText;
  }

  const completion = await openai.chat.completions.create({
    model: getValidatedModelName('OPENAI_ENHANCE_MODEL', 'gpt-4o-mini'),
    messages: [
      { role: 'system', content: systemMessage },
      { role: 'user', content: prompt }
    ],
    temperature: temperature,
    max_tokens: maxTokens
  });

  return completion.choices[0].message.content || transcribedText;
}

// 定义 HTTP 路由处理器
/**
 * Handle audio transcription with optional enhancement
 *
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Promise<void>}
 */
export async function handleTranscription(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in server environment.'
    });
  }

  try {
    // 校验音频文件 mimetype，防止伪造 content-type
    const fileMimetype = req.file.mimetype || 'application/octet-stream';
    if (!isValidAudioMimeType(fileMimetype)) {
      return res.status(400).json({
        error: `Unsupported audio format: ${fileMimetype}. Allowed: ${getAllowedAudioMimetypes().join(', ')}`
      });
    }

    // Transcribe audio
    let transcribedText = await transcribeAudio(req, apiKey, fileMimetype);

    // 检查是否启用了增强模式
    const mode = req.body.mode || 'default';

    // 如果没有转录文本，返回空
    if (!transcribedText) {
      return res.json({ text: '' });
    }

    // 如果是默认模式，返回未增强的转录文本
    if (mode === 'default') {
      return res.json({ text: transcribedText });
    }

    // 处理不同的增强模式
    try {
      transcribedText = await enhanceTranscription(transcribedText, mode, apiKey);
    } catch (gptError) {
      logger.error('GPT processing error:', gptError);
      // 如果 GPT 失败，回退到原始转录
    }

    res.json({ text: transcribedText });

  } catch (error) {
    logger.error('Transcription error:', error);
    res.status(500).json({ error: error.message });
  }
}

