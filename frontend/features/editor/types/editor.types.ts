/**
 * Editor Module Types
 *
 * Type definitions for code editors.
 */

/**
 * Supported programming languages
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
 */
export interface EditorSettingsProps {
  config: CodeEditorConfig;
  onChange: (config: CodeEditorConfig) => void;
  onClose?: () => void;
  className?: string;
}
