/**
 * 项目监视器模块
 *
 * 监视 Claude 项目目录的更改并向连接的
 * WebSocket 客户端广播更新。
 *
 * 在容器模式下，禁用文件监视，因为项目在
 * Docker 容器内管理。
 */

import path from 'path';
import os from 'os';
import { getProjects } from '../services/project/index.js';
import { isContainerModeEnabled } from '../config/config.js';

/**
 * 使用 chokidar 为 Claude 项目文件夹设置文件系统监视器
 * @param {Set} connectedClients - 已连接的 WebSocket 客户端集合
 * @returns {Promise<void>}
 */
export async function setupProjectsWatcher(connectedClients) {
  // 检查是否启用了容器模式
  const isContainerMode = isContainerModeEnabled();

  if (isContainerMode) {
    console.log('[INFO] 已启用容器模式，跳过主机项目监视器');
    console.log('[INFO] 项目将在容器内管理');
    return;
  }

  const chokidar = (await import('chokidar')).default;
  const claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects');

  try {
    // 使用优化设置初始化 chokidar 监视器
    const projectsWatcher = chokidar.watch(claudeProjectsPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.tmp',
        '**/*.swp',
        '**/.DS_Store'
      ],
      persistent: true,
      ignoreInitial: true, // 启动时不为现有文件触发事件
      followSymlinks: false,
      depth: 10, // 合理的深度限制
      awaitWriteFinish: {
        stabilityThreshold: 100, // 等待 100ms 以使文件稳定
        pollInterval: 50
      }
    });

    // 防抖函数以防止过度通知
    let debounceTimer;
    const debouncedUpdate = async (eventType, filePath) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          // 获取更新后的项目列表
          const updatedProjects = await getProjects();

          // 通知所有连接的客户端项目更改
          const updateMessage = JSON.stringify({
            type: 'projects_updated',
            projects: updatedProjects,
            timestamp: new Date().toISOString(),
            changeType: eventType,
            changedFile: path.relative(claudeProjectsPath, filePath)
          });

          connectedClients.forEach(client => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(updateMessage);
            }
          });

        } catch (error) {
          console.error('[ERROR] 处理项目更改错误:', error);
        }
      }, 300); // 300ms 防抖
    };

    // 设置事件监听器
    projectsWatcher
      .on('add', (filePath) => debouncedUpdate('add', filePath))
      .on('change', (filePath) => debouncedUpdate('change', filePath))
      .on('unlink', (filePath) => debouncedUpdate('unlink', filePath))
      .on('addDir', (dirPath) => debouncedUpdate('addDir', dirPath))
      .on('unlinkDir', (dirPath) => debouncedUpdate('unlinkDir', dirPath))
      .on('error', (error) => {
        console.error('[ERROR] Chokidar 监视器错误:', error);
      })
      .on('ready', () => {
        // 监视器已就绪
      });

    console.log('[INFO] 主机项目监视器已启动（非容器模式）');

    return projectsWatcher;

  } catch (error) {
    console.error('[ERROR] 设置项目监视器失败:', error);
    return null;
  }
}
