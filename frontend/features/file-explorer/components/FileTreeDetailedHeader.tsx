/**
 * FileTreeDetailedHeader.tsx
 *
 * Column headers for detailed view mode
 *
 * @module features/file-explorer/components/FileTreeDetailedHeader
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

// 由父组件调用，React 组件或常量：FileTreeDetailedHeader
/**
 * Column headers for detailed view
 */
export function FileTreeDetailedHeader() {
  const { t } = useTranslation();

  return (
    <div className="px-4 pt-2 pb-1 border-b border-border">
      <div className="grid grid-cols-12 gap-2 px-2 text-xs font-medium text-muted-foreground">
        <div className="col-span-4">{t('fileExplorer.column.name')}</div>
        <div className="col-span-2">{t('fileExplorer.column.size')}</div>
        <div className="col-span-3">{t('fileExplorer.column.modified')}</div>
        <div className="col-span-2">{t('fileExplorer.column.permissions')}</div>
        <div className="col-span-1"></div>
      </div>
    </div>
  );
}
