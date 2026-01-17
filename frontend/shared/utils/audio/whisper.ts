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

/**
 * Check if transcription is available
 */
export function isTranscriptionAvailable(): boolean {
  return true; // TODO: Check backend availability
}

/**
 * Get supported audio formats
 */
export function getSupportedFormats(): string[] {
  return ['webm', 'wav', 'mp3', 'ogg'];
}
