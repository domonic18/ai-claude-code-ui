// Claude AI 推理状态栏：展示实时推理进度，模拟 token 生成速率和已用时间
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface ClaudeStatusData {
  text?: string;
  tokens?: number;
  can_interrupt?: boolean;
}

export interface ClaudeStatusProps {
  status?: ClaudeStatusData | null;
  onAbort?: () => void;
  isLoading?: boolean;
  provider?: 'claude' | 'cursor' | 'codex';
}

/**
 * Claude AI 推理状态栏：展示实时推理进度，模拟 token 生成速率和已用时间，支持中断按钮
 */
function ClaudeStatus({ status, onAbort, isLoading, provider = 'claude' }: ClaudeStatusProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [fakeTokens, setFakeTokens] = useState(0);

  // 加载开始时启动计时器，每秒更新已用时间和估算 token 数
  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      setFakeTokens(0);
      return;
    }

    const startTime = Date.now();
    const tokenRate = 30 + Math.random() * 20; // 模拟 token 生成速率（30-50 tokens/s），SDK 未返回真实速率时用作估算

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
      setFakeTokens(Math.floor(elapsed * tokenRate));
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading]);

  // 旋转动画相位切换，每 500ms 循环 4 个符号
  useEffect(() => {
    if (!isLoading) return;

    const timer = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4);
    }, 500);

    return () => clearInterval(timer);
  }, [isLoading]);

  if (!isLoading) return null;

  // 无具体状态文本时，每 3 秒轮换一个动作词给用户进度感
  const actionWords = ['Thinking', 'Processing', 'Analyzing', 'Working', 'Computing', 'Reasoning'];
  const actionIndex = Math.floor(elapsedTime / 3) % actionWords.length;

  const statusText = status?.text || actionWords[actionIndex];
  const tokens = status?.tokens || fakeTokens;
  const canInterrupt = status?.can_interrupt !== false; // 默认允许中断，仅当服务端明确禁止时隐藏停止按钮

  const spinners = ['✻', '✹', '✸', '✶'];
  const currentSpinner = spinners[animationPhase];

  return (
    <div className="w-full mb-3 sm:mb-6 animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center justify-between max-w-4xl mx-auto bg-gray-800 dark:bg-gray-900 text-white rounded-lg shadow-lg px-2.5 py-2 sm:px-4 sm:py-3 border border-gray-700 dark:border-gray-800">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={cn(
              "text-base sm:text-xl transition-all duration-500 flex-shrink-0",
              animationPhase % 2 === 0 ? "text-blue-400 scale-110" : "text-blue-300"
            )}>
              {currentSpinner}
            </span>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-medium text-xs sm:text-sm truncate">{statusText}...</span>
                <span className="text-gray-400 text-xs sm:text-sm flex-shrink-0">({elapsedTime}s)</span>
                {tokens > 0 && (
                  <>
                    <span className="text-gray-500 hidden sm:inline">·</span>
                    <span className="text-gray-300 text-xs sm:text-sm hidden sm:inline flex-shrink-0">⚒ {tokens.toLocaleString()}</span>
                  </>
                )}
                <span className="text-gray-500 hidden sm:inline">·</span>
                <span className="text-gray-400 text-xs sm:text-sm hidden sm:inline">esc to stop</span>
              </div>
            </div>
          </div>
        </div>

        {canInterrupt && onAbort && (
          <button
            onClick={onAbort}
            className="ml-2 sm:ml-3 text-xs bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-md transition-colors flex items-center gap-1 sm:gap-1.5 flex-shrink-0 font-medium"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="hidden sm:inline">Stop</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default ClaudeStatus;
