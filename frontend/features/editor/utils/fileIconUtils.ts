/**
 * File Icon Utils
 *
 * 文件图标、颜色和分类查询工具
 * 根据文件扩展名或特殊文件名返回对应的图标、颜色和分类
 */

/**
 * 文件扩展名到图标的映射表
 * 定义每种文件类型对应的 Lucide 图标名称
 * 代码文件使用代码相关图标，配置文件使用设置图标
 */
const FILE_ICONS: Record<string, string> = {
  // JavaScript 生态
  js: 'javascript',
  jsx: 'react',
  ts: 'typescript',
  tsx: 'react',
  // Python 生态
  py: 'python',
  java: 'java',
  // C/C++ 生态
  cpp: 'code',
  c: 'code',
  h: 'code',
  cs: 'code',
  // 其他编程语言
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  // 数据库
  sql: 'database',
  // 配置文件
  yaml: 'settings',
  yml: 'settings',
  json: 'code',
  // 文档
  md: 'markdown',
  // 前端技术
  html: 'code',
  htm: 'code',
  css: 'code',
  scss: 'code',
  sass: 'code',
  xml: 'code',
  // 脚本语言
  sh: 'terminal',
  bash: 'terminal',
  dockerfile: 'docker',
  ps1: 'powershell',
  psm1: 'powershell',
  // 其他文件类型
  txt: 'file',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  svg: 'image',
  pdf: 'file',
  zip: 'zip',
};

/**
 * 编程语言到品牌颜色的映射表
 * 定义每种编程语言的官方或常用品牌颜色
 * 用于文件图标的颜色标识，提升视觉识别度
 */
const FILE_COLORS: Record<string, string> = {
  // JavaScript 生态：官方品牌色
  javascript: '#f7df1e',    // JS 黄色
  typescript: '#3178c6',    // TS 蓝色
  react: '#61dafb',         // React 青色
  // Python 生态：官方品牌色
  python: '#3776ab',        // Python 蓝色
  java: '#b07219',          // Java 橙色
  // 其他编程语言：官方品牌色
  go: '#00add8',            // Go 青色
  rust: '#dea584',          // Rust 橙色
  php: '#777bb4',           // PHP 紫色
  ruby: '#cc342d',          // Ruby 红色
  // 前端技术：官方品牌色
  html: '#e34c26',          // HTML 橙色
  css: '#563d7c',           // CSS 紫色
  json: '#f7df1e',          // JSON 黄色（同 JS）
  markdown: '#083fa1',      // Markdown 深蓝色
  // DevOps 工具
  docker: '#2496ed',        // Docker 蓝色
  // 默认颜色：灰色
  default: '#6e7681',
};

/**
 * 编程语言到技术栈分类的映射表
 * 用于将文件按技术栈分类：前端、后端、数据库、DevOps 等
 * 在文件树过滤、项目统计等场景中使用
 */
const FILE_CATEGORIES: Record<string, string> = {
  // 前端技术栈
  javascript: 'frontend',
  typescript: 'frontend',
  react: 'frontend',
  html: 'frontend',
  css: 'frontend',
  // 后端技术栈
  python: 'backend',
  java: 'backend',
  go: 'backend',
  rust: 'backend',
  php: 'backend',
  ruby: 'backend',
  // 数据库
  sql: 'database',
  // DevOps 工具
  docker: 'devops',
  // 默认分类
  default: 'file',
};

/**
 * 特殊文件名覆盖规则
 * 对某些常见配置文件和文档文件使用特定的图标、颜色和分类
 * 这些文件的识别优先级高于扩展名规则
 */
const SPECIAL_FILE_CASES: Record<string, { icon?: string; color?: string; category?: string }> = {
  // Docker 配置：使用 Docker 图标和品牌色
  dockerfile: { icon: 'docker', color: FILE_COLORS.docker, category: 'devops' },
  // NPM 包配置：使用 NPM 品牌色
  'package.json': { icon: 'npm', color: '#cb3837' },
  // TypeScript 配置：使用 TS 品牌色
  'tsconfig.json': { icon: 'typescript', color: FILE_COLORS.typescript },
  // README 文档：分类为 docs
  'readme.md': { icon: 'markdown', category: 'docs' },
};

/**
 * 获取文件图标信息：图标、颜色和分类
 * 优先使用特殊文件名规则，其次使用文件扩展名映射
 *
 * @param filename - 文件名（含扩展名）
 * @returns 包含图标名称、颜色和分类的对象
 */
export function getFileIconInfo(filename: string): {
  icon: string;      // Lucide 图标名称
  color: string;     // 品牌颜色（十六进制）
  category: string;  // 技术栈分类
} {
  const ext = filename.split('.').pop()?.toLowerCase();
  const name = filename.toLowerCase();

  // 默认值：使用文件扩展名映射，无匹配则使用默认值
  let icon = FILE_ICONS[ext || ''] || 'file';
  let color = FILE_COLORS[ext || ''] || FILE_COLORS.default;
  let category = FILE_CATEGORIES[ext || ''] || FILE_CATEGORIES.default;

  // 应用特殊文件名覆盖规则（如 package.json、Dockerfile 等）
  // 特殊文件名规则优先级高于扩展名规则
  const specialCase = SPECIAL_FILE_CASES[name];
  if (specialCase) {
    icon = specialCase.icon || icon;
    color = specialCase.color || color;
    category = specialCase.category || category;
  }

  return { icon, color, category };
}
