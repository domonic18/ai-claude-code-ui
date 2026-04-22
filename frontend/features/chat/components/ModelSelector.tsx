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

import React from 'react';
import type { TokenBudget } from './TokenDisplay';
import { useModelSelectorState } from './modelSelectorCallbacks';
import { getTokenBadgeColorClasses, getButtonClasses, getModelItemClasses, getModelNameClasses } from './modelSelectorStyles';

/**
 * TokenBadge component for displaying token budget percentage
 */
interface TokenBadgeProps {
  tokenPercentage: number;
  title: string;
}

function TokenBadge({ tokenPercentage, title }: TokenBadgeProps) {
  const colorClasses = getTokenBadgeColorClasses(tokenPercentage);

  return (
    <div
      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 text-xs font-bold transition-colors ${colorClasses}`}
      title={title}
    >
      {tokenPercentage}%
    </div>
  );
}

/**
 * ModelSelectorButton component for the main selector button
 */
interface ModelSelectorButtonProps {
  isModelsLoaded: boolean;
  currentModel: import('./ModelSelector').ModelOption | null;
  isOpen: boolean;
  disabled: boolean;
  onClick: () => void;
}

function ModelSelectorButton({ isModelsLoaded, currentModel, isOpen, disabled, onClick }: ModelSelectorButtonProps) {
  const buttonClasses = getButtonClasses(disabled);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClasses}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <span className="text-sm font-medium">
        {isModelsLoaded ? (currentModel?.name || 'Loading...') : 'Loading models...'}
      </span>
      {!disabled && (
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </button>
  );
}

/**
 * ModelDropdown component for the model selection dropdown
 */
interface ModelDropdownProps {
  isOpen: boolean;
  disabled: boolean;
  isModelsLoaded: boolean;
  groupedModels: Record<string, import('./ModelSelector').ModelOption[]>;
  selectedModel?: string;
  onModelSelect?: (modelName: string) => void;
  t: (key: string, params?: any) => string;
}

function ModelDropdown({
  isOpen,
  disabled,
  isModelsLoaded,
  groupedModels,
  selectedModel,
  onModelSelect,
  t
}: ModelDropdownProps) {
  if (!isOpen || disabled) return null;

  const handleSelect = (modelName: string) => {
    onModelSelect?.(modelName);
  };

  return (
    <div className="absolute z-50 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
      {isModelsLoaded ? (
        Object.entries(groupedModels).map(([provider, providerModels]) => (
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
                key={model.name}
                type="button"
                onClick={() => handleSelect(model.name)}
                className={getModelItemClasses(model.name === selectedModel)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <p className={getModelNameClasses(model.name === selectedModel)}>
                      {model.name}
                    </p>
                    {model.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {model.description}
                      </p>
                    )}
                    {model.contextWindow && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t('chat.context', { tokens: model.contextWindow.toLocaleString() })}
                      </p>
                    )}
                  </div>
                  {model.name === selectedModel && (
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))
      ) : (
        <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
          Loading models...
        </div>
      )}
    </div>
  );
}

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

// 由父组件调用，React 组件或常量：ModelSelector
/**
 * ModelSelector Component
 */
export function ModelSelector({
  selectedModel,
  models,
  onModelSelect,
  disabled = false,
  compact = false,
  tokenBudget,
}: ModelSelectorProps) {
  const {
    isModelsLoaded,
    currentModel,
    tokenPercentage,
    groupedModels,
    handleSelect,
    isOpen,
    setIsOpen,
    dropdownRef,
    t
  } = useModelSelectorState(selectedModel, models, onModelSelect, tokenBudget);

  if (compact) {
    return (
      <div className="inline-flex items-center px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
        {currentModel?.name}
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-3" ref={dropdownRef}>
      <ModelSelectorButton
        isModelsLoaded={isModelsLoaded}
        currentModel={currentModel}
        isOpen={isOpen}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      />

      {tokenPercentage !== null && (
        <TokenBadge
          tokenPercentage={tokenPercentage}
          title={t('chat.tokenUsage', { percentage: tokenPercentage })}
        />
      )}

      <ModelDropdown
        isOpen={isOpen}
        disabled={disabled}
        isModelsLoaded={isModelsLoaded}
        groupedModels={groupedModels}
        selectedModel={selectedModel}
        onModelSelect={handleSelect}
        t={t}
      />
    </div>
  );
}

export default ModelSelector;
