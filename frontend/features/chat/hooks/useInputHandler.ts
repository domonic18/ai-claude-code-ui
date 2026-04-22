/**
 * useInputHandler Hook
 *
 * Handles input changes with command and file reference detection.
 *
 * 核心功能：
 * 1. 检测用户输入的斜杠命令（/），触发命令自动完成菜单
 * 2. 检测用户输入的 @ 符号，触发文件引用自动完成菜单
 * 3. 处理命令和文件的选择、关闭等交互
 *
 * 检测逻辑：
 * - 斜杠命令：/ 必须在行首或前面是空白字符
 * - 文件引用：@ 后不能有空格（直到选择文件或输入空格结束引用）
 */

import { useCallback } from 'react';
import type { SlashCommand } from './useSlashCommands';
import type { FileReference } from './useFileReferences';

export interface UseInputHandlerOptions {
  /** Command menu state */
  commandMenu: {
    setSlashPosition: (pos: number) => void;
    setQuery: (query: string) => void;
    setSelectedIndex: (index: number) => void;
    setShowMenu: (show: boolean) => void;
    handleCommandSelect: (command: SlashCommand, index: number, isHover?: boolean) => void;
  };
  /** File menu state */
  fileMenu: {
    setAtPosition: (pos: number) => void;
    setQuery: (query: string) => void;
    setSelectedIndex: (index: number) => void;
    setShowMenu: (show: boolean) => void;
    handleFileSelect: (file: FileReference, index: number, isHover?: boolean) => void;
  };
  /** Set input value */
  setInput: (value: string) => void;
}

export interface UseInputHandlerResult {
  /** Handle input change with command and file reference detection */
  handleInputChangeWithCommands: (value: string, cursorPos: number) => void;
// ChatInput 组件使用此 hook 管理用户输入的处理、验证和提交
  /** Handle command selection wrapper */
  handleCommandSelectWrapper: (command: SlashCommand, index: number, isHover?: boolean) => void;
  /** Handle command menu close */
  handleCommandMenuClose: () => void;
// ChatInput 组件使用此 hook 管理用户输入的处理、验证和提交
  /** Handle file selection wrapper */
  handleFileSelectWrapper: (file: FileReference, index: number, input: string, atPosition: number, fileQuery: string, isHover?: boolean) => void;
  /** Handle file menu close */
  handleFileMenuClose: () => void;
}

// ChatInput 组件使用此 hook 管理用户输入的处理、验证和提交
/**
 * Hook for handling input changes with command and file reference detection
 *
 * @param options - Hook options
 * @returns Input handler functions
 */
export function useInputHandler(options: UseInputHandlerOptions): UseInputHandlerResult {
  const {
    commandMenu,
    fileMenu,
    setInput,
  } = options;

  const {
    setSlashPosition,
    setQuery: setCommandQuery,
    setSelectedIndex: setSelectedCommandIndex,
    setShowMenu: setShowCommandMenu,
    handleCommandSelect,
  } = commandMenu;

  // 从 fileMenu 配置中解构文件引用菜单的状态和处理函数
  const {
    setAtPosition,
    setQuery: setFileQuery,
    setSelectedIndex: setSelectedFileIndex,
    setShowMenu: setShowFileMenu,
    handleFileSelect,
  } = fileMenu;

  /**
   * Handle input change with command and file reference detection
   *
   * 实时检测用户输入，判断是否应该显示命令菜单或文件引用菜单：
   * 1. 提取光标前的文本
   * 2. 检测斜杠命令：匹配 /(^|\s)\/(\S*)$/ 模式
   * 3. 如果没有斜杠命令，检测 @ 文件引用
   * 4. 更新对应菜单的状态（显示/隐藏、查询内容、选中索引）
   */
  const handleInputChangeWithCommands = useCallback((value: string, cursorPos: number) => {
    setInput(value);

    // ========== 斜杠命令检测 ==========
    // Detect slash command at cursor position
    const textBeforeCursor = value.slice(0, cursorPos);

    // Find the last slash before cursor that could start a command
    // Slash is valid if it's at the start or preceded by whitespace
    const slashPattern = /(^|\s)\/(\S*)$/;
    const slashMatch = textBeforeCursor.match(slashPattern);

    // 如果匹配到斜杠命令模式，显示命令菜单
    if (slashMatch) {
      const slashPos = (slashMatch.index !== undefined ? slashMatch.index : 0) + slashMatch[1].length;
      const query = slashMatch[2];

      setSlashPosition(slashPos);
      setCommandQuery(query);
      setSelectedCommandIndex(0);
      setShowCommandMenu(true);
      setShowFileMenu(false);  // 互斥：显示命令菜单时隐藏文件菜单
      return;
    } else {
      setShowCommandMenu(false);
    }

    // ========== 文件引用检测 ==========
    // Detect file reference (@ symbol) at cursor position
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);

      // Check if there's a space after the @ symbol (which would end the file reference)
      // 如果 @ 后面有空格，说明文件引用已结束，不显示菜单
      if (!textAfterAt.includes(' ')) {
        setAtPosition(lastAtIndex);
        setFileQuery(textAfterAt);
        setSelectedFileIndex(0);
        setShowFileMenu(true);
      } else {
        setShowFileMenu(false);
      }
    } else {
      setShowFileMenu(false);
    }
  }, [setInput, setSlashPosition, setCommandQuery, setSelectedCommandIndex, setShowCommandMenu, setAtPosition, setFileQuery, setSelectedFileIndex, setShowFileMenu]);

  // ========== 菜单关闭处理 ==========
  /**
   * Handle command menu close
   *
   * 关闭命令菜单
   */
  const handleCommandMenuClose = useCallback(() => {
    setShowCommandMenu(false);
  }, [setShowCommandMenu]);

  /**
   * Handle file menu close
   *
   * 关闭文件引用菜单
   */
  const handleFileMenuClose = useCallback(() => {
    setShowFileMenu(false);
  }, [setShowFileMenu]);

  // ========== 菜单选择处理 ==========
  /**
   * Handle command selection wrapper
   * Delegates to the useSlashCommands hook's handleCommandSelect
   *
   * 命令选择的包装函数，委托给 useSlashCommands Hook 的处理函数
   */
  const handleCommandSelectWrapper = useCallback((command: SlashCommand, index: number, isHover?: boolean) => {
    handleCommandSelect(command, index, isHover);
  }, [handleCommandSelect]);

  /**
   * Handle file selection wrapper
   * Delegates to the useFileReferences hook's handleFileSelect
   *
   * 文件选择的包装函数，委托给 useFileReferences Hook 的处理函数
   * 并在用户点击选择时，将文件路径插入到输入框中（替换 @fileQuery）
   */
  const handleFileSelectWrapper = useCallback((file: FileReference, index: number, input: string, atPosition: number, fileQuery: string, isHover?: boolean) => {
    handleFileSelect(file, index, isHover);

    if (!isHover) {
      // Insert file reference into input
      const beforeFile = input.slice(0, atPosition);
      const afterFile = input.slice(atPosition + 1 + fileQuery.length);
      const newInput = `${beforeFile}@${file.relativePath} ${afterFile}`;
      setInput(newInput);
      setShowFileMenu(false);
    }
  }, [handleFileSelect, setInput, setShowFileMenu]);

  return {
    handleInputChangeWithCommands,
    handleCommandSelectWrapper,
    handleCommandMenuClose,
    handleFileSelectWrapper,
    handleFileMenuClose,
  };
}

export default useInputHandler;
