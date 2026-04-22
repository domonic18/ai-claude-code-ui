/**
 * File Icon Utils
 *
 * 文件图标、颜色和分类查询工具
 * 根据文件扩展名或特殊文件名返回对应的图标、颜色和分类
 */

/**
 * 文件扩展名到图标的映射表
 * 定义每种文件类型对应的 Lucide 图标名称
 */
const FILE_ICONS: Record<string, string> = {
  js: 'javascript',
  jsx: 'react',
  ts: 'typescript',
  tsx: 'react',
  py: 'python',
  java: 'java',
  cpp: 'code',
  c: 'code',
  h: 'code',
  cs: 'code',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  sql: 'database',
  yaml: 'settings',
  yml: 'settings',
  json: 'code',
  md: 'markdown',
  html: 'code',
  htm: 'code',
  css: 'code',
  scss: 'code',
  sass: 'code',
  xml: 'code',
  sh: 'terminal',
  bash: 'terminal',
  dockerfile: 'docker',
  ps1: 'powershell',
  psm1: 'powershell',
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
 */
const FILE_COLORS: Record<string, string> = {
  javascript: '#f7df1e',
  typescript: '#3178c6',
  react: '#61dafb',
  python: '#3776ab',
  java: '#b07219',
  go: '#00add8',
  rust: '#dea584',
  php: '#777bb4',
  ruby: '#cc342d',
  html: '#e34c26',
  css: '#563d7c',
  json: '#f7df1e',
  markdown: '#083fa1',
  docker: '#2496ed',
  default: '#6e7681',
};

/**
 * 编程语言到技术栈分类的映射表
 * 用于将文件按技术栈分类：前端、后端、数据库、DevOps 等
 */
const FILE_CATEGORIES: Record<string, string> = {
  javascript: 'frontend',
  typescript: 'frontend',
  react: 'frontend',
  python: 'backend',
  java: 'backend',
  go: 'backend',
  rust: 'backend',
  php: 'backend',
  ruby: 'backend',
  html: 'frontend',
  css: 'frontend',
  sql: 'database',
  docker: 'devops',
  default: 'file',
};

/**
 * 特殊文件名覆盖规则
 * 对某些常见配置文件和文档文件使用特定的图标、颜色和分类
 */
const SPECIAL_FILE_CASES: Record<string, { icon?: string; color?: string; category?: string }> = {
  dockerfile: { icon: 'docker', color: FILE_COLORS.docker, category: 'devops' },
  'package.json': { icon: 'npm', color: '#cb3837' },
  'tsconfig.json': { icon: 'typescript', color: FILE_COLORS.typescript },
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
  const specialCase = SPECIAL_FILE_CASES[name];
  if (specialCase) {
    icon = specialCase.icon || icon;
    color = specialCase.color || color;
    category = specialCase.category || category;
  }

  return { icon, color, category };
}
