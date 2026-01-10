/**
 * 文件容器操作
 *
 * 用于用户隔离文件访问的容器化文件操作。
 * 所有文件操作都在用户容器内执行以确保安全性。
 *
 * 主要功能：
 * - 容器隔离的文件读写
 * - 文件树遍历
 * - 路径安全验证
 * - 二进制文件支持
 */

import containerManager from './ContainerManager.js';

// 读取操作的最大文件大小（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 文件树遍历的最大深度
const MAX_TREE_DEPTH = 10;

/**
 * 在容器内执行命令并等待完成
 * @param {number} userId - 用户 ID
 * @param {string} command - 要执行的命令
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
async function execCommand(userId, command) {
  const { stream } = await containerManager.execInContainer(userId, command);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    stream.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    stream.on('error', (err) => {
      stderr += err.toString();
    });

    stream.on('end', () => {
      // 移除 ANSI 转义序列和控制字符
      // 此正则表达式匹配常见的终端转义序列，如 \x1b[...m
      const cleanedStdout = stdout
        .replace(/\x1b\[[0-9;]*m/g, '')           // 移除颜色代码
        .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')    // 移除其他转义序列
        .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')   // 移除控制字符（除 \n, \r, \t 外）
        .replace(/[\r\n]+/g, '\n')                   // 规范化换行符
        .trim();

      resolve({ stdout: cleanedStdout, stderr, exitCode: 0 });
    });
  });
}

/**
 * 验证和清理容器操作的文件路径
 * @param {string} filePath - 要验证的文件路径
 * @returns {object} - { safePath: string, error: string|null }
 */
export function validatePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { safePath: '', error: 'Invalid file path' };
  }

  // 移除所有空字节
  const cleanPath = filePath.replace(/\0/g, '');

  // 检查路径遍历尝试
  if (cleanPath.includes('..')) {
    return { safePath: '', error: 'Path traversal detected' };
  }

  // 检查绝对路径（应该是相对于 /workspace 的路径）
  if (cleanPath.startsWith('/')) {
    return { safePath: '', error: 'Absolute paths not allowed' };
  }

  // 检查 shell 命令注入
  const dangerousChars = [';', '&', '|', '$', '`', '\n', '\r'];
  for (const char of dangerousChars) {
    if (cleanPath.includes(char)) {
      return { safePath: '', error: 'Path contains dangerous characters' };
    }
  }

  return { safePath: cleanPath, error: null };
}

/**
 * 将主机路径转换为容器路径
 * @param {string} hostPath - 主机系统上的路径
 * @returns {string} - 容器内的路径
 */
export function hostPathToContainerPath(hostPath) {
  // 从项目根目录提取相对路径
  // 项目根目录在容器中挂载到 /workspace
  return hostPath.replace(/^.*:/, '/workspace');
}

/**
 * 从容器内读取文件内容
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径（相对于项目根目录）
 * @param {object} options - 选项
 * @returns {Promise<{content: string, path: string}>} - 文件内容和解析的路径
 */
export async function readFileInContainer(userId, filePath, options = {}) {
  const { encoding = 'utf8', projectPath = '', isContainerProject = false } = options;

  // 验证路径
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    // 获取或创建用户容器
    const container = await containerManager.getOrCreateContainer(userId);

    // 构建容器路径
    // 对于容器项目，使用 /home/node/.claude/projects
    // 对于工作区文件，使用 /workspace
    let containerPath = isContainerProject
      ? `/home/node/.claude/projects/${projectPath}`
      : '/workspace';

    if (!isContainerProject && projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // 执行 cat 命令读取文件
    const { stream } = await containerManager.execInContainer(
      userId,
      `cat "${containerPath}"`
    );

    // 收集输出
    let content = '';
    let errorOutput = '';

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        const output = chunk.toString();
        // 首先检查错误消息
        if (output.includes('No such file') || output.includes('cannot access')) {
          errorOutput += output;
        } else {
          // 追加内容并修剪末尾多余的空白/换行符
          content += output;
        }
      });

      stream.on('error', (err) => {
        reject(new Error(`Failed to read file: ${err.message}`));
      });

      stream.on('end', () => {
        if (errorOutput) {
          reject(new Error(`File not found: ${filePath}`));
        } else {
          // 修剪末尾空白但保留内部格式
          const trimmedContent = content.replace(/\s+$/, '');
          resolve({ content: trimmedContent, path: containerPath });
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to read file in container: ${error.message}`);
  }
}

/**
 * 在容器内写入文件内容
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径（相对于项目根目录）
 * @param {string} content - 要写入的文件内容
 * @param {object} options - 选项
 * @returns {Promise<{success: boolean, path: string}>}
 */
export async function writeFileInContainer(userId, filePath, content, options = {}) {
  const { encoding = 'utf8', projectPath = '', isContainerProject = false } = options;

  // 验证路径
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  // 检查内容大小
  const contentSize = Buffer.byteLength(content, encoding);
  if (contentSize > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${contentSize} bytes (max ${MAX_FILE_SIZE})`);
  }

  try {
    // 获取或创建用户容器
    const container = await containerManager.getOrCreateContainer(userId);

    // 构建容器路径
    // 对于容器项目，使用 /home/node/.claude/projects
    // 对于工作区文件，使用 /workspace
    let containerPath = isContainerProject
      ? `/home/node/.claude/projects/${projectPath}`
      : '/workspace';

    if (!isContainerProject && projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // 如果目录不存在则创建（等待完成）
    const dirPath = containerPath.substring(0, containerPath.lastIndexOf('/'));
    const projectsBasePath = '/home/node/.claude/projects';
    if (dirPath && dirPath !== '/workspace' && dirPath !== projectsBasePath) {
      await new Promise(async (resolve, reject) => {
        const result = await containerManager.execInContainer(
          userId,
          `mkdir -p "${dirPath}"`
        );
        const mkdirStream = result.stream;
        mkdirStream.on('end', resolve);
        mkdirStream.on('error', reject);
      });
    }

    // 使用 cat 和 heredoc 写入内容（最简单的方法）
    // 使用 base64 安全处理特殊字符
    const base64Content = Buffer.from(content, encoding).toString('base64');

    const { stream } = await containerManager.execInContainer(
      userId,
      `printf '%s' "$(echo '${base64Content}' | base64 -d)" > "${containerPath}"`
    );

    // 等待写入完成
    return new Promise((resolve, reject) => {
      let errorOutput = '';
      let resolved = false;
      let timeoutId = null;

      const doResolve = (result) => {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          resolve(result);
        }
      };

      const doReject = (err) => {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(err);
        }
      };

      stream.on('data', (chunk) => {
        const output = chunk.toString();
        if (output.toLowerCase().includes('error') ||
            output.toLowerCase().includes('cannot') ||
            output.toLowerCase().includes('permission denied')) {
          errorOutput += output;
        }
      });

      stream.on('error', (err) => {
        doReject(new Error(`Failed to write file: ${err.message}`));
      });

      stream.on('end', () => {
        if (errorOutput) {
          doReject(new Error(`Write failed: ${errorOutput}`));
        } else {
          doResolve({ success: true, path: containerPath });
        }
      });

      // 添加超时 - shell 命令应该快速完成
      timeoutId = setTimeout(() => {
        // 超时后如果未收到错误则假定成功
        doResolve({ success: true, path: containerPath });
      }, 3000);
    });
  } catch (error) {
    throw new Error(`Failed to write file in container: ${error.message}`);
  }
}

/**
 * 从容器内获取文件树
 * @param {number} userId - 用户 ID
 * @param {string} dirPath - 目录路径（相对于项目根目录）
 * @param {object} options - 选项
 * @returns {Promise<Array>} - 文件树结构
 */
export async function getFileTreeInContainer(userId, dirPath = '.', options = {}) {
  const {
    maxDepth = MAX_TREE_DEPTH,
    currentDepth = 0,
    showHidden = false,
    projectPath = '',
    isContainerProject = false  // 用于识别容器项目的新选项
  } = options;

  console.log('[FileContainer] getFileTreeInContainer - userId:', userId, 'dirPath:', dirPath, 'projectPath:', projectPath, 'isContainerProject:', isContainerProject);

  // 验证路径
  const { safePath, error } = validatePath(dirPath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    // 获取或创建用户容器
    console.log('[FileContainer] Getting or creating container for user', userId);
    const container = await containerManager.getOrCreateContainer(userId);
    console.log('[FileContainer] Container:', container.id, container.name);

    // 构建容器路径
    // 对于容器项目，使用 /home/node/.claude/projects
    // 对于工作区文件，使用 /workspace
    let containerPath = isContainerProject
      ? `/home/node/.claude/projects/${projectPath}`
      : '/workspace';

    if (!isContainerProject && projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // 使用 find 命令获取文件列表
    // -type f: 仅文件，-maxdepth: 限制深度
    const hiddenFlag = showHidden ? '' : '-not -path "*/.*"';

    const { stream } = await containerManager.execInContainer(
      userId,
      `cd "${containerPath}" && find . -maxdepth 1 ${hiddenFlag} -printf "%P|%y|%s|%T@\\n"`
    );

    // 收集和解析输出
    return new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        reject(new Error(`Failed to get file tree: ${err.message}`));
      });

      stream.on('end', () => {
        try {
          const items = [];
          const lines = output.trim().split('\n');

          for (const line of lines) {
            if (!line) continue;

            const parts = line.split('|');
            if (parts.length < 4) {
              console.warn('[FileContainer] Skipping malformed line:', JSON.stringify(line));
              continue;
            }

            const [name, type, size, mtime] = parts;

            // 跳过繁重的构建目录
            if (name === 'node_modules' || name === 'dist' || name === 'build') {
              continue;
            }

            // 解析和验证值
            const parsedSize = parseInt(size, 10);
            const parsedMtime = parseFloat(mtime);

            // 如果值无效则跳过
            if (isNaN(parsedSize) || isNaN(parsedMtime)) {
              console.warn('[FileContainer] Skipping line with invalid values:', JSON.stringify(line));
              continue;
            }

            // 创建日期对象并验证
            const dateObj = new Date(parsedMtime * 1000);
            if (isNaN(dateObj.getTime())) {
              console.warn('[FileContainer] Skipping line with invalid date:', JSON.stringify(line));
              continue;
            }

            const item = {
              name,
              path: `${containerPath}/${name}`,
              type: type === 'd' ? 'directory' : 'file',
              size: parsedSize,
              modified: dateObj.toISOString()
            };

            // 递归获取子目录
            if (item.type === 'directory' && currentDepth < maxDepth) {
              // 注意：我们在这里不递归调用以避免过多的 exec 调用
              // 这可以在以后增强
            }

            items.push(item);
          }

          // 排序：目录优先，然后按字母顺序
          items.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });

          resolve(items);
        } catch (parseError) {
          reject(new Error(`Failed to parse file tree: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to get file tree in container: ${error.message}`);
  }
}

/**
 * 从容器内获取文件统计信息
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径
 * @param {object} options - 选项
 * @returns {Promise<object>} - 文件统计信息
 */
export async function getFileStatsInContainer(userId, filePath, options = {}) {
  const { projectPath = '' } = options;

  // 验证路径
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    // 获取或创建用户容器
    const container = await containerManager.getOrCreateContainer(userId);

    // 构建容器路径
    let containerPath = '/workspace';
    if (projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // 使用 stat 命令获取文件信息
    const { stream } = await containerManager.execInContainer(
      userId,
      `stat -c "%F|%s|%Y|%A" "${containerPath}"`
    );

    return new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        reject(new Error(`Failed to get file stats: ${err.message}`));
      });

      stream.on('end', () => {
        try {
          const [type, size, mtime, mode] = output.trim().split('|');

          resolve({
            type: type.includes('directory') ? 'directory' : 'file',
            size: parseInt(size, 10),
            modified: new Date(parseInt(mtime, 10) * 1000).toISOString(),
            mode
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse file stats: ${parseError.message}`));
        }
      });
    });
  } catch (error) {
    throw new Error(`Failed to get file stats in container: ${error.message}`);
  }
}

/**
 * 从容器内删除文件
 * @param {number} userId - 用户 ID
 * @param {string} filePath - 文件路径
 * @param {object} options - 选项
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteFileInContainer(userId, filePath, options = {}) {
  const { projectPath = '' } = options;

  // 验证路径
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    // 获取或创建用户容器
    const container = await containerManager.getOrCreateContainer(userId);

    // 构建容器路径
    let containerPath = '/workspace';
    if (projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // 删除文件或目录
    const { stream } = await containerManager.execInContainer(
      userId,
      `rm -rf "${containerPath}"`
    );

    return new Promise((resolve, reject) => {
      let resolved = false;
      let timeoutId = null;

      const doResolve = (result) => {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          resolve(result);
        }
      };

      const doReject = (err) => {
        if (!resolved) {
          resolved = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(err);
        }
      };

      stream.on('error', (err) => {
        doReject(new Error(`Failed to delete file: ${err.message}`));
      });

      stream.on('end', () => {
        doResolve({ success: true });
      });

      // 添加超时 - rm 命令应该快速完成
      timeoutId = setTimeout(() => {
        doResolve({ success: true });
      }, 2000);
    });
  } catch (error) {
    throw new Error(`Failed to delete file in container: ${error.message}`);
  }
}

/**
 * 从容器内获取项目列表
 * 在容器模式下，项目存储在 /home/node/.claude/projects
 * 如果用户没有项目，自动创建默认工作区
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array>} - 项目列表
 */
export async function getProjectsInContainer(userId) {
  const claudeProjectsPath = '/home/node/.claude/projects';
  const defaultProjectName = 'my-workspace';

  console.log('[FileContainer] getProjectsInContainer - userId:', userId);

  try {
    // 获取或创建用户容器
    const container = await containerManager.getOrCreateContainer(userId);
    console.log('[FileContainer] Container:', container.id, container.name);

    // 确保项目目录存在
    await execCommand(userId, `mkdir -p "${claudeProjectsPath}"`);

    // 列出容器中的项目目录
    // 使用 find 命令而不是 ls 以避免颜色代码和控制字符
    const { stream } = await containerManager.execInContainer(
      userId,
      `find "${claudeProjectsPath}" -mindepth 1 -maxdepth 1 -type d -printf "%f\\n" 2>/dev/null || echo ""`
    );

    // 收集输出
    const projects = await new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        console.error('[FileContainer] Error listing projects:', err);
        // 如果项目目录不存在，返回空数组
        resolve([]);
      });

      stream.on('end', () => {
        try {
          const projectList = [];
          const lines = output.trim().split('\n');

          console.log('[FileContainer] Raw ls output:', JSON.stringify(output));
          console.log('[FileContainer] Split lines:', lines.length);

          for (const line of lines) {
            let projectName = line.trim();
            console.log('[FileContainer] Processing line:', JSON.stringify(line), 'trimmed:', JSON.stringify(projectName));

            // 从项目名称中清理控制字符
            projectName = projectName
              .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')   // 移除控制字符
              .replace(/[\r\n]/g, '')                      // 移除换行符
              .trim();

            if (!projectName || projectName === '') continue;

            // 对于容器项目，fullPath 是容器中的实际目录名
            // 不要将破折号解码为斜杠 - 目录名是字面值
            // 'path' 字段使用解码版本以实现 URL 兼容性，但 'fullPath' 必须与实际目录匹配
            const decodedPath = projectName.replace(/-/g, '/');

            projectList.push({
              name: projectName,
              path: decodedPath,
              displayName: projectName,
              fullPath: projectName,  // 使用实际目录名，而不是解码路径
              isContainerProject: true,
              sessions: [],
              sessionMeta: { hasMore: false, total: 0 },
              cursorSessions: [],
              codexSessions: []
            });
          }

          console.log('[FileContainer] Found projects in container:', projectList.length);
          console.log('[FileContainer] Project data:', JSON.stringify(projectList, null, 2));
          resolve(projectList);
        } catch (parseError) {
          console.error('[FileContainer] Error parsing projects:', parseError);
          reject(new Error(`Failed to parse projects: ${parseError.message}`));
        }
      });
    });

    // 如果用户没有项目，创建默认工作区
    if (projects.length === 0) {
      console.log('[FileContainer] No projects found for user, creating default workspace');

      try {
        // 创建默认项目目录
        const projectPath = `${claudeProjectsPath}/${defaultProjectName}`;
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

        // 为 Node.js 项目创建 package.json
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

        console.log('[FileContainer] Default workspace created successfully');

        // 返回新创建的默认项目
        projects.push({
          name: defaultProjectName,
          path: defaultProjectName,
          displayName: 'My Workspace',
          fullPath: defaultProjectName,
          isContainerProject: true,
          sessions: [],
          sessionMeta: { hasMore: false, total: 0 },
          cursorSessions: [],
          codexSessions: []
        });
      } catch (createError) {
        console.error('[FileContainer] Failed to create default workspace:', createError);
        // 如果创建失败则返回空列表
        return [];
      }
    }

    return projects;
  } catch (error) {
    console.error('[FileContainer] Failed to get projects in container:', error);
    throw new Error(`Failed to get projects in container: ${error.message}`);
  }
}
