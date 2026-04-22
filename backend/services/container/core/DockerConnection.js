/**
 * Docker 连接管理器
 *
 * 负责管理 Docker 客户端的初始化和连接配置。
 * 支持多种连接方式：socket 路径、HTTP、TLS。
 *
 * @module container/core/DockerConnection
 */

import Docker from 'dockerode';
import path from 'path';
import fs from 'fs';
import { CONTAINER } from '../../../config/config.js';

// ContainerManager 使用此函数在初始化期间创建 Docker 客户端
/**
 * Docker 连接管理器类
 */
export class DockerConnectionManager {
  /**
   * 创建 Docker 连接管理器实例
   * @param {object} options - 连接选项
   * @param {string} options.socketPath - Docker socket 路径
   * @param {string} options.host - Docker 主机地址
   * @param {Buffer} options.ca - TLS CA 证书
   * @param {Buffer} options.cert - TLS 客户端证书
   * @param {Buffer} options.key - TLS 客户端密钥
   */
  constructor(options = {}) {
    this.docker = this._initializeDocker(options);
  }

  // 构造函数调用此函数以使用 socket/HTTP/TLS 设置 Dockerode 客户端
  /**
   * 初始化 Docker 客户端
   * @param {object} options - 连接选项
   * @returns {Docker} Docker 客户端实例
   * @private
   */
  _initializeDocker(options) {
    let dockerOptions = {};

    // 如果选项明确提供 socketPath 或 host，则使用它们
    if (options.socketPath) {
      dockerOptions = { socketPath: options.socketPath };
    } else if (options.host) {
      dockerOptions = { host: options.host };
      // 如果提供了 TLS 选项则添加
      if (options.ca) dockerOptions.ca = options.ca;
      if (options.cert) dockerOptions.cert = options.cert;
      if (options.key) dockerOptions.key = options.key;
    } else if (CONTAINER.docker.host) {
      // 使用配置的 Docker 主机
      dockerOptions = { host: CONTAINER.docker.host };
      if (CONTAINER.docker.certPath) {
        dockerOptions.ca = fs.readFileSync(path.join(CONTAINER.docker.certPath, 'ca.pem'));
        dockerOptions.cert = fs.readFileSync(path.join(CONTAINER.docker.certPath, 'cert.pem'));
        dockerOptions.key = fs.readFileSync(path.join(CONTAINER.docker.certPath, 'key.pem'));
      }
    } else if (CONTAINER.docker.socketPath) {
      // 使用配置的 socket 路径
      dockerOptions = { socketPath: CONTAINER.docker.socketPath };
    }
    // 在 macOS (darwin) 上，传递空对象让 dockerode 完全自动检测 Docker Desktop

    return new Docker(dockerOptions);
  }

  // ContainerManager 调用此函数以获取 Docker 客户端用于容器操作
  /**
   * 获取 Docker 客户端实例
   * @returns {Docker} Docker 客户端实例
   */
  getDocker() {
    return this.docker;
  }

  // ContainerManager 调用此函数以按 ID 获取特定的容器对象
  /**
   * 获取容器实例
   * @param {string} containerId - 容器 ID
   * @returns {object} Docker 容器实例
   */
  getContainer(containerId) {
    return this.docker.getContainer(containerId);
  }

  // ContainerManager 在健康检查或容器发现期间调用此函数
  /**
   * 列出所有容器
   * @param {object} options - 列出选项
   * @returns {Promise<Array>} 容器列表
   */
  async listContainers(options = {}) {
    return await this.docker.listContainers(options);
  }
}
