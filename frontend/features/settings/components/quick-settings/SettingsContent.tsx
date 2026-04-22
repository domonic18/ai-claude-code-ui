// 导入 React 核心库
import React from 'react';
// 导入 UI 图标组件，用于设置项的视觉标识
import {
  Maximize2,  // 最大化图标，用于自动展开工具设置
  Eye,        // 眼睛图标，用于显示原始参数设置
  Brain,      // 大脑图标，用于显示思考过程设置
  ArrowDown,  // 向下箭头图标，用于自动滚动到底部设置
  Languages,  // 语言图标，用于 Ctrl+Enter 发送消息设置
  Moon,       // 月亮图标，表示暗色模式
  Sun         // 太阳图标，表示亮色模式
} from 'lucide-react';
// 导入暗色模式切换组件
import DarkModeToggle from '@/shared/components/ui/DarkModeToggle';
// 导入主题上下文 Hook，用于获取当前主题模式
import { useTheme } from '@/shared/contexts/ThemeContext';
// 导入设置开关组件，用于渲染每个设置项
import SettingToggle from './SettingToggle';

/**
 * 快捷设置面板的内容区域组件
 * 组织了四个主要设置分组：外观、工具显示、视图选项和输入设置
 *
 * @param {Object} props - 组件属性
 * @param {boolean} props.autoExpandTools - 是否自动展开工具调用结果
 * @param {Function} props.onAutoExpandChange - 自动展开工具设置变更处理函数
 * @param {boolean} props.showRawParameters - 是否显示工具调用的原始参数
 * @param {Function} props.onShowRawParametersChange - 显示原始参数设置变更处理函数
 * @param {boolean} props.showThinking - 是否显示 AI 的思考过程（thinking 模式）
 * @param {Function} props.onShowThinkingChange - 显示思考过程设置变更处理函数
 * @param {boolean} props.autoScrollToBottom - 是否自动滚动到消息底部
 * @param {Function} props.onAutoScrollChange - 自动滚动设置变更处理函数
 * @param {boolean} props.sendByCtrlEnter - 是否使用 Ctrl+Enter 发送消息
 * @param {Function} props.onSendByCtrlEnterChange - Ctrl+Enter 发送设置变更处理函数
 */
export interface SettingsContentProps {
  autoExpandTools: boolean;                                 // 是否自动展开工具
  onAutoExpandChange: (checked: boolean) => void;           // 自动展开工具变更回调
  showRawParameters: boolean;                               // 是否显示原始参数
  onShowRawParametersChange: (checked: boolean) => void;    // 显示原始参数变更回调
  showThinking: boolean;                                    // 是否显示思考过程
  onShowThinkingChange: (checked: boolean) => void;         // 显示思考过程变更回调
  autoScrollToBottom: boolean;                              // 是否自动滚动到底部
  onAutoScrollChange: (checked: boolean) => void;           // 自动滚动变更回调
  sendByCtrlEnter: boolean;                                 // 是否使用 Ctrl+Enter 发送
  onSendByCtrlEnterChange: (checked: boolean) => void;      // Ctrl+Enter 发送变更回调
}

/**
 * 设置内容组件
 * 渲染快捷设置面板的所有设置项，分为四个主要区域
 */
const SettingsContent = ({
  autoExpandTools,           // 自动展开工具设置值
  onAutoExpandChange,        // 自动展开工具变更处理函数
  showRawParameters,         // 显示原始参数设置值
  onShowRawParametersChange, // 显示原始参数变更处理函数
  showThinking,              // 显示思考过程设置值
  onShowThinkingChange,      // 显示思考过程变更处理函数
  autoScrollToBottom,        // 自动滚动设置值
  onAutoScrollChange,        // 自动滚动变更处理函数
  sendByCtrlEnter,           // Ctrl+Enter 发送设置值
  onSendByCtrlEnterChange    // Ctrl+Enter 发送变更处理函数
}: SettingsContentProps) => {
  // 从主题上下文中获取当前是否为暗色模式
  const { isDarkMode } = useTheme();

  return (
    <>
      {/* 外观设置区域 */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Appearance</h4>
        {/* 暗色模式切换开关 */}
        <SettingToggle
          icon={isDarkMode ? Moon : Sun}  // 根据当前模式显示月亮或太阳图标
          label="Dark Mode"
          isCustomElement  // 标记为自定义元素，使用内部自定义渲染
        >
          <DarkModeToggle />
        </SettingToggle>
      </div>

      {/* 工具显示设置区域 */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Tool Display</h4>
        {/* 自动展开工具调用结果的开关 */}
        <SettingToggle
          icon={Maximize2}  // 最大化图标
          label="Auto-expand tools"
          checked={autoExpandTools}
          onChange={onAutoExpandChange}
        />
        {/* 显示工具调用原始参数的开关 */}
        <SettingToggle
          icon={Eye}  // 眼睛图标
          label="Show raw parameters"
          checked={showRawParameters}
          onChange={onShowRawParametersChange}
        />
        {/* 显示 AI 思考过程（thinking 模式）的开关 */}
        <SettingToggle
          icon={Brain}  // 大脑图标
          label="Show thinking"
          checked={showThinking}
          onChange={onShowThinkingChange}
        />
      </div>

      {/* 视图选项设置区域 */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">View Options</h4>
        {/* 自动滚动到消息底部的开关 */}
        <SettingToggle
          icon={ArrowDown}  // 向下箭头图标
          label="Auto-scroll to bottom"
          checked={autoScrollToBottom}
          onChange={onAutoScrollChange}
        />
      </div>

      {/* 输入设置区域 */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Input Settings</h4>
        {/* 使用 Ctrl+Enter 发送消息的开关 */}
        <SettingToggle
          icon={Languages}  // 语言图标
          label="Send by Ctrl+Enter"
          checked={sendByCtrlEnter}
          onChange={onSendByCtrlEnterChange}
        />
        {/* 功能说明文字：解释 Ctrl+Enter 发送的用途，特别对使用输入法（IME）的用户友好 */}
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-3">
          When enabled, pressing Ctrl+Enter will send the message instead of just Enter. This is useful for IME users to avoid accidental sends.
        </p>
      </div>
    </>
  );
};

export default SettingsContent;
