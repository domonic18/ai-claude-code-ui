import React from 'react';
import { LucideIcon } from 'lucide-react';

/**
 * Reusable settings toggle row component
 * @param {Object} props - Component props
 * @param {LucideIcon} props.icon - Icon component to display
 * @param {string} props.label - Label text for the setting
 * @param {boolean} props.checked - Current checked state
 * @param {Function} props.onChange - Change handler
 * @param {boolean} props.isCustomElement - Whether to use custom element instead of checkbox
 */
interface SettingToggleProps {
  icon: LucideIcon;
  label: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  isCustomElement?: boolean;
  children?: React.ReactNode;
}

/**
 * 设置行组件：图标 + 标签 + checkbox，支持自定义子元素模式
 */
const SettingToggle = ({
  icon: Icon,
  label,
  checked,
  onChange,
  isCustomElement = false,
  children
}: SettingToggleProps) => {
  const content = (
    <>
      <span className="flex items-center gap-2 text-sm text-gray-900 dark:text-white">
        <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        {label}
      </span>
      {children || (onChange && (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 focus:ring-2 dark:focus:ring-blue-400 bg-gray-100 dark:bg-gray-800 checked:bg-blue-600 dark:checked:bg-blue-600"
        />
      ))}
    </>
  );

  const baseClassName = "flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-transparent hover:border-gray-300 dark:hover:border-gray-600";

  if (isCustomElement || !onChange) {
    return <div className={baseClassName}>{content}</div>;
  }

  return <label className={baseClassName + ' cursor-pointer'}>{content}</label>;
};

export default SettingToggle;
