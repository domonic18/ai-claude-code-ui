/**
 * 容器 Docker 操作服务
 *
 * 封装底层 Docker API 调用：
 * - 容器创建、启动、停止、销毁
 * - 卷管理
 * - 孤立容器清理
 * - 容器内命令执行
 * - 交互式 shell 附加
 *
 * 所有方法接收 docker 客户端和配置参数，不依赖 LifecycleManager 状态。
 *
 * @module container/core/ContainerOperations
 */

import path from 'path';
import fs from 'fs';
import { CONTAINER_TIMEOUTS } from '../../../config/config.js';
import { ContainerConfigBuilder } from './ContainerConfig.js';
import { ContainerHealthMonitor } from './ContainerHealth.js';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('container/core/ContainerOperations');

/**
 * 确保命名卷存在，如果不存在则创建
 * @param {Object} docker - Docker 客户端
 * @param {string} volumeName - 卷名称
 * @returns {Promise<void>}
 */
export async function ensureVolumeExists(docker, volumeName) {
    try {
        const volume = docker.getVolume(volumeName);
        await volume.inspect();
        logger.debug(`Volume ${volumeName} already exists`);
    } catch (err) {
        if (err.statusCode === 404) {
            await new Promise((resolve, reject) => {
                docker.createVolume({ Name: volumeName, Driver: 'local' }, (err, volume) => {
                    if (err) reject(err);
                    else resolve(volume);
                });
            });
            logger.debug(`Created volume: ${volumeName}`);
        } else {
            throw err;
        }
    }
}

/**
 * 同步删除孤立容器
 * @param {Object} docker - Docker 客户端
 * @param {string} containerName - 容器名称
 * @returns {Promise<void>}
 */
export async function removeOrphanedContainer(docker, containerName) {
    try {
        const container = docker.getContainer(containerName);
        const info = await container.inspect();

        // 如果容器正在运行，先停止
        if (info.State.Running || info.State.Paused) {
            await container.stop({ t: 5 }).catch(err => {
                logger.warn(`Failed to stop orphaned container: ${err.message}`);
            });
        }

        await container.remove({ force: true });
        await waitForContainerRemoved(docker, containerName, 10000);
        logger.debug(`Removed orphaned container: ${containerName}`);
    } catch (err) {
        if (err.statusCode === 404) return;
        throw err;
    }
}

/**
 * 等待容器被删除
 * @param {Object} docker - Docker 客户端
 * @param {string} containerName - 容器名称
 * @param {number} [timeout] - 超时时间（毫秒）
 * @returns {Promise<void>}
 */
export async function waitForContainerRemoved(docker, containerName, timeout = CONTAINER_TIMEOUTS.remove) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
        try {
            await docker.getContainer(containerName).inspect();
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
            if (err.statusCode === 404) return;
            throw err;
        }
    }

    throw new Error(`Timeout waiting for container ${containerName} to be removed`);
}

/**
 * 创建并启动新容器
 * @param {Object} docker - Docker 客户端
 * @param {Object} params - 创建参数
 * @param {string} params.containerName - 容器名称
 * @param {string} params.userDataDir - 用户数据目录
 * @param {number} params.userId - 用户 ID
 * @param {Object} params.userConfig - 用户配置
 * @param {string} params.image - Docker 镜像
 * @param {string} params.network - 网络模式
 * @returns {Promise<Object>} Docker 容器实例
 */
export async function createAndStartContainer(docker, params) {
    const { containerName, userDataDir, userId, userConfig, image, network } = params;
    const configBuilder = new ContainerConfigBuilder();

    // 确保用户数据目录存在
    await fs.promises.mkdir(userDataDir, { recursive: true });
    logger.debug(`Created user data directory: ${userDataDir}`);

    // 创建 .claude 目录
    const claudeDir = path.join(userDataDir, '.claude');
    await fs.promises.mkdir(claudeDir, { recursive: true });

    // 确保命名卷存在
    const volumeName = `claude-user-${userId}-workspace`;
    await ensureVolumeExists(docker, volumeName);

    // 构建容器配置
    const containerConfig = configBuilder.buildConfig({
        name: containerName,
        userDataDir,
        userId,
        userConfig,
        image,
        network
    });

    // 清理孤立容器
    await removeOrphanedContainer(docker, containerName);

    // 创建容器
    logger.info(`Creating container ${containerName}...`);
    const container = await new Promise((resolve, reject) => {
        docker.createContainer(containerConfig, (err, container) => {
            if (err) {
                logger.error(`Failed to create container:`, err);
                reject(err);
            } else {
                logger.info(`Container ${containerName} created with ID: ${container.id}`);
                resolve(container);
            }
        });
    });

    // 启动容器
    logger.info(`Starting container ${containerName}...`);
    await container.start();
    logger.info(`Container ${containerName} started`);

    // 等待容器完全启动
    await new Promise(resolve => setTimeout(resolve, 2000));

    return container;
}

/**
 * 停止容器
 * @param {Object} docker - Docker 客户端
 * @param {string} containerId - 容器 ID
 * @param {number} [timeout] - 超时时间（秒）
 * @returns {Promise<void>}
 */
export async function stopContainer(docker, containerId, timeout = CONTAINER_TIMEOUTS.stop) {
    try {
        const container = docker.getContainer(containerId);
        await container.stop({ t: timeout });
    } catch (error) {
        if (!error.message.includes('is not running')) {
            throw error;
        }
    }
}

/**
 * 启动已停止的容器
 * @param {Object} docker - Docker 客户端
 * @param {string} containerId - 容器 ID
 * @returns {Promise<void>}
 */
export async function startContainer(docker, containerId) {
    const container = docker.getContainer(containerId);
    await container.start();

    const healthMonitor = new ContainerHealthMonitor(docker);
    await healthMonitor.waitForContainerReady(containerId);
}

/**
 * 销毁容器（停止 + 删除）
 * @param {Object} docker - Docker 客户端
 * @param {string} containerId - 容器 ID
 * @param {string} dataDir - 数据目录
 * @param {number} userId - 用户 ID
 * @param {boolean} removeVolume - 是否删除卷
 * @returns {Promise<void>}
 */
export async function destroyContainer(docker, containerId, dataDir, userId, removeVolume = false) {
    const container = docker.getContainer(containerId);

    // 停止容器
    try {
        await container.stop({ t: 5 });
    } catch {
        // 已停止则忽略
    }

    // 删除容器
    await container.remove();

    // 可选删除卷
    if (removeVolume) {
        const userDataDir = path.join(dataDir, 'users', `user_${userId}`, 'data');
        await fs.promises.rm(userDataDir, { recursive: true, force: true });
    }
}

/**
 * 在容器内执行命令
 * @param {Object} docker - Docker 客户端
 * @param {string} containerId - 容器 ID
 * @param {string} command - 命令
 * @param {Object} [options={}] - 执行选项
 * @returns {Promise<{exec: Object, stream: Object}>}
 */
export async function execInContainer(docker, containerId, command, options = {}) {
    const configBuilder = new ContainerConfigBuilder();
    const execConfig = configBuilder.buildExecConfig(command, options);

    const exec = await docker.getContainer(containerId).exec(execConfig);
    const stream = await exec.start({ Detach: false, Tty: execConfig.Tty });

    return { exec, stream };
}

/**
 * 附加到容器的交互式 shell
 * @param {Object} docker - Docker 客户端
 * @param {string} containerId - 容器 ID
 * @returns {Promise<{stream: Object, container: Object, containerId: string}>}
 */
export async function attachToShell(docker, containerId) {
    const container = docker.getContainer(containerId);

    return new Promise((resolve, reject) => {
        container.attach({
            stream: true,
            stdin: true,
            stdout: true,
            stderr: true,
            hijack: true,
            logs: false
        }, (err, stream) => {
            if (err) {
                reject(new Error(`Failed to attach to container: ${err.message}`));
                return;
            }
            resolve({ stream, container, containerId });
        });
    });
}
