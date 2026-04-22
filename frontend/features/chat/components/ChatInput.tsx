/**
 * ChatInput Component (Refactored)
 *
 * Handles user input with modular hooks and components.
 * This component now uses specialized hooks for keyboard handling and menu positioning.
 *
 * 组件职责：
 * 1. 管理用户输入状态（文本、焦点、拖拽等）
 * 2. 处理键盘事件（Enter 发送、Ctrl+Enter 发送、菜单导航）
 * 3. 集成斜杠命令和文件引用自动完成功能
 * 4. 支持文件附件上传和预览
 * 5. 自动调整输入框高度（多行文本）
 *
 * 架构设计：
 * - useChatInputState: 管理输入框状态（焦点、光标位置、拖拽状态）
 * - useChatInputSetup: 配置键盘处理和菜单定位
 * - ChatInputWrapper: 渲染输入框 UI（文本框、附件预览、菜单等）
 */

import { useTranslation } from 'react-i18next';
import { ChatInputWrapper } from './ChatInputWrapper';
import { useChatInputState, useChatInputSetup } from '../hooks';
import type { ChatInputProps, FileAttachment } from '../types';
import { MAX_FILE_SIZE } from '../constants';

import type { SlashCommand } from '../hooks/useSlashCommands';
import type { FileReference } from '../hooks/useFileReferences';

interface ChatInputComponentProps extends Omit<ChatInputProps, 'files' | 'onAddFile' | 'onRemoveFile'> {
  /** Attached files */
  files?: FileAttachment[];
  /** Add file callback */
  onAddFile?: (file: FileAttachment) => void;
  /** Remove file callback */
  onRemoveFile?: (fileId: string) => void;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Minimum rows for textarea */
  minRows?: number;
  /** Maximum rows for textarea */
  maxRows?: number;
  /** Command system props */
  commands?: SlashCommand[];
  frequentCommands?: SlashCommand[];
  commandMenuOpen?: boolean;
  commandQuery?: string;
  selectedCommandIndex?: number;
  slashPosition?: number;
  onCommandSelect?: (command: SlashCommand, index: number, isHover?: boolean) => void;
  onCommandMenuClose?: () => void;
  /** File reference system props */
  fileReferences?: FileReference[];
  fileMenuOpen?: boolean;
  fileQuery?: string;
  selectedFileIndex?: number;
  atPosition?: number;
  onFileSelect?: (file: FileReference, index: number, isHover?: boolean) => void;
  onFileMenuClose?: () => void;
  filesLoading?: boolean;
  /** Authenticated fetch function */
  authenticatedFetch?: (url: string, options?: RequestInit) => Promise<Response>;
  /** Selected project */
  selectedProject?: { name: string; path: string } | null;
  /** Project name for draft persistence */
  projectName?: string;
}

/** Default prop values to reduce destructuring boilerplate */
const DEFAULT_INPUT_PROPS = {
  value: '',
  disabled: false,
  isLoading: false,
  sendByCtrlEnter: false,
  maxFileSize: MAX_FILE_SIZE,
  minRows: 1,
  maxRows: 10,
  projectName: '',
  files: [],
  // Command system defaults
  commands: [],
  frequentCommands: [],
  commandMenuOpen: false,
  commandQuery: '',
  selectedCommandIndex: -1,
  slashPosition: -1,
  // File reference system defaults
  fileReferences: [],
  fileMenuOpen: false,
  fileQuery: '',
  selectedFileIndex: -1,
  atPosition: -1,
  filesLoading: false,
};

// 由父组件调用，React 组件或常量：ChatInput
/**
 * ChatInput Component
 *
 * A multi-line text input with file attachment support and slash commands.
 * Refactored to use modular hooks for keyboard handling and menu positioning.
 *
 * @param props - 组件属性（输入值、回调函数、菜单状态等）
 * @returns JSX 元素
 */
export function ChatInput(props: ChatInputComponentProps) {
  // 国际化翻译 Hook
  const { t } = useTranslation();

  // ========== 属性解构与默认值合并 ==========
  // Merge props with defaults
  const {
    value, onChange, onSend, files, onAddFile, onRemoveFile,
    disabled, isLoading, sendByCtrlEnter, onFocusChange,
    maxFileSize, placeholder, minRows, maxRows, projectName,
    // Command system props
    commands, frequentCommands, commandMenuOpen, commandQuery,
    selectedCommandIndex, slashPosition, onCommandSelect, onCommandMenuClose,
    // File reference system props
    fileReferences, fileMenuOpen, fileQuery, selectedFileIndex,
    atPosition, onFileSelect, onFileMenuClose, filesLoading,
    authenticatedFetch, selectedProject,
  } = { ...DEFAULT_INPUT_PROPS, ...props };

  // ========== 使用 Hooks ==========
  // Use custom hook for state management
  // useChatInputState 管理输入框的内部状态（焦点、光标位置、文件上传等）
  const state = useChatInputState({
    value, onChange, onSend, disabled, isLoading, sendByCtrlEnter,
    onFocusChange, maxFileSize, minRows, maxRows, projectName,
    onAddFile, onRemoveFile, authenticatedFetch, selectedProject,
  });

  // Setup keyboard and menu configuration
  // useChatInputSetup 配置键盘事件处理和菜单位置计算
  const { handleKeyDown, menuProps } = useChatInputSetup({
    textareaRef: state.textareaRef,
    sendByCtrlEnter, onSend, value, onChange,
    cursorPosition: state.cursorPosition,
    commandMenuOpen, commands, selectedCommandIndex,
    commandQuery, slashPosition, onCommandSelect, onCommandMenuClose,
    fileMenuOpen, fileReferences, selectedFileIndex, fileQuery,
    atPosition, onFileSelect, onFileMenuClose, filesLoading,
    authenticatedFetch, selectedProject, frequentCommands,
  });

  // ========== 构建 ChatInputWrapper 属性 ==========
  // 将所有状态和处理函数打包传递给 ChatInputWrapper 组件
  const wrapperProps = {
    files,
    handleRemoveFile: state.handleRemoveFile,
    getRootProps: state.getRootProps,
    getInputProps: state.getInputProps,
    isDragActive: state.isDragActive,
    isFocused: state.isFocused,
    textareaRef: state.textareaRef,
    value,
    handleInputChange: state.handleInputChange,
    handleKeyDown,
    handleFocus: state.handleFocus,
    handleBlur: state.handleBlur,
    placeholder: placeholder || t('chat.typeMessage'),
    disabled,
    isLoading,
    minRows,
    canSend: state.canSend,
    onSend,
    maxFileSize,
    onAddFile,
    handleFileUpload: state.handleFileUpload,
    sendByCtrlEnter,
    hasProject: !!selectedProject,
    menuProps,
  };

  // ========== 渲染 UI ==========
  return <ChatInputWrapper {...wrapperProps} />;
}

export default ChatInput;
