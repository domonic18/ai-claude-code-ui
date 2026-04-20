/**
 * Model Grouping Utilities
 *
 * Functions for grouping models by provider.
 */

import type { ModelOption } from './ModelSelector';

/**
 * Group models by provider
 * @param models - List of models to group
 * @returns Record mapping provider names to arrays of models
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
