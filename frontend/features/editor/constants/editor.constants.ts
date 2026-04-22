/**
 * Editor Constants
 *
 * Constants for code and PRD editor functionality.
 * 定义编辑器支持的语言、主题、文件大小限制、快捷键等常量
 */

// 导入编辑器类型定义：语言类型和主题类型
import type { EditorLanguage, EditorTheme } from '../types';

/**
 * 编辑器支持的编程语言列表
 * 包含所有主流编程语言和标记语言，用于语言选择器
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
 * 语言显示名称映射：用于 UI 中显示友好的语言名称
 * 将内部语言标识符映射为用户友好的显示名称
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
 * 编辑器支持的主题列表
 * 提供多种配色方案：亮色、暗色、Monokai、Solarized、Dracula、Nord、GitHub
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
 * 主题显示名称映射：用于 UI 中显示友好的主题名称
 * 将内部主题标识符映射为用户友好的显示名称
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
 * 可选字体大小列表（像素单位）
 * 提供 14 种字体大小选项，从 10px 到 32px
 */
export const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32] as const;

/**
 * 可选 Tab 大小列表（空格数）
 * 定义缩进级别：2 空格、4 空格、8 空格
 */
export const TAB_SIZES = [2, 4, 8] as const;

/**
 * 最大可编辑文件大小：1MB（超出此大小的文件不建议在编辑器中打开）
 * 防止大文件导致浏览器性能问题
 */
export const MAX_EDITABLE_FILE_SIZE = 1024 * 1024; // 1MB

/**
 * 大文件阈值：100KB（超过此大小可能影响性能，显示警告）
 * 在用户打开较大文件时提示性能风险
 */
export const LARGE_FILE_THRESHOLD = 100 * 1024; // 100KB

/**
 * 自动保存延迟时间：2秒（用户停止输入后多久触发自动保存）
 * 防抖处理：用户停止输入 2 秒后才触发自动保存
 */
export const AUTO_SAVE_DELAY = 2000;

/**
 * 保存成功提示持续时间：2秒（保存成功后绿色提示显示的时长）
 * 用户反馈：保存成功后显示 "Saved!" 提示的持续时间
 */
export const SAVE_SUCCESS_DURATION = 2000;

/**
 * 默认编辑器配置对象
 * 新用户或未保存设置时使用的默认值
 * 包含语言、主题、字号、自动换行等所有编辑器设置
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
 * localStorage 存储键名集合
 * 用于持久化编辑器设置的 localStorage 键名
 * 所有设置均以 'codeEditor' 前缀开头，避免与其他功能冲突
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
 * 文件扩展名到编程语言的映射表
 * 用于根据文件扩展名自动识别编程语言
 * 支持超过 60 种文件扩展名，覆盖主流编程语言
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
 * 编程语言到文件扩展名的反向映射表
 * 用于根据编程语言查找所有相关文件扩展名
 * 在文件过滤器、语言选择器等场景中使用
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
 * Shebang（脚本文件第一行）到编程语言的映射表
 * 用于识别无扩展名或扩展名不规范的脚本文件
 * 适用于 Unix/Linux 脚本文件的自动语言检测
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
 * Monaco Editor 语言标识符映射表
 * 将内部语言标识符映射到 Monaco Editor 支持的语言 ID
 * Monaco Editor 使用不同的语言 ID（如 'shell' 而非 'bash'）
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
 * 主题颜色定义集合
 * 定义每个主题的背景、前景、光标、选择高亮等颜色
 * 用于动态生成编辑器样式，确保与主题一致
 */
export const THEME_COLORS: Record<EditorTheme, {
  background: string;      // 背景色
  foreground: string;      // 前景色（文本颜色）
  cursor: string;          // 光标颜色
  selection: string;       // 选择区域高亮色
  lineHighlight: string;   // 当前行高亮色
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
 * 二进制文件扩展名列表
 * 这些文件无法在文本编辑器中显示，需要特殊处理
 * 包含图片、文档、压缩包、可执行文件、音视频等
 */
export const BINARY_EXTENSIONS: readonly string[] = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',  // 图片格式
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',               // 文档和压缩包
  '.exe', '.dll', '.so', '.dylib',                           // 可执行文件和库
  '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.m4a',           // 音视频格式
  '.ttf', '.otf', '.woff', '.woff2', '.eot',                 // 字体文件
  '.class', '.jar', '.war',                                  // Java 编译文件
  '.iso', '.dmg',                                            // 磁盘镜像
] as const;

/**
 * 图片文件扩展名列表
 * 用于识别图片文件并提供预览功能
 * 支持 SVG、PNG、JPG、GIF 等常见格式
 */
export const IMAGE_EXTENSIONS: readonly string[] = [
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg',
] as const;

/**
 * PRD（产品需求文档）默认章节配置
 * 定义 PRD 文档的默认章节结构
 * 包含概述、目标、功能、需求、时间线五个标准章节
 */
export const PRD_DEFAULT_SECTIONS = [
  { id: 'overview', title: 'Overview', content: '', order: 0 },
  { id: 'goals', title: 'Goals', content: '', order: 1 },
  { id: 'features', title: 'Features', content: '', order: 2 },
  { id: 'requirements', title: 'Requirements', content: '', order: 3 },
  { id: 'timeline', title: 'Timeline', content: '', order: 4 },
] as const;

/**
 * PRD 模板类型列表
 * 支持的 PRD 文档模板类型
 * 覆盖 Web 应用、移动应用、API 服务、桌面应用、库、插件等场景
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
 * 编辑器键盘快捷键定义
 * 定义常用的编辑器操作快捷键
 * 使用跨平台格式：CmdOrCtrl 表示 Mac 的 Cmd 和 Windows/Linux 的 Ctrl
 */
export const KEYBOARD_SHORTCUTS = {
  SAVE: 'CmdOrCtrl+S',            // 保存文件
  SAVE_ALL: 'CmdOrCtrl+Shift+S',  // 保存所有文件
  CLOSE: 'CmdOrCtrl+W',           // 关闭编辑器
  FIND: 'CmdOrCtrl+F',            // 查找
  REPLACE: 'CmdOrCtrl+H',         // 替换
  FORMAT: 'Shift+Alt+F',          // 格式化代码
  TOGGLE_COMMENT: 'CmdOrCtrl+/',  // 切换注释
  GOTO_LINE: 'CmdOrCtrl+G',       // 跳转到指定行
  QUICK_OPEN: 'CmdOrCtrl+P',      // 快速打开文件
} as const;
