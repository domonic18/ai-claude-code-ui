/**
 * Model Selector Callbacks
 *
 * Event handlers and state management for ModelSelector component.
 * Extracted from ModelSelector.tsx to reduce complexity.
 *
 * @module frontend/features/chat/components/modelSelectorCallbacks
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TokenBudget } from './TokenDisplay';
import { groupModelsByProvider, calculateTokenPercentage, findCurrentModel } from './modelSelectorUtils';

/**
 * Model option interface (re-declared to avoid circular dependency with ModelSelector.tsx)
 */
export interface ModelOption {
  /** Model identifier for API calls and UI display (e.g., 'glm-4.7') */
  name: string;
  /** Provider name for grouping (e.g., 'Zhipu GLM') */
  provider: string;
  /** Optional description */
  description?: string;
  /** Context window size */
  contextWindow?: number;
  /** Maximum output tokens */
  maxTokens?: number;
}

/**
 * Custom hook to manage ModelSelector state and logic
 */
export function useModelSelectorState(
  selectedModel: string | undefined,
  models: ModelOption[] | undefined,
  onModelSelect: ((modelId: string) => void) | undefined,
  tokenBudget: TokenBudget | null | undefined
) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModels = models || [];
  const isModelsLoaded = currentModels.length > 0;
  const currentModel = findCurrentModel(currentModels, selectedModel);

  // Compute token percentage
  const tokenPercentage = calculateTokenPercentage(tokenBudget);

  // Group models by provider
  const groupedModels = groupModelsByProvider(currentModels);

  // Handle model selection
  const handleSelect = useCallback((modelName: string) => {
    onModelSelect?.(modelName);
    setIsOpen(false);
  }, [onModelSelect]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  return {
    currentModels,
    isModelsLoaded,
    currentModel,
    tokenPercentage,
    groupedModels,
    handleSelect,
    isOpen,
    setIsOpen,
    dropdownRef,
    t
  };
}
