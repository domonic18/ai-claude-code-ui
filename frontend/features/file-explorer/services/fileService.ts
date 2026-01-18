/**
 * File Explorer Services
 *
 * API services for file operations.
 */

import type { FileNode } from '../types';

/**
 * File service for API calls
 */
export class FileService {
  private baseUrl: string;
  private projectName: string;

  constructor(projectName: string, baseUrl: string = '/api') {
    this.projectName = projectName;
    this.baseUrl = baseUrl;
  }

  /**
   * Get project files
   */
  async getFiles(): Promise<FileNode[]> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/files`);

    if (!response.ok) {
      throw new Error(`Failed to fetch files: ${response.statusText}`);
    }

    const responseData = await response.json();
    const data = responseData.data ?? responseData;
    return Array.isArray(data) ? data : [];
  }

  /**
   * Read file content
   */
  async readFile(filePath: string): Promise<{ content: string; encoding?: string }> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/files/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });

    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Write file content
   */
  async writeFile(filePath: string, content: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });

    if (!response.ok) {
      throw new Error(`Failed to write file: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete file or directory
   */
  async deleteFile(filePath: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/files/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/files/mkdir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: dirPath }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create directory: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Rename file or directory
   */
  async renameFile(oldPath: string, newPath: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/files/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newPath }),
    });

    if (!response.ok) {
      throw new Error(`Failed to rename file: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Move file or directory
   */
  async moveFile(sourcePath: string, targetPath: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/files/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, targetPath }),
    });

    if (!response.ok) {
      throw new Error(`Failed to move file: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Copy file or directory
   */
  async copyFile(sourcePath: string, targetPath: string): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/files/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, targetPath }),
    });

    if (!response.ok) {
      throw new Error(`Failed to copy file: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get file info
   */
  async getFileInfo(filePath: string): Promise<{
    name: string;
    path: string;
    size: number;
    modifiedTime: string;
    type: 'file' | 'directory';
  }> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/files/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get file info: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search files by pattern
   */
  async searchFiles(pattern: string, options?: {
    caseSensitive?: boolean;
    includeContent?: boolean;
    maxResults?: number;
  }): Promise<FileNode[]> {
    const response = await fetch(`${this.baseUrl}/projects/${this.projectName}/files/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern, ...options }),
    });

    if (!response.ok) {
      throw new Error(`Failed to search files: ${response.statusText}`);
    }

    const responseData = await response.json();
    const data = responseData.data ?? responseData;
    return Array.isArray(data) ? data : [];
  }
}

/**
 * Create a file service instance for a project
 */
export function createFileService(projectName: string, baseUrl?: string): FileService {
  return new FileService(projectName, baseUrl);
}
