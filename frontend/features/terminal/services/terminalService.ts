/**
 * Terminal Services
 *
 * API services for terminal operations.
 */

// 导入终端相关的类型定义
import type { ShellConfig, TerminalProcess, TerminalOutput, ProcessStatus } from '../types';
// 导出 WebSocket 相关的类和工厂函数
export { TerminalWebSocket, createTerminalWebSocket } from './terminalWebSocket.js';

/**
 * Terminal service for API calls
 * 提供与后端 API 交互的方法集
 */
export class TerminalService {
  // API 基础 URL
  private baseUrl: string;
  // 项目名称，用于构建 API 路径
  private projectName: string;

  constructor(projectName: string, baseUrl: string = '/api') {
    this.projectName = projectName;
    this.baseUrl = baseUrl;
  }

  /**
   * Start a new shell session
   * 启动一个新的 Shell 会话，返回会话 ID 和 WebSocket URL
   */
  async startShell(config: ShellConfig): Promise<{ sessionId: string; socketUrl: string }> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/shell/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Failed to start shell: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get active processes
   * 获取当前活动的进程列表
   */
  async getProcesses(): Promise<TerminalProcess[]> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/processes`);

    if (!response.ok) {
      throw new Error(`Failed to get processes: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.processes || []);
  }

  /**
   * Get process by ID
   * 根据 ID 获取单个进程的详细信息
   */
  async getProcess(processId: string): Promise<TerminalProcess> {
    const response = await fetch(
      `${this.baseUrl}/projects/${this.projectName}/processes/${processId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to get process: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Kill a process
   * 终止指定进程，支持 SIGTERM 和 SIGKILL 信号
   */
  async killProcess(processId: string, signal?: 'SIGTERM' | 'SIGKILL'): Promise<{ success: boolean }> {
    const response = await fetch(
      `${this.baseUrl}/projects/${this.projectName}/processes/${processId}/kill`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to kill process: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get process output
   * 获取进程的输出日志，支持限制行数
   */
  async getProcessOutput(processId: string, lines?: number): Promise<TerminalOutput[]> {
    const url = new URL(`${this.baseUrl}/projects/${this.projectName}/processes/${processId}/output`);
    if (lines) {
      url.searchParams.set('lines', String(lines));
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to get process output: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.outputs || []);
  }

  /**
   * Write input to process
   * 向进程的标准输入写入数据
   */
  async writeInput(processId: string, input: string): Promise<{ success: boolean }> {
    const response = await fetch(
      `${this.baseUrl}/projects/${this.projectName}/processes/${processId}/input`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to write input: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Resize terminal
   * 调整终端 PTY 的窗口大小
   */
  async resizeTerminal(processId: string, cols: number, rows: number): Promise<{ success: boolean }> {
    const response = await fetch(
      `${this.baseUrl}/projects/${this.projectName}/processes/${processId}/resize`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols, rows }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to resize terminal: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Execute command asynchronously
   * 异步执行命令，立即返回进程对象
   */
  async executeCommand(
    command: string,
    args: string[] = [],
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    }
  ): Promise<TerminalProcess> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args, ...options }),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute command: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get command history
   * 获取命令历史记录，支持限制数量
   */
  async getCommandHistory(limit?: number): Promise<string[]> {
    const url = new URL(`${this.baseUrl}/projects/${this.projectName}/history`);
    if (limit) {
      url.searchParams.set('limit', String(limit));
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.history || []);
  }

  /**
   * Search command history
   * 在命令历史中搜索包含查询字符串的命令
   */
  async searchHistory(query: string): Promise<string[]> {
    const response = await fetch(
      `${this.baseUrl}/projects/${this.projectName}/history/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to search history: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : (data.results || []);
  }
}

/**
 * Create a terminal service instance for a project
 * 为指定项目创建终端服务实例的工厂函数
 */
export function createTerminalService(projectName: string, baseUrl?: string): TerminalService {
  return new TerminalService(projectName, baseUrl);
}
