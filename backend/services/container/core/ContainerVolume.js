/**
 * 容器卷初始化模块
 *
 * 负责为用户容器创建和初始化 Docker 命名卷。
 * 包括卷创建、数据复制、卷检查等功能。
 *
 * @module container/core/ContainerVolume
 */

import fs from 'fs';
import path from 'path';
import { getProjectRoot } from '../../../config/config.js';

/**
 * 容器卷初始化器类
 */
export class ContainerVolumeInitializer {
  /**
   * 创建卷初始化器实例
   * @param {object} options - 配置选项
   * @param {object} options.docker - Docker 客户端实例
   */
  constructor(options = {}) {
    this.docker = options.docker;
  }

  /**
   * 初始化用户命名卷
   * 创建一个临时容器来将数据复制到命名卷中
   * @param {number} userId - 用户 ID
   * @param {string} userDataDir - 用户数据目录（源）
   * @returns {Promise<void>}
   */
  async initializeUserVolume(userId, userDataDir) {
    const volumeName = `claude-user-data-${userId}`;

    try {
      // 1. 确保卷存在
      await this._ensureVolumeExists(volumeName);

      // 2. 检查是否需要初始化数据
      const shouldInitialize = await this._shouldInitializeVolume(volumeName, userDataDir);
      if (!shouldInitialize) {
        return;
      }

      // 3. 检查卷是否已经有工作区
      const hasExistingWorkspace = await this._checkVolumeHasData(volumeName);
      if (hasExistingWorkspace) {
        console.log(`[VolumeInit] Volume ${volumeName} already has workspace, skipping initialization`);
        return;
      }

      // 4. 初始化卷数据
      await this._copyDataToVolume(volumeName, userDataDir);

    } catch (error) {
      console.error(`[VolumeInit] Failed to initialize user volume: ${error.message}`);
      // 不抛出错误，允许容器创建继续
      // 卷已创建，只是没有初始化数据，容器启动时会自动创建目录
    }
  }

  /**
   * 确保卷存在，不存在则创建
   * @private
   * @param {string} volumeName - 卷名称
   * @returns {Promise<void>}
   */
  async _ensureVolumeExists(volumeName) {
    const volume = this.docker.getVolume(volumeName);
    let volumeExists = false;
    try {
      await volume.inspect();
      volumeExists = true;
      console.log(`[VolumeInit] Volume ${volumeName} exists`);
    } catch (err) {
      if (err.statusCode !== 404) {
        throw err;
      }
    }

    if (!volumeExists) {
      console.log(`[VolumeInit] Creating volume ${volumeName}`);
      await this.docker.createVolume({
        Name: volumeName,
        Driver: 'local'
      });
    }
  }

  /**
   * 检查是否需要初始化卷数据
   * @private
   * @param {string} volumeName - 卷名称
   * @param {string} userDataDir - 用户数据目录
   * @returns {Promise<boolean>}
   */
  async _shouldInitializeVolume(volumeName, userDataDir) {
    // 检查是否在容器内运行（userDataDir 是容器路径而非宿主机路径）
    // 如果是容器路径（如 /app/workspace），跳过数据复制
    // 只在 DATA_DIR 环境变量设置的情况下（宿主机路径）才进行数据复制
    const isHostPath = process.env.DATA_DIR && process.env.DATA_DIR !== path.join(getProjectRoot(), 'workspace');

    if (!isHostPath) {
      console.log(`[VolumeInit] Running in container or dev mode, skipping volume initialization`);
      return false;
    }

    // 检查源数据目录是否有内容
    try {
      const entries = await fs.promises.readdir(userDataDir);
      if (entries.length === 0) {
        console.log(`[VolumeInit] Source directory ${userDataDir} is empty, skipping data copy`);
        return false;
      }
    } catch (err) {
      console.log(`[VolumeInit] Source directory ${userDataDir} does not exist or is not accessible, skipping data copy`);
      return false;
    }

    return true;
  }

  /**
   * 检查卷是否已经有数据（通过临时容器检查）
   * @private
   * @param {string} volumeName - 卷名称
   * @returns {Promise<boolean>}
   */
  async _checkVolumeHasData(volumeName) {
    const tempCheckName = `claude-check-${Date.now()}`;
    try {
      const checkContainer = await this._createTempCheckContainer(tempCheckName, volumeName);
      const hasData = await this._runCheckContainer(checkContainer);
      await checkContainer.remove({ force: true });
      console.log(`[VolumeInit] Volume ${volumeName} data check result: ${hasData ? 'has data' : 'empty'}`);
      return hasData;
    } catch (checkErr) {
      // 检查失败，继续尝试初始化
      console.warn(`[VolumeInit] Volume check failed: ${checkErr.message}, will attempt initialization`);
      return false;
    }
  }

  /**
   * 创建临时检查容器
   * @private
   * @param {string} containerName - 容器名称
   * @param {string} volumeName - 卷名称
   * @returns {Promise<object>}
   */
  async _createTempCheckContainer(containerName, volumeName) {
    return new Promise((resolve, reject) => {
      this.docker.createContainer({
        name: containerName,
        Image: 'alpine:latest',
        HostConfig: {
          Volumes: {
            '/workspace': {
              Name: volumeName
            }
          },
          AutoRemove: false
        },
        // 检查 /workspace/my-workspace 是否存在
        Cmd: ['/bin/sh', '-c', '[ -d "/workspace/my-workspace" ] && echo "HAS_WORKSPACE" || echo "NO_WORKSPACE"']
      }, (err, container) => {
        if (err) reject(err);
        else resolve(container);
      });
    });
  }

  /**
   * 运行检查容器并返回结果
   * @private
   * @param {object} container - 容器实例
   * @returns {Promise<boolean>}
   */
  async _runCheckContainer(container) {
    await container.start();

    // 等待容器退出
    await new Promise((resolve) => {
      container.wait((err, data) => {
        resolve(data ? data.StatusCode : -1);
      });
    });

    // 获取容器输出以确认检查结果
    // 使用 logs() 而不是 attach()，因为 attach() 在 Docker-in-Docker 环境下
    // 可能不会触发 end 事件，导致 Promise 永远不 resolve
    const output = await new Promise((resolve, reject) => {
      container.logs({ stdout: true, stderr: true }, (err, logs) => {
        if (err) {
          // 如果 logs 失败，返回空字符串
          resolve('');
        } else {
          // logs 是 Buffer，转换为字符串
          resolve(logs ? logs.toString('utf-8') : '');
        }
      });
    });

    const hasWorkspace = output.includes('HAS_WORKSPACE');
    console.log(`[VolumeInit] Check container output: ${output.trim()}, hasWorkspace: ${hasWorkspace}`);
    return hasWorkspace;
  }

  /**
   * 将数据复制到卷中
   * @private
   * @param {string} volumeName - 卷名称
   * @param {string} userDataDir - 用户数据目录
   * @returns {Promise<void>}
   */
  async _copyDataToVolume(volumeName, userDataDir) {
    const tempContainerName = `claude-init-${Date.now()}`;
    console.log(`[VolumeInit] Initializing volume ${volumeName} with data from ${userDataDir}`);

    // 创建临时容器来初始化卷数据
    const tempContainer = await this._createInitContainer(tempContainerName, volumeName, userDataDir);

    // 启动临时容器并等待完成
    await tempContainer.start();
    await this._waitForContainer(tempContainer);

    // 删除临时容器
    try {
      await tempContainer.remove({ force: true });
      console.log(`[VolumeInit] Volume ${volumeName} initialized successfully`);
    } catch (err) {
      console.warn(`[VolumeInit] Failed to remove temp container: ${err.message}`);
    }
  }

  /**
   * 创建初始化容器
   * @private
   * @param {string} containerName - 容器名称
   * @param {string} volumeName - 卷名称
   * @param {string} userDataDir - 用户数据目录
   * @returns {Promise<object>}
   */
  async _createInitContainer(containerName, volumeName, userDataDir) {
    return new Promise((resolve, reject) => {
      this.docker.createContainer({
        name: containerName,
        Image: 'alpine:latest',
        HostConfig: {
          Volumes: {
            '/workspace': {
              Name: volumeName
            }
          },
          Binds: [
            `${userDataDir}:/source:ro`  // 只读挂载源数据目录
          ],
          AutoRemove: false
        },
        Cmd: ['/bin/sh', '-c', 'cp -r /source/. /workspace/ 2>/dev/null || true']
      }, (err, container) => {
        if (err) reject(err);
        else resolve(container);
      });
    });
  }

  /**
   * 等待容器执行完成
   * @private
   * @param {object} container - 容器实例
   * @returns {Promise<void>}
   */
  async _waitForContainer(container) {
    return new Promise((resolve, reject) => {
      container.wait((err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  }
}
