/**
 * Container Helper
 *
 * Utilities for verifying container state in integration tests.
 * Used to check file existence, content, and session data in sandbox containers.
 *
 * @module tests/integration/helpers/container-helper
 */

import Docker from 'dockerode';

/**
 * Container helper for Docker operations in tests
 */
export class ContainerHelper {
  constructor() {
    /** @type {Docker|null} */
    this.docker = null;
    /** @type {Map<number, Object>} Container info cache */
    this.containerCache = new Map();
  }

  /**
   * Initialize Docker connection
   */
  async init() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * Find a user's container by userId
   *
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} Docker container object
   */
  async findUserContainer(userId) {
    if (!this.docker) {
      await this.init();
    }

    // Check cache first
    if (this.containerCache.has(userId)) {
      const cached = this.containerCache.get(userId);
      try {
        const info = await this.docker.getContainer(cached.id).inspect();
        if (info.State.Running) {
          return this.docker.getContainer(cached.id);
        }
      } catch {
        // Container gone, remove from cache
        this.containerCache.delete(userId);
      }
    }

    // Search by name convention: claude-user-{userId}
    const containerName = `claude-user-${userId}`;
    try {
      const containers = await this.docker.listContainers({ all: true });
      for (const containerInfo of containers) {
        if (containerInfo.Names.some(n => n.includes(containerName))) {
          const container = this.docker.getContainer(containerInfo.Id);
          this.containerCache.set(userId, { id: containerInfo.Id });
          return container;
        }
      }
    } catch (error) {
      console.error('[ContainerHelper] Error listing containers:', error.message);
    }

    return null;
  }

  /**
   * Execute a command in the user's container
   *
   * @param {number} userId - User ID
   * @param {string} command - Shell command to execute
   * @param {number} [timeout=10000] - Timeout in ms
   * @returns {Promise<string>} Command output
   */
  async execInContainer(userId, command, timeout = 10000) {
    const container = await this.findUserContainer(userId);
    if (!container) {
      throw new Error(`Container not found for user ${userId}`);
    }

    const exec = await container.exec({
      Cmd: ['sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    return new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => {
        stream.destroy();
        resolve(output);
      }, timeout);

      stream.on('data', (chunk) => {
        output += chunk.toString();
      });

      stream.on('end', () => {
        clearTimeout(timer);
        resolve(output);
      });

      stream.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  /**
   * Check if a file exists in the user's container
   *
   * @param {number} userId - User ID
   * @param {string} filePath - File path inside container
   * @returns {Promise<boolean>}
   */
  async fileExists(userId, filePath) {
    try {
      const output = await this.execInContainer(userId, `test -f "${filePath}" && echo "EXISTS" || echo "NOT_FOUND"`);
      return output.includes('EXISTS');
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory exists in the user's container
   *
   * @param {number} userId - User ID
   * @param {string} dirPath - Directory path inside container
   * @returns {Promise<boolean>}
   */
  async dirExists(userId, dirPath) {
    try {
      const output = await this.execInContainer(userId, `test -d "${dirPath}" && echo "EXISTS" || echo "NOT_FOUND"`);
      return output.includes('EXISTS');
    } catch {
      return false;
    }
  }

  /**
   * Read file content from the user's container
   *
   * @param {number} userId - User ID
   * @param {string} filePath - File path inside container
   * @returns {Promise<string>} File content
   */
  async readFile(userId, filePath) {
    return this.execInContainer(userId, `cat "${filePath}"`);
  }

  /**
   * Get file size in bytes from the user's container
   *
   * @param {number} userId - User ID
   * @param {string} filePath - File path inside container
   * @returns {Promise<number|null>} File size in bytes, or null if not found
   */
  async getFileSize(userId, filePath) {
    try {
      const output = await this.execInContainer(userId, `stat -c "%s" "${filePath}" 2>/dev/null || echo "0"`);
      return parseInt(output.trim(), 10) || 0;
    } catch {
      return null;
    }
  }

  /**
   * List files in a directory in the user's container
   *
   * @param {number} userId - User ID
   * @param {string} dirPath - Directory path inside container
   * @returns {Promise<string[]>} List of filenames
   */
  async listDir(userId, dirPath) {
    const output = await this.execInContainer(userId, `ls -1 "${dirPath}" 2>/dev/null || echo ""`);
    return output.trim().split('\n').filter(Boolean);
  }

  /**
   * Write a file to the user's container
   *
   * @param {number} userId - User ID
   * @param {string} filePath - File path inside container
   * @param {string} content - File content
   * @returns {Promise<void>}
   */
  async writeFile(userId, filePath, content) {
    const base64Content = Buffer.from(content, 'utf8').toString('base64');
    await this.execInContainer(
      userId,
      `mkdir -p "$(dirname "${filePath}")" && printf '%s' "${base64Content}" | base64 -d > "${filePath}"`
    );
  }

  /**
   * Delete a file in the user's container
   *
   * @param {number} userId - User ID
   * @param {string} filePath - File path inside container
   * @returns {Promise<void>}
   */
  async deleteFile(userId, filePath) {
    await this.execInContainer(userId, `rm -f "${filePath}"`);
  }
}
