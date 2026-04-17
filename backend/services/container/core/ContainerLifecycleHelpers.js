/**
 * ContainerLifecycleHelpers.js
 *
 * 容器生命周期辅助函数 — 从 ContainerLifecycle.js 提取
 * 负责数据库操作、容器恢复和清理逻辑
 *
 * @module container/core/ContainerLifecycleHelpers
 */

import { ContainerStateStore } from './ContainerStateStore.js';
import containerStateStore from './ContainerStateStore.js';
import { createLogger } from '../../../utils/logger.js';
const logger = createLogger('container/core/ContainerLifecycleHelpers');

/**
 * 保存容器信息到数据库
 * @param {Object} Container - Container 数据库仓库
 * @param {number} userId - 用户 ID
 * @param {Object} containerInfo - 容器信息
 */
export function saveContainerToDb(Container, userId, containerInfo) {
  try {
    Container.create(userId, containerInfo.id, containerInfo.name);
  } catch (e) {
    logger.warn(`Failed to save container: ${e.message}`);
  }
}

/**
 * 更新容器最后活跃时间
 * @param {Object} Container - Container 数据库仓库
 * @param {Object} containerInfo - 容器信息
 */
export function updateLastActive(Container, containerInfo) {
  try {
    Container.updateLastActive(containerInfo.id);
  } catch {}
}

/**
 * 处理停止的容器
 */
export function handleStoppedContainer(Container, containerId, userId, stateMachines) {
  Container.updateStatus(containerId, 'stopped');
  const sm = stateMachines.get(userId);
  if (sm) {
    sm.forceReset();
    containerStateStore.save(sm);
  }
}

/**
 * 处理 Docker 中不存在的容器
 */
export async function handleMissingContainer(dockerErr, Container, userId, containerId, containerName, stateMachines) {
  if (dockerErr.statusCode === 404) {
    logger.info(`Container ${containerName} not found in Docker, removing from database`);
    Container.delete(containerId);
    let sm = stateMachines.get(userId);
    if (!sm) {
      try { sm = await containerStateStore.load(userId); } catch {}
    }
    if (sm) {
      sm.forceReset();
      await containerStateStore.save(sm);
    }
  } else {
    logger.warn(`Error checking container ${containerName}: ${dockerErr.message}`);
  }
}

/**
 * 从数据库记录恢复容器
 */
export async function restoreContainerFromDb(docker, Container, dbContainer, containers, stateMachines) {
  const { user_id, container_id, container_name, created_at, last_active } = dbContainer;
  try {
    const dockerContainer = docker.getContainer(container_id);
    const info = await dockerContainer.inspect();

    if (info.State.Running) {
      containers.set(user_id, {
        id: container_id, name: container_name, userId: user_id,
        status: 'running', createdAt: new Date(created_at), lastActive: new Date(last_active)
      });
      logger.info(`Restored container for user ${user_id}: ${container_name}`);
    } else {
      handleStoppedContainer(Container, container_id, user_id, stateMachines);
    }
  } catch (dockerErr) {
    await handleMissingContainer(dockerErr, Container, user_id, container_id, container_name, stateMachines);
  }
}

/**
 * 从数据库加载所有活跃容器
 */
export async function loadContainersFromDb(Container, docker, containers, stateMachines) {
  try {
    logger.info('Loading containers from database...');
    const activeContainers = Container.listActive();
    for (const db of activeContainers) {
      await restoreContainerFromDb(docker, Container, db, containers, stateMachines);
    }
    logger.info(`Loaded ${containers.size} containers from database`);
  } catch (error) {
    if (error.code === 'SQLITE_ERROR' && error.message.includes('no such table')) {
      logger.info('Database not yet initialized, skipping container load');
    } else {
      logger.warn('Failed to load containers from database:', error.message);
    }
  }
}
