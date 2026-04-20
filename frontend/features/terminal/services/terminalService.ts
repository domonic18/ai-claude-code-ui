/**
 * Terminal Services
 *
 * API services for terminal operations.
 */

import type { ShellConfig, TerminalProcess, TerminalOutput, ProcessStatus } from '../types';
export { TerminalWebSocket, createTerminalWebSocket } from './terminalWebSocket.js';

/**
 * Terminal service for API calls
 */
export class TerminalService {
  private baseUrl: string;
  private projectName: string;

  constructor(projectName: string, baseUrl: string = '/api') {
    this.projectName = projectName;
    this.baseUrl = baseUrl;
  }

  /**
   * Start a new shell session
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
 */
export function createTerminalService(projectName: string, baseUrl?: string): TerminalService {
  return new TerminalService(projectName, baseUrl);
}
