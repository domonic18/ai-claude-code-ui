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

// 导入 React 核心依赖
import React from 'react';
// 导入 Token 预算类型定义
import type { TokenBudget } from './TokenDisplay';
// 导入模型选择器状态管理 Hook，处理下拉菜单逻辑
import { useModelSelectorState } from './modelSelectorCallbacks';
// 导入样式工具函数，用于动态生成 CSS 类名
import { getTokenBadgeColorClasses, getButtonClasses, getModelItemClasses, getModelNameClasses } from './modelSelectorStyles';

/**
 * TokenBadge 组件 - 显示 Token 使用率百分比
 *
 * 根据使用率显示不同颜色：
 * - 绿色：< 50%
 * - 黄色：50% - 80%
 * - 红色：> 80%
 */
interface TokenBadgeProps {
  // Token 使用率百分比（0-100）
  tokenPercentage: number;
  // 鼠标悬停提示文本
  title: string;
}

function TokenBadge({ tokenPercentage, title }: TokenBadgeProps) {
  // 根据使用率获取对应的颜色类名
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
 * ModelSelectorButton 组件 - 模型选择器主按钮
 *
 * 显示当前选中的模型名称和下拉箭头图标
 * 点击后打开/关闭模型选择下拉菜单
 */
interface ModelSelectorButtonProps {
  // 模型列表是否已加载完成
  isModelsLoaded: boolean;
  // 当前选中的模型对象
  currentModel: import('./ModelSelector').ModelOption | null;
  // 下拉菜单是否打开
  isOpen: boolean;
  // 按钮是否禁用（加载中或不可用）
  disabled: boolean;
  // 按钮点击回调
  onClick: () => void;
}

function ModelSelectorButton({ isModelsLoaded, currentModel, isOpen, disabled, onClick }: ModelSelectorButtonProps) {
  // 获取按钮的样式类名（包含禁用状态样式）
  const buttonClasses = getButtonClasses(disabled);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={buttonClasses}
    >
      {/* 显示电脑图标（表示模型/硬件） */}
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      {/* 显示当前模型名称或加载状态 */}
      <span className="text-sm font-medium">
        {isModelsLoaded ? (currentModel?.name || 'Loading...') : 'Loading models...'}
      </span>
      {/* 下拉箭头图标（禁用状态不显示，打开时旋转 180 度） */}
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
