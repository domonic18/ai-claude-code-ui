/**
 * Container Manager
 *
 * Manages Docker container lifecycle for multi-user isolation.
 * Each user gets their own container with resource limits and security policies.
 *
 * Key features:
 * - Container lifecycle management (create, start, stop, destroy)
 * - Container pool caching for performance
 * - Resource limits by user tier
 * - Docker volume management for persistence
 * - Health checks and monitoring
 */

import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { containersDb } from '../../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Container resource limits by user tier
 */
const RESOURCE_LIMITS = {
  free: {
    memory: 1 * 1024 * 1024 * 1024,  // 1GB
    cpuQuota: 50000,                  // 0.5 CPU
    cpuPeriod: 100000,
    securityOptions: []
  },
  pro: {
    memory: 4 * 1024 * 1024 * 1024,  // 4GB
    cpuQuota: 200000,                 // 2 CPU
    cpuPeriod: 100000,
    securityOptions: []
  },
  enterprise: {
    memory: 8 * 1024 * 1024 * 1024,  // 8GB
    cpuQuota: 400000,                 // 4 CPU
    cpuPeriod: 100000,
    securityOptions: []
  }
};

/**
 * Container Manager class
 */
class ContainerManager {
  constructor(options = {}) {
    // Initialize Docker client
    // Support multiple connection methods: socket path, HTTP, or auto-detect
    let dockerOptions = {};

    // If options explicitly provide socketPath or host, use them
    if (options.socketPath) {
      dockerOptions = { socketPath: options.socketPath };
    } else if (options.host) {
      dockerOptions = { host: options.host };
      // Add TLS options if provided
      if (options.ca) dockerOptions.ca = options.ca;
      if (options.cert) dockerOptions.cert = options.cert;
      if (options.key) dockerOptions.key = options.key;
    } else if (process.env.DOCKER_HOST) {
      // Use DOCKER_HOST environment variable
      dockerOptions = { host: process.env.DOCKER_HOST };
      if (process.env.DOCKER_CERT_PATH) {
        dockerOptions.ca = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'ca.pem'));
        dockerOptions.cert = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'cert.pem'));
        dockerOptions.key = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'key.pem'));
      }
    } else if (process.platform !== 'darwin') {
      // Only specify socket path on non-macOS platforms
      // On macOS, Docker Desktop requires special handling - let dockerode auto-detect
      dockerOptions = { socketPath: '/var/run/docker.sock' };
    }
    // On macOS (darwin), pass empty object to let dockerode fully auto-detect Docker Desktop

    this.docker = new Docker(dockerOptions);

    // Container pool cache: userId -> containerInfo
    this.containers = new Map();

    // Configuration
    this.config = {
      dataDir: options.dataDir || path.join(PROJECT_ROOT, 'workspace'),
      image: options.image || 'claude-code-runtime:latest',
      network: options.network || 'claude-network',
      ...options
    };

    // Start cleanup interval
    this.startCleanupInterval();

    // Load containers from database on startup
    this.loadContainersFromDatabase().catch(err => {
      console.warn('[ContainerManager] Failed to load containers from database:', err.message);
    });
  }

  /**
   * Get or create a container for the user
   * @param {number} userId - User ID
   * @param {object} userConfig - User configuration
   * @returns {Promise<ContainerInfo>} Container information
   */
  async getOrCreateContainer(userId, userConfig = {}) {
    const containerName = `claude-user-${userId}`;

    // Check cache for existing container
    if (this.containers.has(userId)) {
      const container = this.containers.get(userId);
      const status = await this.getContainerStatus(container.id);

      if (status === 'running') {
        // Update last active time
        container.lastActive = new Date();

        // Update in database
        containersDb.updateContainerLastActive(container.id).catch(err => {
          console.warn(`[ContainerManager] Failed to update last_active: ${err.message}`);
        });

        return container;
      }

      // Container not running, remove from cache
      this.containers.delete(userId);
    }

    // Check if container exists in Docker (handles server restart scenario)
    try {
      const existingContainer = this.docker.getContainer(containerName);
      const containerInfo = await existingContainer.inspect();

      if (containerInfo.State.Running) {
        // Container is running, cache and return it
        console.log(`[ContainerManager] Found existing running container for user ${userId}: ${containerName}`);
        const info = {
          id: containerInfo.Id,
          name: containerName,
          userId,
          status: 'running',
          createdAt: new Date(containerInfo.Created),
          lastActive: new Date()
        };
        this.containers.set(userId, info);

        // Update last_active in database
        containersDb.updateContainerLastActive(containerInfo.Id).catch(err => {
          console.warn(`[ContainerManager] Failed to update last_active: ${err.message}`);
        });

        return info;
      } else {
        // Container exists but not running, remove it
        console.log(`[ContainerManager] Removing stale container for user ${userId}: ${containerName}`);
        await existingContainer.remove({ force: true }).catch(err => {
          console.warn(`[ContainerManager] Failed to remove stale container: ${err.message}`);
        });
      }
    } catch (err) {
      // Container doesn't exist, proceed to create
      if (err.statusCode === 404) {
        console.log(`[ContainerManager] No existing container for user ${userId}, creating new one`);
      } else {
        console.warn(`[ContainerManager] Error checking existing container: ${err.message}`);
      }
    }

    // Create new container
    return await this.createContainer(userId, userConfig);
  }

  /**
   * Create a new container for the user
   * @param {number} userId - User ID
   * @param {object} userConfig - User configuration
   * @returns {Promise<ContainerInfo>} Container information
   */
  async createContainer(userId, userConfig = {}) {
    const containerName = `claude-user-${userId}`;
    const volumeName = `claude-user-${userId}`;
    const userDataDir = path.join(this.config.dataDir, 'users', `user_${userId}`, 'data');

    try {
      // 1. Create user data directory
      await fs.promises.mkdir(userDataDir, { recursive: true });

      // 2. Build container configuration
      const containerConfig = this.buildContainerConfig({
        name: containerName,
        volumeName,
        userDataDir,
        userId,
        userConfig
      });

      // 3. Create container
      const container = await new Promise((resolve, reject) => {
        this.docker.createContainer(containerConfig, (err, container) => {
          if (err) reject(err);
          else resolve(container);
        });
      });

      // 4. Start container
      await container.start();

      // 5. Wait for container to be ready
      await this.waitForContainerReady(container.id);

      // 6. Cache container info
      const containerInfo = {
        id: container.id,
        name: containerName,
        userId,
        status: 'running',
        createdAt: new Date(),
        lastActive: new Date()
      };

      this.containers.set(userId, containerInfo);

      // 7. Write to database
      try {
        containersDb.createContainer(userId, container.id, containerName);
        console.log(`[ContainerManager] Container record saved to database: ${containerName}`);
      } catch (dbErr) {
        console.warn(`[ContainerManager] Failed to save container to database: ${dbErr.message}`);
      }

      return containerInfo;
    } catch (error) {
      throw new Error(`Failed to create container for user ${userId}: ${error.message}${error.reason ? ' (' + error.reason + ')' : ''}`);
    }
  }

  /**
   * Load containers from database into memory cache
   * Called on startup to restore container state from database
   * @returns {Promise<void>}
   */
  async loadContainersFromDatabase() {
    try {
      console.log('[ContainerManager] Loading containers from database...');
      const activeContainers = containersDb.listActiveContainers();

      for (const dbContainer of activeContainers) {
        const { user_id, container_id, container_name, created_at, last_active } = dbContainer;

        // Verify container still exists in Docker
        try {
          const dockerContainer = this.docker.getContainer(container_id);
          const containerInfo = await dockerContainer.inspect();

          if (containerInfo.State.Running) {
            // Container is running, restore to cache
            this.containers.set(user_id, {
              id: container_id,
              name: container_name,
              userId: user_id,
              status: 'running',
              createdAt: new Date(created_at),
              lastActive: new Date(last_active)
            });
            console.log(`[ContainerManager] Restored container for user ${user_id}: ${container_name}`);
          } else {
            // Container not running, update database status
            containersDb.updateContainerStatus(container_id, 'stopped');
            console.log(`[ContainerManager] Container ${container_name} is stopped, status updated in database`);
          }
        } catch (dockerErr) {
          // Container doesn't exist in Docker, remove from database
          if (dockerErr.statusCode === 404) {
            console.log(`[ContainerManager] Container ${container_name} not found in Docker, removing from database`);
            containersDb.deleteContainer(container_id);
          } else {
            console.warn(`[ContainerManager] Error checking container ${container_name}: ${dockerErr.message}`);
          }
        }
      }

      console.log(`[ContainerManager] Loaded ${this.containers.size} containers from database`);
    } catch (error) {
      console.error('[ContainerManager] Failed to load containers from database:', error);
    }
  }

  /**
   * Build container configuration
   * @param {object} options - Configuration options
   * @returns {object} Docker container configuration
   */
  buildContainerConfig(options) {
    const { name, volumeName, userDataDir, userId, userConfig } = options;
    const tier = userConfig.tier || 'free';
    const resourceLimits = RESOURCE_LIMITS[tier] || RESOURCE_LIMITS.free;

    return {
      name: name,
      Image: this.config.image,
      Env: [
        `USER_ID=${userId}`,
        `NODE_ENV=production`,
        `USER_TIER=${tier}`,
        `CLAUDE_CONFIG_DIR=/home/node/.claude`,
        `DATABASE_PATH=/workspace/database/claude-code.db`
      ],
      HostConfig: {
        Binds: [
          `${userDataDir}:/workspace:rw`,
          `${userDataDir}/.claude:/home/node/.claude:rw`
        ],
        Memory: resourceLimits.memory,
        CpuQuota: resourceLimits.cpuQuota,
        CpuPeriod: resourceLimits.cpuPeriod,
        NetworkMode: this.config.network,
        ReadonlyRootfs: false,
        LogConfig: {
          Type: 'json-file',
          Config: {
            'max-size': '10m',
            'max-file': '3'
          }
        }
      },
      Labels: {
        'com.claude-code.user': String(userId),
        'com.claude-code.managed': 'true',
        'com.claude-code.tier': tier,
        'com.claude-code.created': new Date().toISOString()
      }
    };
  }

  /**
   * Execute a command inside a container
   * @param {number} userId - User ID
   * @param {string} command - Command to execute
   * @param {object} options - Execution options
   * @returns {Promise<object>} Execution stream
   */
  async execInContainer(userId, command, options = {}) {
    const container = await this.getOrCreateContainer(userId);

    const execConfig = {
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      AttachStdin: !!options.stdin,
      Tty: options.tty || false,
      WorkingDir: options.cwd || '/workspace',
      Env: options.env ? Object.entries(options.env).map(([k, v]) => `${k}=${v}`) : []
    };

    const exec = await this.docker.getContainer(container.id).exec(execConfig);
    const stream = await exec.start({ Detach: false, Tty: execConfig.Tty });

    return { exec, stream };
  }

  /**
   * Stop a user's container
   * @param {number} userId - User ID
   * @param {number} timeout - Timeout in seconds
   * @returns {Promise<void>}
   */
  async stopContainer(userId, timeout = 10) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      return;
    }

    try {
      const container = this.docker.getContainer(containerInfo.id);
      await container.stop({ t: timeout });
      containerInfo.status = 'stopped';
    } catch (error) {
      if (!error.message.includes('is not running')) {
        throw error;
      }
    }
  }

  /**
   * Start a stopped container
   * @param {number} userId - User ID
   * @returns {Promise<void>}
   */
  async startContainer(userId) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      throw new Error(`No container found for user ${userId}`);
    }

    const container = this.docker.getContainer(containerInfo.id);
    await container.start();

    await this.waitForContainerReady(containerInfo.id);

    containerInfo.status = 'running';
    containerInfo.lastActive = new Date();
  }

  /**
   * Destroy a user's container
   * @param {number} userId - User ID
   * @param {boolean} removeVolume - Whether to remove the volume
   * @returns {Promise<void>}
   */
  async destroyContainer(userId, removeVolume = false) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      return;
    }

    try {
      const container = this.docker.getContainer(containerInfo.id);

      // Stop container
      try {
        await container.stop({ t: 5 });
      } catch (error) {
        // Ignore if already stopped
      }

      // Remove container
      await container.remove();

      // Remove from cache
      this.containers.delete(userId);

      // Remove from database
      try {
        containersDb.deleteContainer(containerInfo.id);
        console.log(`[ContainerManager] Container record removed from database: ${containerInfo.name}`);
      } catch (dbErr) {
        console.warn(`[ContainerManager] Failed to remove container from database: ${dbErr.message}`);
      }

      // Optionally remove volume
      if (removeVolume) {
        const userDataDir = path.join(this.config.dataDir, 'users', `user_${userId}`, 'data');
        await fs.promises.rm(userDataDir, { recursive: true, force: true });
      }
    } catch (error) {
      throw new Error(`Failed to destroy container for user ${userId}: ${error.message}`);
    }
  }

  /**
   * Get container status
   * @param {string} containerId - Container ID
   * @returns {Promise<string>} Container status
   */
  async getContainerStatus(containerId) {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State.Status;
    } catch (error) {
      return 'removed';
    }
  }

  /**
   * Wait for container to be ready
   * @param {string} containerId - Container ID
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>}
   */
  async waitForContainerReady(containerId, timeout = 60000) {
    const startTime = Date.now();
    const container = this.docker.getContainer(containerId);

    while (Date.now() - startTime < timeout) {
      try {
        const info = await container.inspect();
        if (info.State.Status === 'running') {
          // Check health endpoint if available
          if (info.Config.Healthcheck) {
            if (info.State.Health && info.State.Health.Status === 'healthy') {
              return true;
            }
          } else {
            return true;
          }
        }
      } catch (error) {
        // Container not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Container ${containerId} failed to become ready within ${timeout}ms`);
  }

  /**
   * Get container statistics
   * @param {number} userId - User ID
   * @returns {Promise<object>} Container statistics
   */
  async getContainerStats(userId) {
    const containerInfo = this.containers.get(userId);
    if (!containerInfo) {
      throw new Error(`No container found for user ${userId}`);
    }

    const container = this.docker.getContainer(containerInfo.id);
    const stats = await container.stats({ stream: false });

    return {
      cpuPercent: this.calculateCPUPercent(stats),
      memoryUsage: stats.memory_stats?.usage || 0,
      memoryLimit: stats.memory_stats?.limit || 0,
      memoryPercent: stats.memory_stats
        ? (stats.memory_stats.usage / stats.memory_stats.limit) * 100
        : 0,
      networkRx: stats.networks?.eth0?.rx_bytes || 0,
      networkTx: stats.networks?.eth0?.tx_bytes || 0,
      blockRead: stats.blkio_stats?.io_service_bytes_recursive?.find(x => x.op === 'Read')?.value || 0,
      blockWrite: stats.blkio_stats?.io_service_bytes_recursive?.find(x => x.op === 'Write')?.value || 0
    };
  }

  /**
   * Calculate CPU usage percentage
   * @param {object} stats - Container stats
   * @returns {number} CPU percentage
   */
  calculateCPUPercent(stats) {
    if (!stats.cpu_stats || !stats.precpu_stats) {
      return 0;
    }

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;

    if (systemDelta === 0) {
      return 0;
    }

    const cpuPercent = (cpuDelta / systemDelta) * (stats.cpu_stats.online_cpus || 1) * 100;
    return Math.round(cpuPercent * 100) / 100;
  }

  /**
   * Cleanup idle containers
   * @param {number} idleTime - Idle time in milliseconds (default: 2 hours)
   * @returns {Promise<number>} Number of containers cleaned up
   */
  async cleanupIdleContainers(idleTime = 2 * 60 * 60 * 1000) {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [userId, container] of this.containers.entries()) {
      const timeSinceActive = now - container.lastActive.getTime();

      if (timeSinceActive > idleTime) {
        try {
          await this.destroyContainer(userId, false);
          cleanedCount++;
        } catch (error) {
          console.error(`Failed to cleanup container for user ${userId}:`, error.message);
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Start cleanup interval
   * @param {number} interval - Check interval in milliseconds (default: 30 minutes)
   */
  startCleanupInterval(interval = 30 * 60 * 1000) {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(async () => {
      try {
        const count = await this.cleanupIdleContainers();
        if (count > 0) {
          console.log(`Cleaned up ${count} idle containers`);
        }
      } catch (error) {
        console.error('Error during container cleanup:', error.message);
      }
    }, interval);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get all managed containers
   * @returns {Array} Array of container info objects
   */
  getAllContainers() {
    return Array.from(this.containers.values());
  }

  /**
   * Get container by user ID
   * @param {number} userId - User ID
   * @returns {ContainerInfo|undefined} Container info or undefined
   */
  getContainerByUserId(userId) {
    return this.containers.get(userId);
  }
}

// Lazy singleton instance
let _singletonInstance = null;

/**
 * Get or create the singleton ContainerManager instance
 * @returns {ContainerManager} The singleton instance
 */
function getContainerManager() {
  if (!_singletonInstance) {
    _singletonInstance = new ContainerManager();
  }
  return _singletonInstance;
}

// Export a proxy that forwards all operations to the singleton instance
const containerManager = new Proxy({}, {
  get(target, prop) {
    const instance = getContainerManager();
    const value = instance[prop];

    // If it's a function, bind it to the instance
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  },
  set(target, prop, value) {
    const instance = getContainerManager();
    instance[prop] = value;
    return true;
  },
  has(target, prop) {
    const instance = getContainerManager();
    return prop in instance;
  }
});

export default containerManager;
export { ContainerManager, RESOURCE_LIMITS };
