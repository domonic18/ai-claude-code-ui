/**
 * useKeyboardHandler Hook
 *
 * Handles keyboard events for command menu, file menu, and message sending.
 */

// 导入 useCallback Hook，用于优化事件处理器性能
import { useCallback } from 'react';
// 导入斜杠命令类型定义
import type { SlashCommand } from './useSlashCommands';
// 导入文件引用类型定义
import type { FileReference } from './useFileReferences';

/**
 * 菜单导航接口（泛型）
 *
 * 适用于命令菜单和文件菜单的通用导航结构
 *
 * @template T - 菜单项类型（SlashCommand 或 FileReference）
 */
interface MenuNavigation<T> {
  // 菜单项列表
  items: T[];
  // 当前选中的索引
  selectedIndex: number;
  // 选中回调函数（支持键盘导航和鼠标悬停）
  onSelect: (item: T, index: number, isHover?: boolean) => void;
  // 关闭菜单回调函数
  onClose: () => void;
}

/**
 * 处理通用菜单的键盘导航
 *
 * 支持以下快捷键：
 * - ArrowDown: 下移选中项
 * - ArrowUp: 上移选中项
 * - Enter: 确认选择当前项
 * - Escape: 关闭菜单
 *
 * @param menu - 菜单导航配置对象
 * @param e - 键盘事件对象
 * @returns 是否成功处理了该按键
 */
function handleMenuNavigation<T>(
  menu: MenuNavigation<T>,
  e: React.KeyboardEvent
): boolean {
  switch (e.key) {
    case 'ArrowDown':
      // 向下箭头：移动到下一项
      e.preventDefault();
      if (menu.items.length > 0) {
        // 确保索引不超过列表范围
        const nextIndex = Math.min(menu.selectedIndex + 1, menu.items.length - 1);
        menu.onSelect(menu.items[nextIndex], nextIndex, true);
      }
      return true;
    case 'ArrowUp':
      // 向上箭头：移动到上一项
      e.preventDefault();
      if (menu.items.length > 0) {
        // 确保索引不小于 0
        const prevIndex = Math.max(menu.selectedIndex - 1, 0);
        menu.onSelect(menu.items[prevIndex], prevIndex, true);
      }
      return true;
    case 'Enter':
      // 回车键：确认选择当前项
      e.preventDefault();
      if (menu.selectedIndex >= 0 && menu.selectedIndex < menu.items.length) {
        menu.onSelect(menu.items[menu.selectedIndex], menu.selectedIndex);
      }
      return true;
    case 'Escape':
      // ESC 键：关闭菜单
      e.preventDefault();
      menu.onClose();
      return true;
    default:
      // 其他按键：不处理，返回 false
      return false;
  }
}

export interface KeyboardHandlerOptions {
  /** 是否使用 Ctrl+Enter 发送消息（默认为 Enter 发送） */
  sendByCtrlEnter?: boolean;
  /** 发送消息的回调函数 */
  onSend?: () => void;
  /** 命令菜单状态配置 */
  commandMenu?: {
    isOpen: boolean;
    commands: SlashCommand[];
    selectedIndex: number;
    onSelect: (command: SlashCommand, index: number, isHover?: boolean) => void;
    onClose: () => void;
  };
  /** 文件菜单状态配置 */
  fileMenu?: {
    isOpen: boolean;
    files: FileReference[];
    selectedIndex: number;
    onSelect: (file: FileReference, index: number, isHover?: boolean) => void;
    onClose: () => void;
  };
}

export interface KeyboardHandlerResult {
  /** 键盘按下事件处理器 */
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

// 由组件调用，自定义 Hook：useKeyboardHandler
/**
 * 键盘事件处理 Hook
 *
 * 统一处理聊天输入框的所有键盘交互：
 * - 命令菜单导航（↑↓Enter ESC）
 * - 文件菜单导航（↑↓Enter ESC）
 * - 消息发送快捷键（Enter 或 Ctrl+Enter）
 *
 * @param options - 处理器配置选项
 * @returns 键盘事件处理器对象
 */
export function useKeyboardHandler(options: KeyboardHandlerOptions): KeyboardHandlerResult {
  const {
    sendByCtrlEnter = false,
    onSend,
    commandMenu,
    fileMenu,
  } = options;

  /**
   * 键盘按下事件处理器
   *
   * 优先级：命令菜单 > 文件菜单 > 消息发送
   * 使用 useCallback 优化性能，避免每次渲染都重新创建函数
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 优先处理命令菜单导航（如果打开）
    if (commandMenu?.isOpen) {
      const handled = handleMenuNavigation({
        items: commandMenu.commands,
        selectedIndex: commandMenu.selectedIndex,
        onSelect: commandMenu.onSelect,
        onClose: commandMenu.onClose,
      }, e);
      // 如果按键已处理，终止后续逻辑
      if (handled) return;
    }

    // 其次处理文件菜单导航（如果打开）
    if (fileMenu?.isOpen) {
      const handled = handleMenuNavigation({
        items: fileMenu.files,
        selectedIndex: fileMenu.selectedIndex,
        onSelect: fileMenu.onSelect,
        onClose: fileMenu.onClose,
      }, e);
      // 如果按键已处理，终止后续逻辑
      if (handled) return;
    }

    // 最后处理消息发送快捷键
    if (e.key === 'Enter' && !e.shiftKey) {
      // 根据配置判断是否应该发送消息
      const shouldSend = sendByCtrlEnter
        ? (e.ctrlKey || e.metaKey)  // Ctrl+Enter 模式：需要按住 Ctrl
        : !(e.ctrlKey || e.metaKey); // Enter 模式：不能按 Ctrl

      if (shouldSend) {
        e.preventDefault();  // 阻止默认的换行行为
        onSend?.();          // 触发发送回调
      }
    }
  }, [sendByCtrlEnter, onSend, commandMenu, fileMenu]);

  return { handleKeyDown };
}

export default useKeyboardHandler;
