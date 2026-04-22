/**
 * 项目目录缓存管理
 *
 * 缓存已提取的项目目录路径，以最小化文件 I/O 操作
 */

// Cache for extracted project directories
const projectDirectoryCache = new Map();

// 在项目列表查询时调用，从缓存中快速获取已存在的项目目录路径
/**
 * 从缓存中获取项目目录
 * @param {string} projectName - 项目名称
 * @returns {string|undefined} 项目目录路径
 */
function getFromCache(projectName) {
  return projectDirectoryCache.get(projectName);
}

// 在项目扫描完成后调用，将新发现的项目目录路径缓存起来
/**
 * 设置项目目录缓存
 * @param {string} projectName - 项目名称
 * @param {string} projectDir - 项目目录路径
 */
function setCache(projectName, projectDir) {
  projectDirectoryCache.set(projectName, projectDir);
}

// 在项目扫描前调用，检查项目是否已被缓存以避免重复扫描
/**
 * 检查缓存中是否存在项目
 * @param {string} projectName - 项目名称
 * @returns {boolean}
 */
function hasInCache(projectName) {
  return projectDirectoryCache.has(projectName);
}

// 在项目配置被修改或需要刷新时调用，清空所有缓存的项目目录路径
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
