/**
 * File Icon Utils
 *
 * File icon, color, and category lookup utilities.
 */

/**
 * File icon lookup constants
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
 * File color lookup constants
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
 * File category lookup constants
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
 * Special file name cases for icon overrides
 */
const SPECIAL_FILE_CASES: Record<string, { icon?: string; color?: string; category?: string }> = {
  dockerfile: { icon: 'docker', color: FILE_COLORS.docker, category: 'devops' },
  'package.json': { icon: 'npm', color: '#cb3837' },
  'tsconfig.json': { icon: 'typescript', color: FILE_COLORS.typescript },
  'readme.md': { icon: 'markdown', category: 'docs' },
};

/**
 * Get file icon info
 *
 * @param filename - The filename to get icon info for
 * @returns Object containing icon, color, and category
 */
export function getFileIconInfo(filename: string): {
  icon: string;
  color: string;
  category: string;
} {
  const ext = filename.split('.').pop()?.toLowerCase();
  const name = filename.toLowerCase();

  // Default values
  let icon = FILE_ICONS[ext || ''] || 'file';
  let color = FILE_COLORS[ext || ''] || FILE_COLORS.default;
  let category = FILE_CATEGORIES[ext || ''] || FILE_CATEGORIES.default;

  // Apply special cases
  const specialCase = SPECIAL_FILE_CASES[name];
  if (specialCase) {
    icon = specialCase.icon || icon;
    color = specialCase.color || color;
    category = specialCase.category || category;
  }

  return { icon, color, category };
}
