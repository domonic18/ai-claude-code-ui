/**
 * 项目管理模块
 *
 * 提供容器内的项目管理功能，包括列出项目和创建默认工作区。
 * 支持从容器内读取会话信息。
 */

import { PassThrough } from 'stream';
import containerManager from '../core/index.js';
import { writeFileInContainer } from './file-operations.js';
import { getSessionsInContainer } from './container-sessions.js';
import { CONTAINER } from '../../../config/config.js';

/** 默认项目名称 */
const DEFAULT_PROJECT_NAME = 'my-workspace';

/**
 * 从容器内获取项目列表
 * 在容器模式下，项目存储在 /workspace 下
 * 如果用户没有项目，自动创建默认工作区
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array>} 项目列表
 */
export async function getProjectsInContainer(userId) {
  console.log('[ProjectManager] getProjectsInContainer - userId:', userId);

  try {
    const container = await containerManager.getOrCreateContainer(userId);
    console.log('[ProjectManager] Container:', container.id, container.name);

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
        console.error('[ProjectManager] STDERR:', chunk.toString());
      });

      stream.on('error', (err) => {
        console.error('[ProjectManager] Error listing projects:', err);
        resolve([]);
      });

      stream.on('end', async () => {
        try {
          const projectList = [];
          const lines = output.trim().split('\n');

          console.log('[ProjectManager] Raw ls output:', JSON.stringify(output));
          console.log('[ProjectManager] Split lines:', lines.length);

          for (const line of lines) {
            let projectName = line.trim();

            // 从项目名称中清理控制字符
            projectName = projectName
              .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
              .replace(/[\r\n]/g, '')
              .trim();

            // 跳过空行和隐藏目录（以 . 开头）
            if (!projectName || projectName === '' || projectName.startsWith('.')) {
              console.log('[ProjectManager] Skipping hidden/empty:', projectName);
              continue;
            }

            const decodedPath = projectName.replace(/-/g, '/');

            projectList.push({
              name: projectName,
              path: decodedPath,
              displayName: projectName,
              fullPath: projectName,
              isContainerProject: true,
              sessions: [],
              sessionMeta: { hasMore: false, total: 0 },
              cursorSessions: [],
              codexSessions: []
            });
          }

          console.log('[ProjectManager] Found projects in container:', projectList.length);
          console.log('[ProjectManager] Project data:', JSON.stringify(projectList, null, 2));

          // 如果用户没有项目，创建默认工作区
          if (projectList.length === 0) {
            console.log('[ProjectManager] No projects found for user, creating default workspace');
            const defaultProject = await createDefaultWorkspace(userId);
            if (defaultProject) {
              projectList.push(defaultProject);
            }
          }

          // 加载每个项目的会话信息
          for (const project of projectList) {
            try {
              console.log(`[ProjectManager] Loading sessions for project: ${project.name}`);
              const sessionResult = await getSessionsInContainer(userId, project.name, 5, 0);
              project.sessions = sessionResult.sessions || [];
              project.sessionMeta = {
                hasMore: sessionResult.hasMore,
                total: sessionResult.total
              };
              console.log(`[ProjectManager] Loaded ${project.sessions.length} sessions for ${project.name} (total: ${sessionResult.total})`);
            } catch (error) {
              console.warn(`[ProjectManager] Could not load sessions for project ${project.name}:`, error.message);
              // 保持空会话列表
              project.sessions = [];
              project.sessionMeta = { hasMore: false, total: 0 };
            }
          }

          resolve(projectList);
        } catch (parseError) {
          console.error('[ProjectManager] Error parsing projects:', parseError);
          reject(new Error(`Failed to parse projects: ${parseError.message}`));
        }
      });
    });

    return projects;
  } catch (error) {
    console.error('[ProjectManager] Failed to get projects in container:', error);
    throw new Error(`Failed to get projects in container: ${error.message}`);
  }
}

/**
 * 创建默认工作区
 * @param {number} userId - 用户 ID
 * @returns {Promise<object|null>} 默认项目信息
 */
async function createDefaultWorkspace(userId) {
  // 根据文档设计（docs/arch/data-storage-design.md v3.1）：
  // - 项目代码目录：/workspace/my-workspace/ （实际的项目代码）
  // - 用户级配置：/workspace/.claude/ （~/.claude/，所有项目共享）
  // - 项目级配置：/workspace/my-workspace/.claude/ （项目特定，覆盖用户级）
  // 项目直接在 /workspace 下，不在 .claude/ 下
  const projectPath = `${CONTAINER.paths.workspace}/${DEFAULT_PROJECT_NAME}`;

  console.log('[ProjectManager] Creating default workspace at:', projectPath);

  try {
    // 创建默认项目目录 - 使用 containerManager.execInContainer 确保命令执行完成
    const createDirResult = await containerManager.execInContainer(
      userId,
      `mkdir -p "${projectPath}"`
    );

    // 等待命令完成
    await new Promise((resolve) => {
      createDirResult.stream.on('end', resolve);
    });
    console.log('[ProjectManager] Directory created:', projectPath);

    // 初始化为 git 仓库
    const gitResult = await containerManager.execInContainer(
      userId,
      `cd "${projectPath}" && git init`
    );

    await new Promise((resolve) => {
      gitResult.stream.on('end', resolve);
    });

    // 创建 README 文件
    const readmeContent = `# My Workspace

Welcome to your Claude Code workspace! This is your default project where you can start coding.

## Getting Started

- Use the chat interface to ask Claude to help you with coding tasks
- Use the file explorer to browse and edit files
- Use the terminal to run commands

## Tips

- You can create additional workspaces from the projects menu
- All your work is automatically saved in the container
- Ask Claude to help you set up new projects or debug issues

Happy coding!
`;
    await writeFileInContainer(userId, 'README.md', readmeContent, {
      projectPath: DEFAULT_PROJECT_NAME,
      isContainerProject: true
    });

    // 创建 .gitignore
    const gitignoreContent = `# Dependencies
node_modules/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Environment
.env
.env.local
`;
    await writeFileInContainer(userId, '.gitignore', gitignoreContent, {
      projectPath: DEFAULT_PROJECT_NAME,
      isContainerProject: true
    });

    // 创建 package.json
    const packageJson = {
      name: 'my-workspace',
      version: '1.0.0',
      description: 'My Claude Code workspace',
      scripts: {
        test: 'echo "Error: no test specified" && exit 1'
      },
      keywords: [],
      author: '',
      license: 'ISC'
    };
    await writeFileInContainer(userId, 'package.json', JSON.stringify(packageJson, null, 2), {
      projectPath: DEFAULT_PROJECT_NAME,
      isContainerProject: true
    });

    console.log('[ProjectManager] Default workspace created successfully');

    return {
      name: DEFAULT_PROJECT_NAME,
      path: DEFAULT_PROJECT_NAME,
      displayName: 'My Workspace',
      fullPath: DEFAULT_PROJECT_NAME,
      isContainerProject: true,
      sessions: [],
      sessionMeta: { hasMore: false, total: 0 },
      cursorSessions: [],
      codexSessions: []
    };
  } catch (createError) {
    console.error('[ProjectManager] Failed to create default workspace:', createError);
    return null;
  }
}
