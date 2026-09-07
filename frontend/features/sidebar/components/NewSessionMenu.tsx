/**
 * NewSessionMenu Component
 *
 * "新建会话" + 号的弹出二选一菜单：选择新会话的引擎归属。
 * - Claude Agent：全功能 Agent 会话（技能/工具/权限，与现状一致）
 * - 直连模型：选模型直接对话，秒速响应（无 agent 能力）
 *
 * 会话从创建起单模式归属（方案决策三：两套会话完全独立，不混写）。
 *
 * 定位说明：使用 fixed 定位（按锚点按钮的视口坐标计算）而非 absolute——
 * 侧栏祖先容器（AppSidebar）带 overflow-hidden，absolute 弹层超出侧栏
 * 底部/右缘时会被裁剪（z-index 无法穿透 overflow 裁剪），fixed 不受影响。
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Sparkles } from 'lucide-react';

export type NewSessionMode = 'claude' | 'direct';

interface NewSessionMenuProps {
  /** 锚点按钮 ref（菜单按其视口坐标定位） */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** 选择模式后的回调（父组件负责创建对应模式的会话并关闭菜单） */
  onSelect: (mode: NewSessionMode) => void;
  /** 菜单关闭回调（点击外部/完成选择时由父组件复位状态） */
  onClose: () => void;
}

/** 菜单宽度（px），用于视口右缘翻转计算 */
const MENU_WIDTH = 248;

/**
 * NewSessionMenu：二选一弹层（fixed 定位，锚定 + 号按钮下方）。
 */
export function NewSessionMenu({ anchorRef, onSelect, onClose }: NewSessionMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // 按锚点按钮的视口坐标计算弹层位置（右缘超出时向左翻转）
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8));
    setPosition({ top: rect.bottom + 4, left });
  }, [anchorRef]);

  // 点击菜单外部关闭（对齐 ProjectList 三点菜单行为）
  useEffect(() => {
    if (!position) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    // mousedown 延迟到下一帧注册：避免本次打开菜单的点击立刻触发关闭
    const raf = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside);
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, anchorRef, position]);

  if (!position) return null;

  const itemClass =
    'w-full px-3 py-2 flex items-start gap-2.5 hover:bg-accent/50 transition-colors text-left';

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: position.top, left: position.left, width: MENU_WIDTH }}
      className="bg-card border border-border rounded-md shadow-lg z-[100] overflow-hidden"
    >
      <button
        type="button"
        className={itemClass}
        onClick={(e) => {
          // 阻止冒泡到项目头部行：头部行 onClick 会 onSelectProject → 自动选中
          // 第一个会话，把刚清掉的 selectedSession 塞回（新建空白被旧会话回填）
          e.stopPropagation();
          onSelect('claude');
        }}
      >
        <Sparkles className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
        <span>
          <span className="block text-sm font-medium text-foreground">{t('sidebar.newSessionClaude')}</span>
          <span className="block text-xs text-muted-foreground">{t('sidebar.newSessionClaudeDesc')}</span>
        </span>
      </button>
      <button
        type="button"
        className={itemClass}
        onClick={(e) => {
          // 同上：阻止冒泡到项目头部行，保护新建空白态
          e.stopPropagation();
          onSelect('direct');
        }}
      >
        <Zap className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
        <span>
          <span className="block text-sm font-medium text-foreground">{t('sidebar.newSessionDirect')}</span>
          <span className="block text-xs text-muted-foreground">{t('sidebar.newSessionDirectDesc')}</span>
        </span>
      </button>
    </div>
  );
}

export default NewSessionMenu;
