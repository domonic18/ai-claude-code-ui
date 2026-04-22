import React from 'react';
import {
  Maximize2,
  Eye,
  Brain,
  ArrowDown,
  Languages,
  Moon,
  Sun
} from 'lucide-react';
import DarkModeToggle from '@/shared/components/ui/DarkModeToggle';
import { useTheme } from '@/shared/contexts/ThemeContext';
import SettingToggle from './SettingToggle';

/**
 * Settings content sections for QuickSettingsPanel
 * @param {Object} props - Component props
 * @param {boolean} props.autoExpandTools - Auto-expand tools setting
 * @param {Function} props.onAutoExpandChange - Auto-expand tools change handler
 * @param {boolean} props.showRawParameters - Show raw parameters setting
 * @param {Function} props.onShowRawParametersChange - Show raw parameters change handler
 * @param {boolean} props.showThinking - Show thinking setting
 * @param {Function} props.onShowThinkingChange - Show thinking change handler
 * @param {boolean} props.autoScrollToBottom - Auto-scroll to bottom setting
 * @param {Function} props.onAutoScrollChange - Auto-scroll change handler
 * @param {boolean} props.sendByCtrlEnter - Send by Ctrl+Enter setting
 * @param {Function} props.onSendByCtrlEnterChange - Send by Ctrl+Enter change handler
 */
export interface SettingsContentProps {
  autoExpandTools: boolean;
  onAutoExpandChange: (checked: boolean) => void;
  showRawParameters: boolean;
  onShowRawParametersChange: (checked: boolean) => void;
  showThinking: boolean;
  onShowThinkingChange: (checked: boolean) => void;
  autoScrollToBottom: boolean;
  onAutoScrollChange: (checked: boolean) => void;
  sendByCtrlEnter: boolean;
  onSendByCtrlEnterChange: (checked: boolean) => void;
}

const SettingsContent = ({
  autoExpandTools,
  onAutoExpandChange,
  showRawParameters,
  onShowRawParametersChange,
  showThinking,
  onShowThinkingChange,
  autoScrollToBottom,
  onAutoScrollChange,
  sendByCtrlEnter,
  onSendByCtrlEnterChange
}: SettingsContentProps) => {
  const { isDarkMode } = useTheme();

  return (
    <>
      {/* Appearance Settings */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Appearance</h4>
        <SettingToggle
          icon={isDarkMode ? Moon : Sun}
          label="Dark Mode"
          isCustomElement
        >
          <DarkModeToggle />
        </SettingToggle>
      </div>

      {/* Tool Display Settings */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Tool Display</h4>
        <SettingToggle
          icon={Maximize2}
          label="Auto-expand tools"
          checked={autoExpandTools}
          onChange={onAutoExpandChange}
        />
        <SettingToggle
          icon={Eye}
          label="Show raw parameters"
          checked={showRawParameters}
          onChange={onShowRawParametersChange}
        />
        <SettingToggle
          icon={Brain}
          label="Show thinking"
          checked={showThinking}
          onChange={onShowThinkingChange}
        />
      </div>

      {/* View Options */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">View Options</h4>
        <SettingToggle
          icon={ArrowDown}
          label="Auto-scroll to bottom"
          checked={autoScrollToBottom}
          onChange={onAutoScrollChange}
        />
      </div>

      {/* Input Settings */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Input Settings</h4>
        <SettingToggle
          icon={Languages}
          label="Send by Ctrl+Enter"
          checked={sendByCtrlEnter}
          onChange={onSendByCtrlEnterChange}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 ml-3">
          When enabled, pressing Ctrl+Enter will send the message instead of just Enter. This is useful for IME users to avoid accidental sends.
        </p>
      </div>
    </>
  );
};

export default SettingsContent;
