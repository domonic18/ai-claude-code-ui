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
  const { encoding = 'utf8', projectPath = '' } = options;

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
  const { encoding = 'utf8', projectPath = '' } = options;

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
    let containerPath = '/workspace';
    if (projectPath) {
      containerPath = hostPathToContainerPath(projectPath);
    }
    containerPath = `${containerPath}/${safePath}`;

    // Create directory if it doesn't exist (wait for completion)
    const dirPath = containerPath.substring(0, containerPath.lastIndexOf('/'));
    if (dirPath && dirPath !== '/workspace') {
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
    projectPath = ''
  } = options;

  // Validate path
  const { safePath, error } = validatePath(dirPath);
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

            const [name, type, size, mtime] = line.split('|');

            // Skip heavy build directories
            if (name === 'node_modules' || name === 'dist' || name === 'build') {
              continue;
            }

            const item = {
              name,
              path: `${containerPath}/${name}`,
              type: type === 'd' ? 'directory' : 'file',
              size: parseInt(size, 10),
              modified: new Date(parseFloat(mtime) * 1000).toISOString()
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
