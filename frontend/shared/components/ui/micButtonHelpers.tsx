/**
 * micButtonHelpers.tsx
 *
 * MicButton 辅助函数 — 从 MicButton.tsx 提取
 *
 * @module shared/components/ui/micButtonHelpers
 */

import React from 'react';
import { Mic, Loader2, Brain } from 'lucide-react';

// Re-export recording functions
export {
  startRecording,
  stopRecording,
  cleanupStream,
  getSupportedMimeType,
  setupRecorderHandlers,
  getRecordingErrorMessage,
  canHandleClick
} from './micRecorder';

// Re-export audio processing functions
export {
  handleRecordingComplete
} from './audioProcessor';

export type MicState = 'idle' | 'recording' | 'transcribing' | 'processing';

// SupportCheckResult 的类型定义
/**
 * 支持性检查结果接口
 */
export interface SupportCheckResult {
  isSupported: boolean;
  error: string | null;
}

/**
 * 检查浏览器是否支持麦克风功能
 * @returns 支持性检查结果
 */
export function checkMicrophoneSupport(): SupportCheckResult {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      isSupported: false,
      error: 'Microphone not supported. Please use HTTPS or a modern browser.'
    };
  }

  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    return {
      isSupported: false,
      error: 'Microphone requires HTTPS. Please use a secure connection.'
    };
  }

  return {
    isSupported: true,
    error: null
  };
}

// ButtonAppearance 的类型定义
/**
 * 按钮外观配置接口
 */
export interface ButtonAppearance {
  icon: React.ReactNode;
  className: string;
  disabled: boolean;
}

/**
 * 按钮状态查找表
 * 使用查找表替换 switch/if 语句以降低复杂度
 */
const BUTTON_APPEARANCE_MAP: Record<
  MicState | 'unsupported',
  ButtonAppearance
> = {
  unsupported: {
    icon: <Mic className="w-5 h-5" />,
    className: 'bg-gray-400 cursor-not-allowed',
    disabled: true
  },
  idle: {
    icon: <Mic className="w-5 h-5" />,
    className: 'bg-gray-700 hover:bg-gray-600',
    disabled: false
  },
  recording: {
    icon: <Mic className="w-5 h-5 text-white" />,
    className: 'bg-red-500 hover:bg-red-600 animate-pulse',
    disabled: false
  },
  transcribing: {
    icon: <Loader2 className="w-5 h-5 animate-spin" />,
    className: 'bg-blue-500 hover:bg-blue-600',
    disabled: true
  },
  processing: {
    icon: <Brain className="w-5 h-5 animate-pulse" />,
    className: 'bg-purple-500 hover:bg-purple-600',
    disabled: true
  }
};

/**
 * 根据当前状态返回按钮外观配置
 * @param state - 当前麦克风状态
 * @param isSupported - 浏览器是否支持麦克风
 * @returns 按钮外观配置对象
 */
export function getButtonAppearance(state: MicState, isSupported: boolean): ButtonAppearance {
  const key = isSupported ? state : 'unsupported';
  return BUTTON_APPEARANCE_MAP[key];
}
