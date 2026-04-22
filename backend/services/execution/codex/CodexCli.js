/**
 * Codex CLI 执行器
 *
 * 封装 codex CLI 子进程调用的通用模式，
 * 消除路由层重复的 spawn/collect/respond 逻辑。
 *
 * @module execution/codex/CodexCli
 */

import { spawn } from 'child_process';
import { createLogger } from '../../../utils/logger.js';

const logger = createLogger('services/execution/codex/CodexCli');

// 由 Codex 相关 API 调用，执行 codex CLI 命令并收集输出
/**
 * 执行 Codex CLI 命令并收集输出
 * @param {string[]} args - CLI 参数
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} 执行结果
 */
export async function executeCodexCli(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('codex', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

// 由 API 路由层调用，执行 Codex CLI 命令并格式化为 HTTP 响应
/**
 * 执行 Codex CLI 命令并格式化 HTTP 响应
 * @param {string[]} args - CLI 参数
 * @param {Object} [options={}] - 选项
 * @param {string} [options.successMessage] - 成功消息
 * @param {Function} [options.parseSuccess] - 成功时解析 stdout 的函数
 * @param {number} [options.errorCode=400] - CLI 失败时的 HTTP 状态码
 * @returns {Promise<Object>} 格式化的响应对象
 */
export async function runCodexCliCommand(args, options = {}) {
  const {
    successMessage,
    parseSuccess,
    errorCode = 400,
  } = options;

  try {
    const { stdout, stderr, code } = await executeCodexCli(args);

    if (code === 0) {
      const result = { success: true, output: stdout };
      if (successMessage) result.message = successMessage;
      if (parseSuccess) Object.assign(result, parseSuccess(stdout));
      return { status: 200, body: result };
    }

    return {
      status: errorCode,
      body: { error: 'Codex CLI command failed', details: stderr || `Exited with code ${code}` },
    };
  } catch (error) {
    const isMissing = error?.code === 'ENOENT';
    return {
      status: isMissing ? 503 : 500,
      body: {
        error: isMissing ? 'Codex CLI not installed' : 'Failed to run Codex CLI',
        details: error.message,
        code: error.code,
      },
    };
  }
}

// 由 MCP 服务器列表 API 调用，解析 codex mcp list 输出
/**
 * 解析 codex mcp list 的输出
 * @param {string} output - CLI stdout
 * @returns {Array<Object>} 服务器列表
 */
export function parseCodexListOutput(output) {
  const servers = [];
  const lines = output.split('\n').filter(line => line.trim());

  for (const line of lines) {
    if (!line.includes(':')) continue;

    const colonIndex = line.indexOf(':');
    const name = line.substring(0, colonIndex).trim();
    if (!name) continue;

    const rest = line.substring(colonIndex + 1).trim();
    let description = rest;
    let status = 'unknown';

    if (rest.includes('\u2713') || rest.includes('\u2717')) {
      const statusMatch = rest.match(/(.*?)\s*-\s*([\u2713\u2717].*)$/);
      if (statusMatch) {
        description = statusMatch[1].trim();
        status = statusMatch[2].includes('\u2713') ? 'connected' : 'failed';
      }
    }

    servers.push({ name, type: 'stdio', status, description });
  }

  return servers;
}

// 由 MCP 服务器详情 API 调用，解析 codex mcp get 输出
/**
 * 解析 codex mcp get 的输出
 * @param {string} output - CLI stdout
 * @returns {Object} 服务器详情
 */
export function parseCodexGetOutput(output) {
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    const server = { raw_output: output };
    for (const line of output.split('\n')) {
      if (line.includes('Name:')) server.name = line.split(':')[1]?.trim();
      else if (line.includes('Type:')) server.type = line.split(':')[1]?.trim();
      else if (line.includes('Command:')) server.command = line.split(':')[1]?.trim();
    }
    return server;
  } catch (error) {
    return { raw_output: output, parse_error: error.message };
  }
}
