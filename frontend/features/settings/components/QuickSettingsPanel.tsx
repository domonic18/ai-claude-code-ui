import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SettingsContent from './quick-settings/SettingsContent';
import SettingsPanelLayout from './quick-settings/SettingsPanelLayout';

/**
 * Quick settings panel component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the panel is open
 * @param {Function} props.onToggle - Toggle handler
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
 * @param {boolean} props.isMobile - Whether in mobile view
 */
/**
 * 快捷设置面板：右侧拉手导航 + 遮罩层，聚合各项聊天行为偏好开关
 */
const QuickSettingsPanel = ({
  isOpen,
  onToggle,
  isMobile,
  ...settingsProps
}) => {
  const [localIsOpen, setLocalIsOpen] = useState(isOpen);

  useEffect(() => {
    setLocalIsOpen(isOpen);
  }, [isOpen]);

  const handleToggle = () => {
    const newState = !localIsOpen;
    setLocalIsOpen(newState);
    onToggle(newState);
  };

  return (
    <>
      {/* Pull Tab */}
      <div
        className={`fixed ${isMobile ? 'bottom-44' : 'top-1/2 -translate-y-1/2'} ${
          localIsOpen ? 'right-64' : 'right-0'
        } z-50 transition-all duration-150 ease-out`}
      >
        <button
          onClick={handleToggle}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-lg"
          aria-label={localIsOpen ? 'Close settings panel' : 'Open settings panel'}
        >
          {localIsOpen ? (
            <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>
      </div>

      {/* Panel */}
      <SettingsPanelLayout isOpen={localIsOpen} isMobile={isMobile}>
        <SettingsContent {...settingsProps} />
      </SettingsPanelLayout>

      {/* Backdrop */}
      {localIsOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 transition-opacity duration-150 ease-out"
          onClick={handleToggle}
        />
      )}
    </>
  );
};

export default QuickSettingsPanel;