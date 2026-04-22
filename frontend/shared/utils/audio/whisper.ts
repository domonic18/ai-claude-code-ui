/**
 * Whisper Audio Transcription
 *
 * Handles audio transcription using the Whisper API.
 * Migrated from frontend/utils/whisper.js
 */

/**
 * Transcribe audio using Whisper API
 */
export async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.webm');

  const response = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Transcription failed');
  }

  return result.text || '';
}

/** 缓存后端可用性检查结果，避免频繁请求 */
let cachedAvailable: boolean | null = null;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟内复用缓存结果

/**
 * 检查后端语音转写服务是否可用
 *
 * 通过向 /api/transcribe 发送 HEAD/OPTIONS 预检请求判断服务端是否配置了
 * OPENAI_API_KEY 并正常响应。结果会缓存 5 分钟以减少网络开销。
 *
 * @returns 是否可用
 */
export async function isTranscriptionAvailable(): Promise<boolean> {
  const now = Date.now();
  if (cachedAvailable !== null && now - lastCheckTime < CHECK_INTERVAL_MS) {
    return cachedAvailable;
  }

  try {
    const response = await fetch('/api/transcribe', {
      method: 'HEAD',
      credentials: 'include',
    });
    // 405 = 端点存在但不支持 HEAD，说明路由已注册 → 可用
    // 500 = 端点存在但缺少 API Key → 不可用
    cachedAvailable = response.status === 405 || response.ok;
  } catch {
    cachedAvailable = false;
  }

  lastCheckTime = now;
  return cachedAvailable;
}

/**
 * Get supported audio formats
 */
export function getSupportedFormats(): string[] {
  return ['webm', 'wav', 'mp3', 'ogg'];
}
