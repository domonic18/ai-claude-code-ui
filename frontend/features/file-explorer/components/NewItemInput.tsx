import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderPlus, FilePlus, Check, XCircle } from 'lucide-react';
import { isValidFileName } from '../utils/fileTreeHelpers';

interface NewItemInputProps {
  type: 'folder' | 'file';
  name: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  selectedFolderName?: string | null;
  disabled?: boolean;
}

/**
 * 新建文件/文件夹输入组件
 */
export function NewItemInput({
  type,
  name,
  onChange,
  onConfirm,
  onCancel,
  selectedFolderName,
  disabled = false
}: NewItemInputProps) {
  const { t } = useTranslation();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isValidFileName(name.trim())) {
        alert(t('fileExplorer.new.error', {
          message: t('fileExplorer.new.invalidName')
        }));
        return;
      }
      onConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const locationText = selectedFolderName || t('fileExplorer.new.root');
  const hintText = type === 'folder'
    ? t('fileExplorer.new.folderHint', { location: locationText })
    : t('fileExplorer.new.fileHint', { location: locationText });

  return (
    <div
      className="flex items-center gap-2 p-2 bg-accent rounded-md"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {type === 'folder' ? (
        <FolderPlus className="w-4 h-4 text-blue-500 flex-shrink-0" />
      ) : (
        <FilePlus className="w-4 h-4 text-green-500 flex-shrink-0" />
      )}
      <input
        type="text"
        placeholder={type === 'folder'
          ? t('fileExplorer.new.folderPlaceholder')
          : t('fileExplorer.new.filePlaceholder')
        }
        value={name}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="h-7 px-2 text-sm flex-1 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
        autoFocus
        disabled={disabled}
      />
      <div
        className="text-xs text-muted-foreground flex-shrink-0 min-w-0 max-w-32 truncate"
        onClick={(e) => e.stopPropagation()}
      >
        {hintText}
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button
          type="button"
          className="h-8 px-3 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          onMouseDown={(e) => { e.stopPropagation(); onConfirm(); }}
          disabled={disabled}
          title={t('fileExplorer.rename.confirm')}
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="h-8 px-3 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          onMouseDown={(e) => { e.stopPropagation(); onCancel(); }}
          disabled={disabled}
          title={t('fileExplorer.rename.cancel')}
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default NewItemInput;
