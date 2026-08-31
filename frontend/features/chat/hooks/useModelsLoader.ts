// 可用模型列表加载 hook：挂载时从 /api/models 获取当前部署支持的 AI 模型列表
import { useState, useEffect } from 'react';
import { logger } from '@/shared/utils/logger';
import { STORAGE_KEYS } from '@/shared/constants';

/** 模型条目形状（与后端 /api/models 返回一致） */
type ModelEntry = { name: string; provider: string };

/**
 * 从 localStorage 读取缓存的模型列表
 *
 * 结构非法（非数组、元素缺 name/provider）时返回空数组，
 * 防止坏缓存让首帧渲染崩溃或显示异常。
 * @returns 缓存的模型列表，无有效缓存时为 []
 */
function readCachedModels(): ModelEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AVAILABLE_MODELS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const isValid = Array.isArray(parsed)
      && parsed.length > 0
      && parsed.every((m: unknown) => typeof m === 'object' && m !== null && 'name' in m && 'provider' in m);
    return isValid ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 可用模型列表加载 Hook：挂载时从 /api/models 获取当前部署支持的 AI 模型列表
 *
 * 首帧用 localStorage 缓存（STORAGE_KEYS.AVAILABLE_MODELS）即时渲染，
 * 消除每次进页面 "Loading models..." 闪烁；fetch 成功后更新缓存。
 */
export function useModelsLoader() {
  // 惰性初始化：读缓存让首帧即有模型名（如 kimi），不再显示 Loading
  const [availableModels, setAvailableModels] = useState<ModelEntry[]>(readCachedModels);

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.models)) {
          setAvailableModels(data.models);
          try {
            localStorage.setItem(STORAGE_KEYS.AVAILABLE_MODELS, JSON.stringify(data.models));
          } catch (storageError) {
            // 缓存写入失败（如隐私模式配额）不影响功能，仅记日志
            logger.warn('[ChatInterface] Failed to cache models list:', storageError);
          }
        }
      })
      .catch(error => {
        logger.error('[ChatInterface] Error loading models:', error);
      });
  }, []);

  return { availableModels };
}
