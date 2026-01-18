/**
 * System Service
 *
 * Service for system-level operations like version checking and updates.
 */

import type { ReleaseInfo, UpdateProgress } from '../types';

/**
 * System service class
 */
export class SystemService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/system') {
    this.baseUrl = baseUrl;
  }

  /**
   * Check for application updates
   */
  async checkUpdate(): Promise<{ updateAvailable: boolean; latestVersion: string; currentVersion: string; releaseInfo: ReleaseInfo | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/check-update`);
      if (!response.ok) {
        throw new Error('Failed to check for updates');
      }
      return await response.json();
    } catch (error) {
      console.error('Error checking for updates:', error);
      return {
        updateAvailable: false,
        latestVersion: '',
        currentVersion: '',
        releaseInfo: null,
      };
    }
  }

  /**
   * Perform application update
   */
  async performUpdate(onProgress?: (output: string) => void): Promise<{ success: boolean; output: string; error: string | null }> {
    try {
      const response = await fetch(`${this.baseUrl}/update`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Update failed' }));
        return {
          success: false,
          output: '',
          error: data.error || 'Update failed',
        };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const data = await response.json();
        return {
          success: true,
          output: data.output || '',
          error: null,
        };
      }

      // Stream output
      const decoder = new TextDecoder();
      let output = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        output += chunk;
        onProgress?.(chunk);
      }

      return {
        success: true,
        output,
        error: null,
      };
    } catch (error) {
      console.error('Error performing update:', error);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean changelog text
   */
  cleanChangelog(body: string | undefined): string {
    if (!body) return '';

    return body
      .replace(/\b[0-9a-f]{40}\b/gi, '')
      .replace(/(?:^|\s|-)([0-9a-f]{7,10})\b/gi, '')
      .replace(/\*\*Full Changelog\*\*:.*$/gim, '')
      .replace(/https?:\/\/github\.com\/[^\/]+\/[^\/]+\/compare\/[^\s)]+/gi, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .trim();
  }
}

/**
 * Singleton instance
 */
let systemServiceInstance: SystemService | null = null;

/**
 * Get system service singleton instance
 */
export function getSystemService(): SystemService {
  if (!systemServiceInstance) {
    systemServiceInstance = new SystemService();
  }
  return systemServiceInstance;
}
