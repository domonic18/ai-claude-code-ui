/**
 * File Container Operations
 *
 * Containerized file operations for user-isolated file access.
 * All file operations are executed inside user containers for security.
 *
 * Key features:
 * - Container-isolated file read/write
 * - File tree traversal
 * - Path security validation
 * - Binary file support
 */

import containerManager from './ContainerManager.js';

// Maximum file size for read operations (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Maximum depth for file tree traversal
const MAX_TREE_DEPTH = 10;

/**
 * Execute a command in container and wait for completion
 * @param {number} userId - User ID
 * @param {string} command - Command to execute
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
      // Remove ANSI escape sequences and control characters
      // This regex matches common terminal escape sequences like \x1b[...m
      const cleanedStdout = stdout
        .replace(/\x1b\[[0-9;]*m/g, '')           // Remove color codes
        .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')    // Remove other escape sequences
        .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')   // Remove control characters (except \n, \r, \t)
        .replace(/[\r\n]+/g, '\n')                   // Normalize line endings
        .trim();

      resolve({ stdout: cleanedStdout, stderr, exitCode: 0 });
    });
  });
}

/**
 * Validate and sanitize file path for container operations
 * @param {string} filePath - File path to validate
 * @returns {object} - { safePath: string, error: string|null }
 */
export function validatePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { safePath: '', error: 'Invalid file path' };
  }

  // Remove any null bytes
  const cleanPath = filePath.replace(/\0/g, '');

  // Check for path traversal attempts
  if (cleanPath.includes('..')) {
    return { safePath: '', error: 'Path traversal detected' };
  }

  // Check for absolute paths (should be relative to /workspace)
  if (cleanPath.startsWith('/')) {
    return { safePath: '', error: 'Absolute paths not allowed' };
  }

  // Check for shell command injection
  const dangerousChars = [';', '&', '|', '$', '`', '\n', '\r'];
  for (const char of dangerousChars) {
    if (cleanPath.includes(char)) {
      return { safePath: '', error: 'Path contains dangerous characters' };
    }
  }

  return { safePath: cleanPath, error: null };
}

/**
 * Convert host path to container path
 * @param {string} hostPath - Path on host system
 * @returns {string} - Path inside container
 */
export function hostPathToContainerPath(hostPath) {
  // Extract the relative path from the project root
  // Project roots are mounted at /workspace in the container
  return hostPath.replace(/^.*:/, '/workspace');
}

/**
 * Read file content from inside a container
 * @param {number} userId - User ID
 * @param {string} filePath - Path to the file (relative to project root)
 * @param {object} options - Options
 * @returns {Promise<{content: string, path: string}>} - File content and resolved path
 */
export async function readFileInContainer(userId, filePath, options = {}) {
  const { encoding = 'utf8', projectPath = '', isContainerProject = false } = options;

  // Validate path
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    // Get or create user container
    const container = await containerManager.getOrCreateContainer(userId);

    // Build container path
    // For container projects, use /home/node/.claude/projects
    // For workspace files, use /workspace
    let containerPath = isContainerProject
      ? `/home/node/.claude/projects/${projectPath}`
      : '/workspace';

    if (!isContainerProject && projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // Execute cat command to read file
    const { stream } = await containerManager.execInContainer(
      userId,
      `cat "${containerPath}"`
    );

    // Collect output
    let content = '';
    let errorOutput = '';

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        const output = chunk.toString();
        // Check for error messages first
        if (output.includes('No such file') || output.includes('cannot access')) {
          errorOutput += output;
        } else {
          // Append content and trim any extra whitespace/newlines at end
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
          // Trim trailing whitespace but preserve internal formatting
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
 * Write file content inside a container
 * @param {number} userId - User ID
 * @param {string} filePath - Path to the file (relative to project root)
 * @param {string} content - File content to write
 * @param {object} options - Options
 * @returns {Promise<{success: boolean, path: string}>}
 */
export async function writeFileInContainer(userId, filePath, content, options = {}) {
  const { encoding = 'utf8', projectPath = '', isContainerProject = false } = options;

  // Validate path
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  // Check content size
  const contentSize = Buffer.byteLength(content, encoding);
  if (contentSize > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${contentSize} bytes (max ${MAX_FILE_SIZE})`);
  }

  try {
    // Get or create user container
    const container = await containerManager.getOrCreateContainer(userId);

    // Build container path
    // For container projects, use /home/node/.claude/projects
    // For workspace files, use /workspace
    let containerPath = isContainerProject
      ? `/home/node/.claude/projects/${projectPath}`
      : '/workspace';

    if (!isContainerProject && projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // Create directory if it doesn't exist (wait for completion)
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

    // Write content using cat with heredoc (simplest approach)
    // Use base64 to safely handle special characters
    const base64Content = Buffer.from(content, encoding).toString('base64');

    const { stream } = await containerManager.execInContainer(
      userId,
      `printf '%s' "$(echo '${base64Content}' | base64 -d)" > "${containerPath}"`
    );

    // Wait for write to complete
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

      // Add timeout - shell commands should complete quickly
      timeoutId = setTimeout(() => {
        // Assume success after timeout if no error received
        doResolve({ success: true, path: containerPath });
      }, 3000);
    });
  } catch (error) {
    throw new Error(`Failed to write file in container: ${error.message}`);
  }
}

/**
 * Get file tree from inside a container
 * @param {number} userId - User ID
 * @param {string} dirPath - Directory path (relative to project root)
 * @param {object} options - Options
 * @returns {Promise<Array>} - File tree structure
 */
export async function getFileTreeInContainer(userId, dirPath = '.', options = {}) {
  const {
    maxDepth = MAX_TREE_DEPTH,
    currentDepth = 0,
    showHidden = false,
    projectPath = '',
    isContainerProject = false  // New option to identify container projects
  } = options;

  console.log('[FileContainer] getFileTreeInContainer - userId:', userId, 'dirPath:', dirPath, 'projectPath:', projectPath, 'isContainerProject:', isContainerProject);

  // Validate path
  const { safePath, error } = validatePath(dirPath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    // Get or create user container
    console.log('[FileContainer] Getting or creating container for user', userId);
    const container = await containerManager.getOrCreateContainer(userId);
    console.log('[FileContainer] Container:', container.id, container.name);

    // Build container path
    // For container projects, use /home/node/.claude/projects
    // For workspace files, use /workspace
    let containerPath = isContainerProject
      ? `/home/node/.claude/projects/${projectPath}`
      : '/workspace';

    if (!isContainerProject && projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // Use find command to get file listing
    // -type f: files only, -maxdepth: limit depth
    const hiddenFlag = showHidden ? '' : '-not -path "*/.*"';

    const { stream } = await containerManager.execInContainer(
      userId,
      `cd "${containerPath}" && find . -maxdepth 1 ${hiddenFlag} -printf "%P|%y|%s|%T@\\n"`
    );

    // Collect and parse output
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

            // Skip heavy build directories
            if (name === 'node_modules' || name === 'dist' || name === 'build') {
              continue;
            }

            // Parse and validate values
            const parsedSize = parseInt(size, 10);
            const parsedMtime = parseFloat(mtime);

            // Skip if values are invalid
            if (isNaN(parsedSize) || isNaN(parsedMtime)) {
              console.warn('[FileContainer] Skipping line with invalid values:', JSON.stringify(line));
              continue;
            }

            // Create date object and validate
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

            // Recursively get subdirectories
            if (item.type === 'directory' && currentDepth < maxDepth) {
              // Note: We don't recursively call here to avoid too many exec calls
              // This can be enhanced later
            }

            items.push(item);
          }

          // Sort: directories first, then alphabetically
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
 * Get file stats from inside a container
 * @param {number} userId - User ID
 * @param {string} filePath - Path to the file
 * @param {object} options - Options
 * @returns {Promise<object>} - File stats
 */
export async function getFileStatsInContainer(userId, filePath, options = {}) {
  const { projectPath = '' } = options;

  // Validate path
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    // Get or create user container
    const container = await containerManager.getOrCreateContainer(userId);

    // Build container path
    let containerPath = '/workspace';
    if (projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // Use stat command to get file info
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
 * Delete file from inside a container
 * @param {number} userId - User ID
 * @param {string} filePath - Path to the file
 * @param {object} options - Options
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteFileInContainer(userId, filePath, options = {}) {
  const { projectPath = '' } = options;

  // Validate path
  const { safePath, error } = validatePath(filePath);
  if (error) {
    throw new Error(`Path validation failed: ${error}`);
  }

  try {
    // Get or create user container
    const container = await containerManager.getOrCreateContainer(userId);

    // Build container path
    let containerPath = '/workspace';
    if (projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // Remove file or directory
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

      // Add timeout - rm commands should complete quickly
      timeoutId = setTimeout(() => {
        doResolve({ success: true });
      }, 2000);
    });
  } catch (error) {
    throw new Error(`Failed to delete file in container: ${error.message}`);
  }
}

/**
 * Get projects list from inside a container
 * In container mode, projects are stored in /home/node/.claude/projects
 * Automatically creates a default workspace if user has no projects
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - List of projects
 */
export async function getProjectsInContainer(userId) {
  const claudeProjectsPath = '/home/node/.claude/projects';
  const defaultProjectName = 'my-workspace';

  console.log('[FileContainer] getProjectsInContainer - userId:', userId);

  try {
    // Get or create user container
    const container = await containerManager.getOrCreateContainer(userId);
    console.log('[FileContainer] Container:', container.id, container.name);

    // Ensure projects directory exists
    await execCommand(userId, `mkdir -p "${claudeProjectsPath}"`);

    // List project directories in container
    // Use find command instead of ls to avoid color codes and control characters
    const { stream } = await containerManager.execInContainer(
      userId,
      `find "${claudeProjectsPath}" -mindepth 1 -maxdepth 1 -type d -printf "%f\\n" 2>/dev/null || echo ""`
    );

    // Collect output
    const projects = await new Promise((resolve, reject) => {
      let output = '';

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('error', (err) => {
        console.error('[FileContainer] Error listing projects:', err);
        // If projects directory doesn't exist, return empty array
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

            // Clean control characters from project name
            projectName = projectName
              .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')   // Remove control characters
              .replace(/[\r\n]/g, '')                      // Remove line breaks
              .trim();

            if (!projectName || projectName === '') continue;

            // For container projects, the fullPath is the actual directory name in the container
            // Do NOT decode dashes to slashes - the directory name is literal
            // The 'path' field uses decoded version for URL compatibility, but 'fullPath' must match actual directory
            const decodedPath = projectName.replace(/-/g, '/');

            projectList.push({
              name: projectName,
              path: decodedPath,
              displayName: projectName,
              fullPath: projectName,  // Use actual directory name, not decoded path
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

    // If user has no projects, create a default workspace
    if (projects.length === 0) {
      console.log('[FileContainer] No projects found for user, creating default workspace');

      try {
        // Create default project directory
        const projectPath = `${claudeProjectsPath}/${defaultProjectName}`;
        await execCommand(userId, `mkdir -p "${projectPath}"`);

        // Initialize as a git repository
        await execCommand(userId, `cd "${projectPath}" && git init`);

        // Create a README file
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

        // Create .gitignore
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

        // Create package.json for Node.js projects
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

        // Return the newly created default project
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
        // Return empty list if creation fails
        return [];
      }
    }

    return projects;
  } catch (error) {
    console.error('[FileContainer] Failed to get projects in container:', error);
    throw new Error(`Failed to get projects in container: ${error.message}`);
  }
}
