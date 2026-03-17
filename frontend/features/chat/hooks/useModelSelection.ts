/**
 * useModelSelection Hook
 *
 * Manages model selection state and provider updates.
 *
 * 注意：模型名称直接使用后端 API 返回的格式，无需转换
 * 例如：glm-4.7, glm-5, kimi-k2.5
 */

import { useState, useCallback, useEffect } from 'react';

// 支持图片识别的模型列表（硬编码）
const IMAGE_SUPPORTED_MODELS = ['kimi-k2.5', 'kimi-k2.5-turbo'];

export interface UseModelSelectionOptions {
  /** Initial model ID (from backend API, e.g., 'glm-4.7') */
  initialModel?: string;
  /** Available models from backend API (used to resolve provider) */
  availableModels?: Array<{ name: string; provider: string }>;
  /** Image attachment flag for auto-switch detection */
  hasImageAttachment?: boolean;
}

export interface UseModelSelectionResult {
  /** Currently selected model (backend format, e.g., 'glm-4.7') */
  selectedModel: string;
  /** Current provider (claude, openai, etc.) */
  provider: string;
  /** Handle model selection */
  handleModelSelect: (modelId: string) => void;
}

/**
 * Hook for managing model selection
 *
 * @param options - Hook options
 * @returns Model selection state and handlers
 */
export function useModelSelection(options: UseModelSelectionOptions = {}): UseModelSelectionResult {
  const { initialModel = undefined, availableModels = [], hasImageAttachment = false } = options;

  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('selected-model');
      return stored || initialModel || '';
    }
    return initialModel || '';
  });

  const [provider, setProvider] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected-provider') || 'claude';
    }
    return 'claude';
  });

  // 当 availableModels 加载后，自动选择合适的模型
  useEffect(() => {
    if (availableModels.length > 0 && !selectedModel) {
      // 没有选择任何模型，自动选择第一个
      const firstModel = availableModels[0].name;
      console.log('[useModelSelection] Auto-selecting first model:', firstModel, '(no previous selection)');
      setSelectedModel(firstModel);
      localStorage.setItem('selected-model', firstModel);
    } else if (availableModels.length > 0 && selectedModel) {
      // 有选择，但需要验证是否在列表中
      const modelExists = availableModels.some(m => m.name === selectedModel);
      if (!modelExists) {
        // 选择的模型不在列表中，选择第一个
        const firstModel = availableModels[0].name;
        console.log('[useModelSelection] Selected model not in list, selecting first:', firstModel);
        setSelectedModel(firstModel);
        localStorage.setItem('selected-model', firstModel);
      }
    }
  }, [availableModels, selectedModel]);

  // 当有图片附件时，自动切换到支持图片的模型
  useEffect(() => {
    if (hasImageAttachment && availableModels.length > 0) {
      // 检查当前模型是否支持图片
      const currentSupportsImage = IMAGE_SUPPORTED_MODELS.includes(selectedModel);
      if (!currentSupportsImage) {
        // 查找第一个支持图片的模型（从可用模型列表中查找）
        const imageSupportedModel = availableModels.find(m => IMAGE_SUPPORTED_MODELS.includes(m.name));
        if (imageSupportedModel && imageSupportedModel.name !== selectedModel) {
          console.log('[useModelSelection] Auto-switching to image-capable model:', imageSupportedModel.name);
          setSelectedModel(imageSupportedModel.name);
          localStorage.setItem('selected-model', imageSupportedModel.name);

          // 更新 provider
          const newProvider = imageSupportedModel.provider || 'claude';
          setProvider(newProvider);
          localStorage.setItem('selected-provider', newProvider);

          // 触发自定义事件通知 UI 显示消息
          window.dispatchEvent(new CustomEvent('model-switch', {
            detail: {
              newModel: imageSupportedModel.name,
              reason: 'image-attachment'
            }
          }));
        }
      }
    }
  }, [hasImageAttachment, availableModels, selectedModel]);

  /**
   * Handle model selection
   * @param modelId - 模型 ID，直接使用后端 API 返回的格式（如 glm-4.7）
   */
  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('selected-model', modelId);

    // 从已加载的模型列表中查找对应的 provider
    const selectedModelData = availableModels.find(m => m.name === modelId);
    const newProvider = selectedModelData?.provider || 'claude';

    setProvider(newProvider);
    localStorage.setItem('selected-provider', newProvider);
  }, [availableModels]);

  return {
    selectedModel,
    provider,
    handleModelSelect,
  };
}

export default useModelSelection;
