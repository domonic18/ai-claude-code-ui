/**
 * 项目管理模块
 *
 * 提供容器内的项目管理功能，包括列出项目和创建默认工作区。
 */

import { PassThrough } from 'stream';
import containerManager from '../core/index.js';
import { execCommand } from './path-utils.js';
import { CONTAINER } from '../../../config/config.js';

/** 默认项目名称 */
const DEFAULT_PROJECT_NAME = 'my-workspace';

/** Claude 项目路径 */
const CLAUDE_PROJECTS_PATH = CONTAINER.paths.projects;

/**
 * 从容器内获取项目列表
 * 在容器模式下，项目存储在 /home/node/.claude/projects
 * 如果用户没有项目，自动创建默认工作区
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array>} 项目列表
 */
export async function getProjectsInContainer(userId) {
  console.log('[ProjectManager] getProjectsInContainer - userId:', userId);

  try {
    const container = await containerManager.getOrCreateContainer(userId);
    console.log('[ProjectManager] Container:', container.id, container.name);

    // 确保项目目录存在
    await execCommand(userId, `mkdir -p "${CLAUDE_PROJECTS_PATH}"`);

    // 列出容器中的项目目录
    const { stream } = await containerManager.execInContainer(
      userId,
      `find "${CLAUDE_PROJECTS_PATH}" -mindepth 1 -maxdepth 1 -type d -printf "%f\\n" 2>/dev/null || echo ""`
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

      stream.on('end', () => {
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

            if (!projectName || projectName === '') continue;

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
          resolve(projectList);
        } catch (parseError) {
          console.error('[ProjectManager] Error parsing projects:', parseError);
          reject(new Error(`Failed to parse projects: ${parseError.message}`));
        }
      });
    });

    // 如果用户没有项目，创建默认工作区
    if (projects.length === 0) {
      console.log('[ProjectManager] No projects found for user, creating default workspace');
      const defaultProject = await createDefaultWorkspace(userId);
      if (defaultProject) {
        projects.push(defaultProject);
      }
    }

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
  const projectPath = `${CLAUDE_PROJECTS_PATH}/${DEFAULT_PROJECT_NAME}`;

  try {
    // 创建默认项目目录
    await execCommand(userId, `mkdir -p "${projectPath}"`);

    // 初始化为 git 仓库
    await execCommand(userId, `cd "${projectPath}" && git init`);

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
    await execCommand(
      userId,
      `cat > "${projectPath}/README.md" << 'EOF'\n${readmeContent}\nEOF`
    );

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
    await execCommand(
      userId,
      `cat > "${projectPath}/.gitignore" << 'EOF'\n${gitignoreContent}\nEOF`
    );

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
    await execCommand(
      userId,
      `cat > "${projectPath}/package.json" << 'EOF'\n${JSON.stringify(packageJson, null, 2)}\nEOF`
    );

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
