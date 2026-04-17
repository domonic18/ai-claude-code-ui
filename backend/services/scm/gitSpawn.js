/**
 * Git spawn 安全执行模块
 *
 * 提供基于 spawn 的 git 命令执行，避免 exec + 字符串拼接导致的命令注入。
 * 所有用户可控参数（文件名、分支名、commit message）通过参数数组传递，
 * 由操作系统直接传给 git 进程，不经过 shell 解析。
 *
 * @module services/scm/gitSpawn
 */

import { spawn } from 'child_process';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('services/scm/gitSpawn');

/**
 * 使用 spawn 安全执行 git 命令
 *
 * @param {string[]} args - git 命令参数数组（不含 'git' 本身）
 * @param {string} cwd - 工作目录
 * @param {Object} [options] - 额外选项
 * @param {Object} [options.env] - 额外环境变量
 * @param {number} [options.timeout=30000] - 超时时间（毫秒）
 * @returns {Promise<{stdout: string, stderr: string}>}
 * @throws {Error} 当进程退出码非 0 时抛出错误
 *
 * @example
 * // 安全：文件名作为独立参数，不会被 shell 解析
 * await gitSpawn(['add', 'test; rm -rf /'], '/project');
 * await gitSpawn(['commit', '-m', 'user message'], '/project');
 */
export function gitSpawn(args, cwd, options = {}) {
    const { env, timeout = 30000 } = options;

    return new Promise((resolve, reject) => {
        const proc = spawn('git', args, {
            cwd,
            env: { ...process.env, ...env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        const timer = setTimeout(() => {
            proc.kill('SIGTERM');
            reject(new Error(`git ${args[0]} timed out after ${timeout}ms`));
        }, timeout);

        proc.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                const cmd = `git ${args.join(' ')}`;
                const err = new Error(`${cmd} failed (exit ${code}): ${stderr.trim() || stdout.trim()}`);
                err.code = code;
                err.stderr = stderr;
                err.stdout = stdout;
                reject(err);
            }
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}
