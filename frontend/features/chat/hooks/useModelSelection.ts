/**
 * useModelSelection Hook
 *
 * Manages model selection state and provider updates.
 */

import { useState, useCallback } from 'react';

export interface UseModelSelectionOptions {
  /** Initial model ID */
  initialModel?: string;
}

export interface UseModelSelectionResult {
  /** Currently selected model */
  selectedModel: string;
  /** Current provider (claude, openai, etc.) */
  provider: string;
  /** Handle model selection */
  handleModelSelect: (modelId: string) => void;
}

/**
 * Convert frontend model ID to backend model format
 *
 * Examples:
 * - 'claude-sonnet' -> 'sonnet'
 * - 'claude-opus' -> 'opus'
 * - 'claude-custom' -> 'custom' (uses ANTHROPIC_MODEL env var)
 * - 'claude-haiku' -> 'haiku'
 */
function convertModelIdToBackend(modelId: string): string {
  // Remove provider prefix and return the value
  // e.g., 'claude-sonnet' -> 'sonnet', 'claude-custom' -> 'custom'
  const parts = modelId.split('-');
  if (parts.length > 1) {
    return parts.slice(1).join('-');
  }
  return modelId;
}

/**
 * Hook for managing model selection
 *
 * @param options - Hook options
 * @returns Model selection state and handlers
 */
export function useModelSelection(options: UseModelSelectionOptions = {}): UseModelSelectionResult {
  const { initialModel = 'claude-custom' } = options;

  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected-model') || initialModel;
    }
    return initialModel;
  });

  const [provider, setProvider] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selected-provider') || 'claude';
    }
    return 'claude';
  });

  /**
   * Handle model selection
   */
  const handleModelSelect = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    // Save to localStorage
    localStorage.setItem('selected-model', modelId);
    // Update provider based on model
    const newProvider = modelId.startsWith('claude') ? 'claude' :
                       modelId.startsWith('gpt') ? 'openai' : 'claude';
    setProvider(newProvider);
    localStorage.setItem('selected-provider', newProvider);
  }, []);

  return {
    selectedModel,
    provider,
    handleModelSelect,
  };
}

export default useModelSelection;
