/**
 * 容器项目管理模块
 *
 * 提供容器内的项目管理功能，包括列出项目和创建默认工作区。
 * 支持从容器内读取会话信息。
 *
 * @module projects/managers/ContainerProjectManager
 */

import { PassThrough } from 'stream';
import containerManager from '../../container/core/index.js';
import { getSessionsInContainer } from '../../sessions/container/ContainerSessions.js';
import { CONTAINER, FILE_TIMEOUTS } from '../../../config/config.js';
import { loadProjectConfig } from '../config/index.js';

/**
 * 从容器内获取项目列表
 * 在容器模式下，项目存储在 /workspace 下
 * 如果用户没有项目，自动创建默认工作区
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array>} 项目列表
 */
export async function getProjectsInContainer(userId) {
  try {
    // 获取容器（设置短超时，避免长时间阻塞前端请求）
    // 如果容器正在创建中，快速返回空列表，让前端通过轮询获取
    let container;
    try {
      container = await containerManager.getOrCreateContainer(userId, {}, { wait: true, timeout: FILE_TIMEOUTS.quickRequest });
    } catch (error) {
      // 容器未就绪，返回空列表让前端继续轮询
      return [];
    }

    // 根据文档设计，项目直接在 /workspace 下，不在 .claude/projects 下
    // 我们需要从 /workspace 列出所有目录，排除 .claude 等系统目录
    const workspacePath = CONTAINER.paths.workspace;

    // 列出容器中的项目目录（排除 .claude 等系统目录）
    // 使用单个命令完成：列出目录 + 过滤 + 验证
    const { stream } = await containerManager.execInContainer(
      userId,
      `for item in "${workspacePath}"/*; do [ -d "$item" ] && basename "$item"; done 2>/dev/null | grep -v "^\\.claude$" || echo ""`
    );

    // 收集输出
    const projects = await new Promise((resolve, reject) => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      let output = '';

      // 使用 Docker 的 demuxStream 分离 stdout/stderr，这会移除 8 字节协议头
      containerManager.docker.modem.demuxStream(stream, stdout, stderr);

      stdout.on('data', (chunk) => {
        output += chunk.toString();
      });

      stderr.on('data', (chunk) => {
        // 静默处理 stderr
      });

      stream.on('error', (err) => {
        resolve([]);
      });

      stream.on('end', async () => {
        try {
          const projectList = [];
          const lines = output.trim().split('\n');

          // 读取项目配置以获取自定义显示名称
          let projectConfig = {};
          try {
            projectConfig = await loadProjectConfig();
          } catch (configError) {
            // 静默失败
          }

          for (const line of lines) {
            let projectName = line.trim();

            // 从项目名称中清理控制字符（移除所有控制字符 ASCII 0-31, 127）
            projectName = projectName
              .replace(/[\x00-\x1f\x7f]/g, '')
              .trim();

            // 跳过空行和隐藏目录（以 . 开头）
            if (!projectName || projectName === '' || projectName.startsWith('.')) {
              continue;
            }

            const decodedPath = projectName.replace(/-/g, '/');

            // 优先使用自定义显示名称，否则使用项目名称
            const customDisplayName = projectConfig[projectName]?.displayName;
            const displayName = customDisplayName || projectName;

            projectList.push({
              name: projectName,
              path: decodedPath,
              displayName: displayName,
              fullPath: projectName,
              isContainerProject: true,
              sessions: [],
              sessionMeta: { hasMore: false, total: 0 },
              cursorSessions: [],
              codexSessions: []
            });
          }

          // 加载每个项目的会话信息
          for (const project of projectList) {
            try {
              const sessionResult = await getSessionsInContainer(userId, project.name, 5, 0);
              project.sessions = sessionResult.sessions || [];
              project.sessionMeta = {
                hasMore: sessionResult.hasMore,
                total: sessionResult.total
              };
            } catch (error) {
              // 保持空会话列表
              project.sessions = [];
              project.sessionMeta = { hasMore: false, total: 0 };
            }
          }

          resolve(projectList);
        } catch (parseError) {
          reject(new Error(`Failed to parse projects: ${parseError.message}`));
        }
      });
    });

    return projects;
  } catch (error) {
    throw new Error(`Failed to get projects in container: ${error.message}`);
  }
}
