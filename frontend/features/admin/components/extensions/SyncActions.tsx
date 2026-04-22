/**
 * SyncActions - 扩展同步操作控制面板
 *
 * 提供两种同步模式按钮和同步结果展示：
 * 1. 保留用户文件同步：将预置扩展复制到所有用户目录，不覆盖已有文件
 * 2. 强制覆盖同步：覆盖所有用户的扩展文件（橙色警告样式）
 *
 * @module features/admin/components/extensions/SyncActions
 */

import React from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import type { SyncResults } from './types';

/**
 * SyncActions 组件属性
 */
interface SyncActionsProps {
  /** 同步操作是否进行中 */
  syncing: boolean;
  /** 最近一次同步结果（null 表示尚未同步过） */
  syncResults: SyncResults | null;
  /** 触发同步的回调函数，参数 overwrite 控制是否覆盖用户文件 */
  onSync: (overwrite: boolean) => void;
}

/**
 * 同步操作组件
 * 提供"保留用户文件同步"和"强制覆盖同步"两个按钮，同步完成后展示结果摘要
 */
export function SyncActions({ syncing, syncResults, onSync }: SyncActionsProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">同步操作</h2>
      {/* 两个同步按钮：普通同步（保留用户文件）和强制覆盖同步 */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* 普通同步按钮：保留用户已有文件，仅添加新扩展 */}
        <SyncButton
          syncing={syncing}
          overwrite={false}
          onClick={() => onSync(false)}
        />
        {/* 强制覆盖按钮：覆盖所有用户的扩展文件 */}
        <SyncButton
          syncing={syncing}
          overwrite={true}
          onClick={() => onSync(true)}
        />
      </div>

      {/* 同步完成后渲染结果面板：成功/失败统计 + 失败用户列表 */}
      {syncResults && <SyncResultDisplay results={syncResults} />}
    </div>
  );
}

/**
 * 内部同步按钮组件
 * 根据 overwrite 参数切换按钮样式和文案，同步中禁用并展示旋转动画
 */
function SyncButton({ syncing, overwrite, onClick }: {
  syncing: boolean;
  overwrite: boolean;
  onClick: () => void;
}) {
  // 强制覆盖模式使用橙色警告样式，普通模式使用主题色
  const baseClass = overwrite
    ? 'bg-orange-600 hover:bg-orange-700'
    : 'bg-primary hover:bg-primary/90';

  return (
    <button
      onClick={onClick}
      // 同步进行中禁用按钮，防止重复点击
      disabled={syncing}
      className={`px-4 py-2 text-primary-foreground rounded-md disabled:bg-muted disabled:cursor-not-allowed disabled:text-muted-foreground transition-colors flex items-center justify-center gap-2 ${baseClass}`}
    >
      {/* 同步中时图标旋转，提示用户操作正在进行 */}
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

/**
 * 内部同步结果展示组件
 * 显示同步成功/失败统计，失败时列出每个失败用户的 ID 和错误信息
 */
function SyncResultDisplay({ results }: { results: SyncResults }) {
  return (
    <div className="mt-4 p-4 bg-muted border border-border rounded-md">
      <div className="flex items-center gap-2 mb-2">
        {/* 全部成功显示绿色勾号，有失败显示红色叉号 */}
        {results.failed === 0
          ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          : <XCircle className="w-5 h-5 text-destructive" />
        }
        <span className="font-medium text-foreground">
          同步完成：{results.synced}/{results.total} 用户成功
        </span>
      </div>
      {/* 有失败用户时展示错误列表 */}
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
