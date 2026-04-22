// 可用模型列表加载 hook：挂载时从 /api/models 获取当前部署支持的 AI 模型列表
import { useState, useEffect } from 'react';
import { logger } from '@/shared/utils/logger';

/**
 * 可用模型列表加载 Hook：挂载时从 /api/models 获取当前部署支持的 AI 模型列表
 */
export function useModelsLoader() {
  const [availableModels, setAvailableModels] = useState<Array<{ name: string; provider: string }>>([]);

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.models)) {
          setAvailableModels(data.models);
        }
      })
      .catch(error => {
        logger.error('[ChatInterface] Error loading models:', error);
      });
  }, []);

  return { availableModels };
}
