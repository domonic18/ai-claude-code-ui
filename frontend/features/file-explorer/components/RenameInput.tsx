/**
 * RenameInput.tsx
 *
 * File/directory rename input component
 *
 * @module features/file-explorer/components/RenameInput
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/shared/components/ui/Input';
import { Check, XCircle } from 'lucide-react';
import { isValidFileName } from '../utils/fileTreeHelpers';

/**
 * Props for RenameInput component
 */
export interface RenameInputProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
  width?: string;
}

/**
 * 重命名输入组件
 */
export function RenameInput({
  value,
  onChange,
  onConfirm,
  onCancel,
  disabled = false,
  width = 'w-40'
}: RenameInputProps) {
  const { t } = useTranslation();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isValidFileName(value.trim())) {
        return;
      }
      onConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <>
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={`h-6 px-1 py-0 text-sm ${width}`}
        autoFocus
        disabled={disabled}
      />
      <button
        type="button"
        className="h-6 w-6 p-0 flex items-center justify-center rounded hover:bg-green-600 hover:text-white disabled:opacity-50"
        onClick={(e) => { e.stopPropagation(); onConfirm(); }}
        disabled={disabled}
        title={t('fileExplorer.rename.confirm')}
      >
        <Check className="w-3 h-3" />
      </button>
      <button
        type="button"
        className="h-6 w-6 p-0 flex items-center justify-center rounded hover:bg-gray-600 hover:text-white disabled:opacity-50"
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        disabled={disabled}
        title={t('fileExplorer.rename.cancel')}
      >
        <XCircle className="w-3 h-3" />
      </button>
    </>
  );
}

export default RenameInput;
