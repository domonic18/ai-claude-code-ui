/**
 * 项目目录缓存管理
 *
 * 缓存已提取的项目目录路径，以最小化文件 I/O 操作
 */

// Cache for extracted project directories
const projectDirectoryCache = new Map();

/**
 * 从缓存中获取项目目录
 * @param {string} projectName - 项目名称
 * @returns {string|undefined} 项目目录路径
 */
function getFromCache(projectName) {
  return projectDirectoryCache.get(projectName);
}

/**
 * 设置项目目录缓存
 * @param {string} projectName - 项目名称
 * @param {string} projectDir - 项目目录路径
 */
function setCache(projectName, projectDir) {
  projectDirectoryCache.set(projectName, projectDir);
}

/**
 * 检查缓存中是否存在项目
 * @param {string} projectName - 项目名称
 * @returns {boolean}
 */
function hasInCache(projectName) {
  return projectDirectoryCache.has(projectName);
}

/**
 * 清除项目目录缓存
 * 在项目文件更改时调用
 */
function clearProjectDirectoryCache() {
  projectDirectoryCache.clear();
}

export {
  getFromCache,
  setCache,
  hasInCache,
  clearProjectDirectoryCache
};
