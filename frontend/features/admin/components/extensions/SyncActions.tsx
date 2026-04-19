/**
 * SyncActions - Sync controls and result display for extension management
 *
 * @module features/admin/components/extensions/SyncActions
 */

import React from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import type { SyncResults } from './types';

interface SyncActionsProps {
  /** Whether sync is in progress */
  syncing: boolean;
  /** Results from last sync operation */
  syncResults: SyncResults | null;
  /** Trigger sync with overwrite option */
  onSync: (overwrite: boolean) => void;
}

/**
 * Renders sync action buttons and sync result summary
 */
export function SyncActions({ syncing, syncResults, onSync }: SyncActionsProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">同步操作</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <SyncButton
          syncing={syncing}
          overwrite={false}
          onClick={() => onSync(false)}
        />
        <SyncButton
          syncing={syncing}
          overwrite={true}
          onClick={() => onSync(true)}
        />
      </div>

      {syncResults && <SyncResultDisplay results={syncResults} />}
    </div>
  );
}

/** Internal sync button with loading state */
function SyncButton({ syncing, overwrite, onClick }: {
  syncing: boolean;
  overwrite: boolean;
  onClick: () => void;
}) {
  const baseClass = overwrite
    ? 'bg-orange-600 hover:bg-orange-700'
    : 'bg-primary hover:bg-primary/90';

  return (
    <button
      onClick={onClick}
      disabled={syncing}
      className={`px-4 py-2 text-primary-foreground rounded-md disabled:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground transition-colors flex items-center justify-center gap-2 ${baseClass}`}
    >
      <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
      {syncing
        ? '同步中...'
        : overwrite
          ? '强制覆盖所有用户文件'
          : '同步到所有用户（保留用户文件）'
      }
    </button>
  );
}

/** Internal component for displaying sync results */
function SyncResultDisplay({ results }: { results: SyncResults }) {
  return (
    <div className="mt-4 p-4 bg-muted border border-border rounded-md">
      <div className="flex items-center gap-2 mb-2">
        {results.failed === 0
          ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          : <XCircle className="w-5 h-5 text-destructive" />
        }
        <span className="font-medium text-foreground">
          同步完成：{results.synced}/{results.total} 用户成功
        </span>
      </div>
      {results.failed > 0 && (
        <div className="mt-2">
          <p className="text-sm text-destructive font-medium mb-1">失败的用户：</p>
          <ul className="text-sm text-muted-foreground list-disc list-inside">
            {results.errors.map((err, idx) => (
              <li key={idx}>
                用户 {err.userId} ({err.username}): {err.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
