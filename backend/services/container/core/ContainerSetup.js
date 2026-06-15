/**
 * 容器初始化设置服务
 *
 * 负责容器创建后的初始化工作：
 * - 默认工作区目录创建
 * - 扩展文件同步
 * - Hooks 权限设置
 * - 记忆目录和文件创建
 * - README 文件创建
 *
 * 所有方法接收 Docker container 实例，不依赖 LifecycleManager 状态。
 *
 * @module container/core/ContainerSetup
 */

import { syncExtensions } from '../../extensions/extension-sync.js';
import { createExtensionTar } from '../../extensions/extension-tar.js';
import { DEFAULT_MEMORY_TEMPLATE, MEMORY_SETUP_TIMEOUT } from '../../../shared/constants/memory.js';
import { createLogger, startTimer } from '../../../utils/logger.js';

const logger = createLogger('container/core/ContainerSetup');

// 所有 ContainerSetup 操作使用的实用函数，用于安全运行命令
/**
 * 在容器内执行命令并设置超时
 * @param {Object} container - Docker 容器实例
 * @param {string} command - 要执行的命令
 * @param {number} [timeout=15000] - 超时时间（毫秒）
 * @returns {Promise<{success: boolean, output?: string, error?: string}>}
 */
export async function execWithTimeout(container, command, timeout = 15000) {
    const exec = await container.exec({
        Cmd: ['/bin/sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true
    });

    const stream = await exec.start({ Detach: false });

    return Promise.race([
        new Promise((resolve) => {
            let output = '';
            stream.on('data', (chunk) => { output += chunk.toString(); });
            stream.on('end', () => resolve({ success: true, output }));
            stream.on('error', (err) => resolve({ success: false, error: err.message }));
        }),
        new Promise((resolve) =>
            setTimeout(() => resolve({ success: false, error: 'timeout' }), timeout)
        )
    ]);
}

// 在容器创建后由 LifecycleManager 调用以设置工作区结构
/**
 * 确保容器内存在全局（与具体项目无关）的工作区目录结构
 *
 * 只创建所有项目共享的目录，不再为默认项目 my-workspace 无条件建目录。
 * 否则用户删除 my-workspace 后，容器每 2 小时空闲被清理、重建时会把它
 * "复活"（Bug1）。
 *
 * 保留的全局目录：
 * - /workspace                 工作区根
 * - /workspace/.claude/projects 全局会话历史存储（所有项目的会话都写在这里，
 *                               与具体项目目录分离）
 *
 * @param {Object} container - Docker 容器实例
 * @returns {Promise<void>}
 */
export async function ensureDefaultWorkspace(container) {
    const result = await execWithTimeout(
        container,
        'mkdir -p /workspace/.claude/projects && chmod 755 /workspace && ls -la /workspace/',
        15000
    );

    if (!result.success) {
        throw new Error(result.error || 'Unknown error creating workspace');
    }
}

// 由 LifecycleManager 调用以将 skills/agents/commands/hooks 复制到容器工作区
/**
 * 同步扩展文件到容器内
 * 通过 docker.putArchive 将扩展文件上传到命名卷
 * @param {Object} container - Docker 容器实例
 * @returns {Promise<void>}
 */
export async function syncExtensionsToContainer(container) {
    const syncTimer = startTimer('container/sync_extensions');

    // 创建扩展文件的 tar 流 - 同步到 /workspace
    const tarStream = await createExtensionTar({
        includeSkills: true,
        includeAgents: true,
        includeCommands: true,
        includeHooks: true,
        includeKnowledge: true,
        includeConfig: true
    });

    await new Promise((resolve, reject) => {
        container.putArchive(tarStream, { path: '/workspace' }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // 不再向 /workspace/my-workspace 再同步一份扩展。
    // 原因：SDK 运行时 HOME=/workspace、CLAUDE_CONFIG_DIR=/workspace/.claude，
    // 插件/技能/hooks 从 /workspace/.claude 加载（见 DockerExecutor.js、
    // ScriptBuilder.js: plugins path=/workspace/.claude），上一处 putArchive
    // 到 /workspace 已覆盖 /workspace/.claude。此处继续 putArchive 到
    // /workspace/my-workspace 是冗余的，且会在容器重建时无条件创建该目录，
    // 把用户删掉的默认项目 my-workspace "复活"（Bug1）。

    // 设置 hooks 脚本执行权限
    await setHooksPermissions(container);

    // 创建记忆目录和文件
    await createMemoryDirectoryAndFile(container);

    syncTimer.end(logger, 'Extensions synced to container');
}

// 由 syncExtensionsToContainer 调用以使 hook 脚本可执行
/**
 * 设置容器内 hooks 脚本的执行权限（两处都要设置）
 * @param {Object} container - Docker 容器实例
 * @returns {Promise<void>}
 */
export async function setHooksPermissions(container) {
    const commands = [
        'chmod +x /workspace/.claude/hooks/*.sh 2>/dev/null || true',
        'chmod +x /workspace/my-workspace/.claude/hooks/*.sh 2>/dev/null || true'
    ];

    for (const cmd of commands) {
        await execWithTimeout(container, cmd, 5000);
    }
}

// 由 LifecycleManager 调用以初始化新容器的记忆功能
/**
 * 创建用户级记忆目录和默认记忆文件
 * @param {Object} container - Docker 容器实例
 * @returns {Promise<void>}
 */
export async function createMemoryDirectoryAndFile(container) {
    try {
        // 创建 /workspace/.claude/memory 目录
        const mkdirResult = await execWithTimeout(container, 'mkdir -p /workspace/.claude/memory', MEMORY_SETUP_TIMEOUT);
        if (mkdirResult.success) {
            logger.debug('Created memory directory: /workspace/.claude/memory');
        }

        // 检查记忆文件是否存在
        const checkResult = await execWithTimeout(
            container,
            'test -f /workspace/.claude/memory/MEMORY.md && echo "EXISTS" || echo "NOT_EXISTS"',
            MEMORY_SETUP_TIMEOUT
        );

        if (checkResult.success && checkResult.output && checkResult.output.includes('NOT_EXISTS')) {
            // 使用 base64 编码创建文件，避免特殊字符问题
            const base64Content = Buffer.from(DEFAULT_MEMORY_TEMPLATE, 'utf8').toString('base64');
            const createResult = await execWithTimeout(
                container,
                `echo '${base64Content}' | base64 -d > /workspace/.claude/memory/MEMORY.md`,
                MEMORY_SETUP_TIMEOUT
            );
            if (createResult.success) {
                logger.debug('Created default memory file: /workspace/.claude/memory/MEMORY.md');
            }
        }
    } catch (error) {
        logger.warn({ err: error }, 'Failed to create memory directory/file');
    }
}
