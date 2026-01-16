/**
 * ModelSelector Component
 *
 * Dropdown for selecting AI model.
 * Supports multiple providers (Claude, OpenAI, etc.)
 *
 * Features:
 * - Model selection dropdown
 * - Provider grouping
 * - Model descriptions
 * - Context window display
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CLAUDE_MODELS } from '../../../../shared/modelConstants';
import type { TokenBudget } from './TokenDisplay';

export interface ModelOption {
  /** Model identifier */
  id: string;
  /** Display name */
  name: string;
  /** Provider (claude, openai, etc.) */
  provider: string;
  /** Context window size */
  contextWindow?: number;
  /** Description */
  description?: string;
  /** Maximum output tokens */
  maxTokens?: number;
}

interface ModelSelectorProps {
  /** Currently selected model */
  selectedModel?: string;
  /** Available models */
  models?: ModelOption[];
  /** Selection callback */
  onModelSelect?: (modelId: string) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Compact display */
  compact?: boolean;
  /** Token budget data for badge display */
  tokenBudget?: TokenBudget | null;
}

/**
 * ModelSelector Component
 */
export function ModelSelector({
  selectedModel = `claude-${CLAUDE_MODELS.DEFAULT}`,
  models = DEFAULT_MODELS,
  onModelSelect,
  disabled = false,
  compact = false,
  tokenBudget,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Find current model
  const currentModel = models.find(m => m.id === selectedModel) || models[0];

  // Calculate token percentage for badge
  const tokenPercentage = React.useMemo(() => {
    if (tokenBudget?.percentage !== undefined) {
      return tokenBudget.percentage;
    }
    if (tokenBudget?.total && tokenBudget?.used !== undefined) {
      return Math.round((tokenBudget.used / tokenBudget.total) * 100);
    }
    return null;
  }, [tokenBudget]);

  /**
   * Group models by provider
   */
  const groupedModels = React.useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};
    models.forEach(model => {
      if (!groups[model.provider]) {
        groups[model.provider] = [];
      }
      groups[model.provider].push(model);
    });
    return groups;
  }, [models]);

  /**
   * Handle model selection
   */
  const handleSelect = useCallback((modelId: string) => {
    onModelSelect?.(modelId);
    setIsOpen(false);
  }, [onModelSelect]);

  /**
   * Close dropdown when clicking outside
   */
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

  // Compact version (just a badge)
  if (compact) {
    return (
      <div className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
        {currentModel.name}
      </div>
    );
  }

  // Full version with dropdown
  return (
    <div className="relative flex items-center gap-3" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
          ${disabled
            ? 'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer'
          }
        `}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-medium">{currentModel.name}</span>
        {!disabled && (
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Token budget badge */}
      {tokenPercentage !== null && (
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-full border-2 text-xs font-bold transition-colors
            ${tokenPercentage >= 90
              ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
              : tokenPercentage >= 70
              ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
              : 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
            }
          `}
          title={`Token usage: ${tokenPercentage}%`}
        >
          {tokenPercentage}%
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <div key={provider}>
              {/* Provider header */}
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                  {provider}
                </p>
              </div>

              {/* Models */}
              {providerModels.map(model => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => handleSelect(model.id)}
                  className={`
                    w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors
                    ${model.id === selectedModel
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500'
                      : 'border-l-4 border-transparent'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${model.id === selectedModel ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                        {model.name}
                      </p>
                      {model.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {model.description}
                        </p>
                      )}
                      {model.contextWindow && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Context: {model.contextWindow.toLocaleString()} tokens
                        </p>
                      )}
                    </div>
                    {model.id === selectedModel && (
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Convert shared model constants to ModelOption format
 */
const DEFAULT_MODELS: ModelOption[] = [
  // Claude models only
  ...CLAUDE_MODELS.OPTIONS.map(opt => ({
    id: `claude-${opt.value}`,
    name: opt.value === 'custom' ? 'Custom' : opt.label,
    provider: 'Claude',
    description: opt.value === 'custom' ? undefined : undefined,
  })),
];

export default ModelSelector;
