/**
 * Editor Constants
 *
 * Constants for code and PRD editor functionality.
 */

import type { EditorLanguage, EditorTheme } from '../types';

/**
 * Supported programming languages
 */
export const EDITOR_LANGUAGES: readonly EditorLanguage[] = [
  'javascript',
  'typescript',
  'python',
  'java',
  'cpp',
  'csharp',
  'go',
  'rust',
  'php',
  'ruby',
  'perl',
  'sql',
  'yaml',
  'json',
  'markdown',
  'html',
  'css',
  'scss',
  'xml',
  'bash',
  'powershell',
  'dockerfile',
  'text',
] as const;

/**
 * Language display names
 */
export const LANGUAGE_DISPLAY_NAMES: Record<EditorLanguage, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
  ruby: 'Ruby',
  perl: 'Perl',
  sql: 'SQL',
  yaml: 'YAML',
  json: 'JSON',
  markdown: 'Markdown',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS/Sass',
  xml: 'XML',
  bash: 'Bash',
  powershell: 'PowerShell',
  dockerfile: 'Dockerfile',
  text: 'Plain Text',
};

/**
 * Supported editor themes
 */
export const EDITOR_THEMES: readonly EditorTheme[] = [
  'light',
  'dark',
  'monokai',
  'solarized',
  'dracula',
  'nord',
  'github',
] as const;

/**
 * Theme display names
 */
export const THEME_DISPLAY_NAMES: Record<EditorTheme, string> = {
  light: 'Light',
  dark: 'Dark',
  monokai: 'Monokai',
  solarized: 'Solarized',
  dracula: 'Dracula',
  nord: 'Nord',
  github: 'GitHub',
};

/**
 * Default font sizes
 */
export const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32] as const;

/**
 * Default tab sizes
 */
export const TAB_SIZES = [2, 4, 8] as const;

/**
 * Max file size for editing (in bytes)
 */
export const MAX_EDITABLE_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * Large file threshold (in bytes)
 */
export const LARGE_FILE_THRESHOLD = 100 * 1024; // 100KB

/**
 * Auto-save delay (in milliseconds)
 */
export const AUTO_SAVE_DELAY = 2000;

/**
 * Save success indicator duration (in milliseconds)
 */
export const SAVE_SUCCESS_DURATION = 2000;

/**
 * Default editor configuration
 */
export const DEFAULT_EDITOR_CONFIG = {
  language: 'javascript' as EditorLanguage,
  theme: 'dark' as EditorTheme,
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  lineNumbers: true,
  minimap: true,
  autoCloseBrackets: true,
  autoIndent: true,
  readOnly: false,
} as const;

/**
 * localStorage keys for editor settings
 */
export const STORAGE_KEYS = {
  THEME: 'codeEditorTheme',
  LANGUAGE: 'codeEditorLanguage',
  FONT_SIZE: 'codeEditorFontSize',
  TAB_SIZE: 'codeEditorTabSize',
  WORD_WRAP: 'codeEditorWordWrap',
  LINE_NUMBERS: 'codeEditorLineNumbers',
  MINIMAP: 'codeEditorShowMinimap',
  AUTO_CLOSE_BRACKETS: 'codeEditorAutoCloseBrackets',
  AUTO_INDENT: 'codeEditorAutoIndent',
} as const;

/**
 * File extension to language mapping
 */
export const EXTENSION_LANGUAGE_MAP: Record<string, EditorLanguage> = {
  'js': 'javascript',
  'jsx': 'javascript',
  'mjs': 'javascript',
  'cjs': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'mts': 'typescript',
  'cts': 'typescript',
  'py': 'python',
  'pyw': 'python',
  'pyi': 'python',
  'java': 'java',
  'cpp': 'cpp',
  'cc': 'cpp',
  'cxx': 'cpp',
  'h': 'cpp',
  'hpp': 'cpp',
  'hxx': 'cpp',
  'cs': 'csharp',
  'go': 'go',
  'rs': 'rust',
  'php': 'php',
  'rb': 'ruby',
  'pl': 'perl',
  'pm': 'perl',
  'sql': 'sql',
  'yaml': 'yaml',
  'yml': 'yaml',
  'json': 'json',
  'md': 'markdown',
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'scss',
  'xml': 'xml',
  'sh': 'bash',
  'bash': 'bash',
  'dockerfile': 'dockerfile',
  'ps1': 'powershell',
  'psm1': 'powershell',
  'txt': 'text',
} as const;

/**
 * Language to file extensions mapping
 */
export const LANGUAGE_EXTENSIONS_MAP: Record<EditorLanguage, string[]> = {
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  python: ['.py', '.pyw', '.pyi'],
  java: ['.java'],
  cpp: ['.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx'],
  csharp: ['.cs'],
  go: ['.go'],
  rust: ['.rs'],
  php: ['.php'],
  ruby: ['.rb'],
  perl: ['.pl', '.pm'],
  sql: ['.sql'],
  yaml: ['.yaml', '.yml'],
  json: ['.json'],
  markdown: ['.md', '.markdown'],
  html: ['.html', '.htm'],
  css: ['.css'],
  scss: ['.scss', '.sass'],
  xml: ['.xml'],
  bash: ['.sh', '.bash'],
  powershell: ['.ps1', '.psm1'],
  dockerfile: ['Dockerfile', '.dockerignore'],
  text: ['.txt'],
} as const;

/**
 * Shebang to language mapping
 */
export const SHEBANG_LANGUAGE_MAP: Record<string, EditorLanguage> = {
  'python': 'python',
  'python3': 'python',
  'python2': 'python',
  'bash': 'bash',
  'sh': 'bash',
  'node': 'javascript',
  'ruby': 'ruby',
  'perl': 'perl',
} as const;

/**
 * Monaco editor language identifiers
 */
export const MONACO_LANGUAGE_MAP: Record<EditorLanguage, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
  php: 'php',
  ruby: 'ruby',
  perl: 'perl',
  sql: 'sql',
  yaml: 'yaml',
  json: 'json',
  markdown: 'markdown',
  html: 'html',
  css: 'css',
  scss: 'scss',
  xml: 'xml',
  bash: 'shell',
  powershell: 'powershell',
  dockerfile: 'dockerfile',
  text: 'plaintext',
} as const;

/**
 * Theme color definitions
 */
export const THEME_COLORS: Record<EditorTheme, {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  lineHighlight: string;
}> = {
  light: {
    background: '#ffffff',
    foreground: '#000000',
    cursor: '#000000',
    selection: '#add6ff',
    lineHighlight: '#f0f0f0',
  },
  dark: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#aeafad',
    selection: '#264f78',
    lineHighlight: '#2a2d2e',
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    selection: '#49483e',
    lineHighlight: '#3e3d32',
  },
  solarized: {
    background: '#fdf6e3',
    foreground: '#657b83',
    cursor: '#657b83',
    selection: '#eee8d5',
    lineHighlight: '#eee8d5',
  },
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    selection: '#44475a',
    lineHighlight: '#44475a',
  },
  nord: {
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    selection: '#434c5e',
    lineHighlight: '#3b4252',
  },
  github: {
    background: '#ffffff',
    foreground: '#24292e',
    cursor: '#24292e',
    selection: '#c8e1ff',
    lineHighlight: '#f6f8fa',
  },
} as const;

/**
 * Binary file extensions
 */
export const BINARY_EXTENSIONS: readonly string[] = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.m4a',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.class', '.jar', '.war',
  '.iso', '.dmg',
] as const;

/**
 * Image file extensions
 */
export const IMAGE_EXTENSIONS: readonly string[] = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
] as const;

/**
 * PRD default sections
 */
export const PRD_DEFAULT_SECTIONS = [
  { id: 'overview', title: 'Overview', content: '', order: 0 },
  { id: 'goals', title: 'Goals', content: '', order: 1 },
  { id: 'features', title: 'Features', content: '', order: 2 },
  { id: 'requirements', title: 'Requirements', content: '', order: 3 },
  { id: 'timeline', title: 'Timeline', content: '', order: 4 },
] as const;

/**
 * PRD template types
 */
export const PRD_TEMPLATE_TYPES = [
  'web-app',
  'mobile-app',
  'api-service',
  'desktop-app',
  'library',
  'plugin',
] as const;

/**
 * Keyboard shortcuts
 */
export const KEYBOARD_SHORTCUTS = {
  SAVE: 'CmdOrCtrl+S',
  SAVE_ALL: 'CmdOrCtrl+Shift+S',
  CLOSE: 'CmdOrCtrl+W',
  FIND: 'CmdOrCtrl+F',
  REPLACE: 'CmdOrCtrl+H',
  FORMAT: 'Shift+Alt+F',
  TOGGLE_COMMENT: 'CmdOrCtrl+/',
  GOTO_LINE: 'CmdOrCtrl+G',
  QUICK_OPEN: 'CmdOrCtrl+P',
} as const;
