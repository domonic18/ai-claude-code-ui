/**
 * Upload Validators
 *
 * Provides validation functions for file uploads and API URLs.
 * Implements SSRF protection and input sanitization.
 *
 * @module routes/tools/uploadValidators
 */

/**
 * 允许的音频 MIME 类型白名单
 */
const ALLOWED_AUDIO_MIMETYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm',
  'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a',
];

// 处理 GET /validatedwhisperurl 请求
/**
 * 验证并返回 Whisper API URL
 * 强制 https 协议 + 阻止私有网段/链路本地地址（SSRF 防护）
 *
 * @returns {string} 合法的 API URL
 * @throws {Error} 如果 URL 无效或不安全
 */
export function getValidatedWhisperUrl() {
  const url = process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions';
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error(`Invalid WHISPER_API_URL: ${e.message}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`WHISPER_API_URL must use https protocol, got: ${parsed.protocol}`);
  }

  // SSRF 防护：阻止解析后的 hostname 指向私有网段或链路本地地址
  const hostname = parsed.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('WHISPER_API_URL must not point to localhost');
  }
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('169.254.')) {
    throw new Error('WHISPER_API_URL must not point to a private/link-local address');
  }
  // 172.16.0.0/12 范围检查
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
    throw new Error('WHISPER_API_URL must not point to a private address');
  }

  return url;
}

// 处理 GET /validatedmodelname 请求
/**
 * 验证模型名称（仅允许字母、数字、连字符、点号）
 *
 * @param {string} envVar - 环境变量名
 * @param {string} defaultValue - 默认值
 * @returns {string} 合法的模型名称
 * @throws {Error} 如果模型名称无效
 */
export function getValidatedModelName(envVar, defaultValue) {
  const value = process.env[envVar] || defaultValue;
  if (!/^[a-zA-Z0-9.\-]+$/.test(value)) {
    throw new Error(`Invalid ${envVar}: must contain only alphanumeric characters, dots, and hyphens`);
  }
  if (value.length > 128) {
    throw new Error(`Invalid ${envVar}: exceeds maximum length of 128`);
  }
  return value;
}

// 定义 HTTP 路由处理器
/**
 * 验证音频文件 MIME 类型
 *
 * @param {string} mimetype - 文件 MIME 类型
 * @returns {boolean} 是否为允许的音频类型
 */
export function isValidAudioMimeType(mimetype) {
  return ALLOWED_AUDIO_MIMETYPES.includes(mimetype);
}

// 处理 GET /allowedaudiomimetypes 请求
/**
 * 获取允许的音频 MIME 类型列表
 *
 * @returns {string[]} 允许的 MIME 类型列表
 */
export function getAllowedAudioMimetypes() {
  return [...ALLOWED_AUDIO_MIMETYPES];
}

