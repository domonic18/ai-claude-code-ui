/**
 * Model Selector Utilities
 *
 * Utility functions for model filtering, sorting, and grouping.
 * Extracted from ModelSelector.tsx to reduce complexity.
 *
 * @module frontend/features/chat/components/modelSelectorUtils
 */

import type { ModelOption } from './ModelSelector';

/**
 * Group models by provider
 * @param models - Array of model options
 * @returns Record mapping provider names to model arrays
 */
export function groupModelsByProvider(models: ModelOption[]): Record<string, ModelOption[]> {
  const groups: Record<string, ModelOption[]> = {};

  models.forEach(model => {
    const provider = model.provider || 'Unknown';
    if (!groups[provider]) {
      groups[provider] = [];
    }
    if (model.name) {
      groups[provider].push(model);
    }
  });

  return groups;
}

/**
 * Find current model from models list
 * @param models - Array of model options
 * @param selectedModel - Selected model name
 * @returns Current model or first model if not found, null if no models
 */
export function findCurrentModel(models: ModelOption[], selectedModel: string | undefined): ModelOption | null {
  if (models.length === 0) return null;
  return models.find(m => m.name === selectedModel) || models[0];
}
