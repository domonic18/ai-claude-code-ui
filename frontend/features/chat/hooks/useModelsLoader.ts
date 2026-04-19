import { useState, useEffect } from 'react';
import { logger } from '@/shared/utils/logger';

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
