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
import { createLogger } from '../../../utils/logger.js';

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
 * 确保容器内有默认工作区目录结构
 * @param {Object} container - Docker 容器实例
 * @returns {Promise<void>}
 */
export async function ensureDefaultWorkspace(container) {
    const result = await execWithTimeout(
        container,
        'mkdir -p /workspace/my-workspace/uploads /workspace/my-workspace/.claude/projects && chmod 755 /workspace && ls -la /workspace/',
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

    // 同步到 /workspace/my-workspace（确保 hooks 路径正确）
    const tarStream2 = await createExtensionTar({
        includeSkills: true,
        includeAgents: true,
        includeCommands: true,
        includeHooks: true,
        includeKnowledge: true,
        includeConfig: true
    });

    await new Promise((resolve, reject) => {
        container.putArchive(tarStream2, { path: '/workspace/my-workspace' }, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    // 设置 hooks 脚本执行权限
    await setHooksPermissions(container);

    // 创建记忆目录和文件
    await createMemoryDirectoryAndFile(container);
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
        logger.warn('Failed to create memory directory/file:', error.message);
    }
}

// 由 LifecycleManager 调用以提供用户友好的工作区文档
/**
 * 在容器内创建 README.md 文件
 * @param {Object} container - Docker 容器实例
 * @returns {Promise<void>}
 */
export async function createReadmeInContainer(container) {
    const readmeContent = `# My Workspace

Welcome to your Claude Code workspace! This is your default project where you can start coding.

## Getting Started

- Use the chat interface to ask Claude to help you with coding tasks
- Use the file explorer to browse and edit files
- Use the terminal to run commands

Happy coding!
`;

    const command = `cat > /workspace/my-workspace/README.md << 'EOF'
${readmeContent}
EOF`;

    await execWithTimeout(container, command, 5000);
}
