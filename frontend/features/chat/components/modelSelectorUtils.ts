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
 * Calculate token usage percentage from budget data
 * @param tokenBudget - Token budget data
 * @returns Percentage or null if not available
 */
export function calculateTokenPercentage(tokenBudget: { percentage?: number; total?: number; used?: number } | null | undefined): number | null {
  if (tokenBudget?.percentage !== undefined) {
    return tokenBudget.percentage;
  }
  if (tokenBudget?.total && tokenBudget?.used !== undefined) {
    return Math.round((tokenBudget.used / tokenBudget.total) * 100);
  }
  return null;
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
