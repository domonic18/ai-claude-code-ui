/**
 * 项目显示名称生成工具
 *
 * 从项目路径生成友好的显示名称
 * 优先使用 package.json 中的名称，回退到路径的最后一部分
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * 从项目路径生成更好的显示名称
 * @param {string} projectName - 项目名称（编码后的）
 * @param {string|null} actualProjectDir - 实际项目目录路径
 * @returns {Promise<string>} 显示名称
 */
async function generateDisplayName(projectName, actualProjectDir = null) {
  // Use actual project directory if provided, otherwise decode from project name
  let projectPath = actualProjectDir || projectName.replace(/-/g, '/');

  // Try to read package.json from the project path
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageData = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageData);

    // Return the name from package.json if it exists
    if (packageJson.name) {
      return packageJson.name;
    }
  } catch (error) {
    // Fall back to path-based naming if package.json doesn't exist or can't be read
  }

  // If it starts with /, it's an absolute path
  if (projectPath.startsWith('/')) {
    const parts = projectPath.split('/').filter(Boolean);
    // Return only the last folder name
    return parts[parts.length - 1] || projectPath;
  }

  return projectPath;
}

export {
  generateDisplayName
};
