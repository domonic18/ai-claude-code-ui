/**
 * 项目监视器模块
 *
 * 项目现在完全在 Docker 容器内管理，主机文件监视器不再使用。
 * 此函数保留用于向后兼容，但会立即返回。
 *
 * @module utils/project-watcher
 */

/**
 * 使用 chokidar 为 Claude 项目文件夹设置文件系统监视器
 * 注意：由于项目现在完全容器化，此函数不执行任何操作。
 *
 * @param {Set} connectedClients - 已连接的 WebSocket 客户端集合
 * @returns {Promise<null>} 始终返回 null
 */
export async function setupProjectsWatcher(connectedClients) {
  // 项目现在完全在 Docker 容器内管理
  // 主机文件监视器不再使用
  console.log('[INFO] 项目在容器内管理，主机文件监视器已禁用');
  return null;
}
