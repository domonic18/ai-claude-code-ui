/**
 * Editor Module Types
 *
 * Type definitions for code editors.
 * 定义编辑器语言、主题、配置、文件信息等类型
 */

/**
 * Supported programming languages
 * 支持的编程语言类型：覆盖 24 种主流编程语言
 */
export type EditorLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'perl'
  | 'sql'
  | 'yaml'
  | 'json'
  | 'markdown'
  | 'html'
  | 'css'
  | 'scss'
  | 'xml'
  | 'text'
  | 'bash'
  | 'powershell'
  | 'dockerfile';

/**
 * Editor theme
 * 编辑器主题类型：7 种配色方案
 */
export type EditorTheme =
  | 'light'
  | 'dark'
  | 'monokai'
  | 'solarized'
  | 'dracula'
  | 'nord'
  | 'github';

/**
 * Code editor configuration
 * 编辑器配置接口：包含语言、主题、字号、Tab 大小等设置
 */
export interface CodeEditorConfig {
  language: EditorLanguage;
  theme: EditorTheme;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  autoCloseBrackets: boolean;
  autoIndent: boolean;
  readOnly?: boolean;
  maxHeight?: string;
}

/**
 * Code editor props (generic)
 * 通用代码编辑器属性接口
 */
export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: EditorLanguage;
  theme?: EditorTheme;
  config?: Partial<CodeEditorConfig>;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: string | number;
  maxHeight?: string | number;
  className?: string;
}

/**
 * File info for CodeEditor component
 * 编辑器文件信息接口：包含路径、名称、内容、语言、diff 信息等
 */
export interface EditorFile {
  path: string;
  name: string;
  content?: string;
  language?: EditorLanguage;
  extension?: string;
  projectName?: string;
  diffInfo?: {
    original: string;
    modified: string;
    old_string?: string;
    new_string?: string;
    hunks?: Array<{
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
    }>;
  };
}

/**
 * CodeEditor component props (actual usage)
 * CodeEditor 组件属性接口：实际使用的属性
 */
export interface CodeEditorComponentProps {
  file: EditorFile;
  onClose?: () => void;
  projectPath?: string;
  isSidebar?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  className?: string;
}

/**
 * Editor toolbar action
 * 编辑器工具栏操作接口：定义按钮的 ID、标签、图标、点击事件等
 */
export interface EditorAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  shortcut?: string;
  disabled?: boolean;
}

/**
 * Editor settings panel props
 * 编辑器设置面板属性接口
 */
export interface EditorSettingsProps {
  config: CodeEditorConfig;
  onChange: (config: CodeEditorConfig) => void;
  onClose?: () => void;
  className?: string;
}
