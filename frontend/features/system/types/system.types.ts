/**
 * System Module Types
 *
 * Type definitions for system-level functionality.
 */

/**
 * Release information from GitHub
 */
export interface ReleaseInfo {
  title: string;
  body: string;
  htmlUrl: string;
  publishedAt?: string;
  tagName?: string;
}

/**
 * Version check result
 */
export interface VersionCheckResult {
  updateAvailable: boolean;
  latestVersion: string;
  currentVersion: string;
  releaseInfo: ReleaseInfo | null;
}

/**
 * Update progress
 */
export interface UpdateProgress {
  isUpdating: boolean;
  output: string;
  error: string | null;
}

/**
 * PWA detection result
 */
export interface PWAStatus {
  isPWA: boolean;
  isStandalone: boolean;
  displayMode: string;
}

/**
 * Project update detection
 */
export interface ProjectUpdateDetection {
  isAdditiveUpdate: boolean;
  hasActiveSession: boolean;
  externalMessageUpdate: number;
}
