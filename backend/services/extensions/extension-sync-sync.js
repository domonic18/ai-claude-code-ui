/**
 * Extension Sync - Resource Synchronization
 *
 * Internal sync functions for different resource types
 *
 * @module extensions/extension-sync-sync
 */

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../utils/logger.js';
import {
  EXTENSIONS_DIR,
  FILE_EXTENSIONS,
  directoryExists,
  fileExists,
  copyDirectory
} from './extension-utils.js';

const logger = createLogger('services/extensions/extension-sync-sync');

/**
 * Syncs skill entries (directory-based)
 * @param {Object} entry - Directory entry
 * @param {string} sourceDir - Source directory
 * @param {string} targetSubDir - Target subdirectory
 * @param {Object} results - Results object
 * @param {boolean} overwrite - Whether to overwrite
 */
export async function syncSkillEntry(entry, sourceDir, targetSubDir, results, overwrite) {
  if (!entry.isDirectory()) return;

  const targetPath = path.join(targetSubDir, entry.name);
  if (!overwrite && await directoryExists(targetPath)) {
    logger.info(`[ExtensionSync] Skipping existing skill: ${entry.name}`);
    return;
  }

  await copyDirectory(path.join(sourceDir, entry.name), targetPath);
  results.synced++;
}

/**
 * Syncs flexible entries (files or directories, for hooks/knowledge)
 * @param {Object} entry - Directory entry
 * @param {string} sourceDir - Source directory
 * @param {string} targetSubDir - Target subdirectory
 * @param {Array<string>} allowedExts - Allowed file extensions
 * @param {string} type - Resource type
 * @param {Object} results - Results object
 * @param {boolean} overwrite - Whether to overwrite
 */
export async function syncFlexibleEntry(entry, sourceDir, targetSubDir, allowedExts, type, results, overwrite) {
  if (entry.isFile()) {
    const ext = path.extname(entry.name);
    if (!allowedExts.includes(ext)) return;

    const targetPath = path.join(targetSubDir, entry.name);
    if (!overwrite && await fileExists(targetPath)) {
      logger.info(`[ExtensionSync] Skipping existing ${type.slice(0, -1)}: ${entry.name}`);
      return;
    }

    await fs.copyFile(path.join(sourceDir, entry.name), targetPath);
    results.synced++;
  } else if (entry.isDirectory()) {
    const targetPath = path.join(targetSubDir, entry.name);
    if (!overwrite && await directoryExists(targetPath)) {
      logger.info(`[ExtensionSync] Skipping existing directory: ${entry.name}`);
      return;
    }

    await copyDirectory(path.join(sourceDir, entry.name), targetPath);
    results.synced++;
  }
}

/**
 * Syncs file entries (agents, commands)
 * @param {Object} entry - Directory entry
 * @param {string} sourceDir - Source directory
 * @param {string} targetSubDir - Target subdirectory
 * @param {string} type - Resource type
 * @param {Object} results - Results object
 * @param {boolean} overwrite - Whether to overwrite
 */
export async function syncFileEntry(entry, sourceDir, targetSubDir, type, results, overwrite) {
  if (!entry.isFile()) return;

  const targetPath = path.join(targetSubDir, entry.name);
  if (!overwrite && await fileExists(targetPath)) {
    logger.info(`[ExtensionSync] Skipping existing ${type.slice(0, -1)}: ${entry.name}`);
    return;
  }

  await fs.copyFile(path.join(sourceDir, entry.name), targetPath);
  results.synced++;
}

/**
 * Syncs configuration files (CLAUDE.md, settings.json)
 * @param {string} targetDir - Target directory
 * @param {Object} results - Results object
 * @param {boolean} overwrite - Whether to overwrite
 */
export async function syncConfigFiles(targetDir, results, overwrite) {
  const configFiles = ['CLAUDE.md', 'settings.json'];

  for (const filename of configFiles) {
    const sourcePath = path.join(EXTENSIONS_DIR, filename);
    const targetPath = path.join(targetDir, filename);

    try {
      if (!(await fileExists(sourcePath))) {
        logger.info(`[ExtensionSync] Config file not found: ${filename}, skipping`);
        continue;
      }
      if (!overwrite && await fileExists(targetPath)) {
        logger.info(`[ExtensionSync] Skipping existing config file: ${filename}`);
        continue;
      }

      await fs.copyFile(sourcePath, targetPath);
      results.synced++;
    } catch (error) {
      results.errors.push({ resource: filename, error: error.message });
      logger.error(`[ExtensionSync] Failed to sync ${filename}:`, error.message);
    }
  }
}

/**
 * Syncs a specific resource type
 * @param {string} type - Resource type
 * @param {string} targetDir - Target directory
 * @param {Object} results - Results object
 * @param {boolean} overwrite - Whether to overwrite
 */
export async function syncResourceType(type, targetDir, results, overwrite) {
  const sourceDir = path.join(EXTENSIONS_DIR, type);
  const targetSubDir = path.join(targetDir, type);

  if (!(await directoryExists(sourceDir))) {
    logger.info(`[ExtensionSync] Source directory not found: ${sourceDir}, skipping ${type}`);
    return;
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const allowedExts = FILE_EXTENSIONS[type] || [];

  for (const entry of entries) {
    if (entry.name === 'README.md' || entry.name.startsWith('.')) continue;

    try {
      if (type === 'skills') {
        await syncSkillEntry(entry, sourceDir, targetSubDir, results, overwrite);
      } else if (type === 'hooks' || type === 'knowledge') {
        await syncFlexibleEntry(entry, sourceDir, targetSubDir, allowedExts, type, results, overwrite);
      } else {
        await syncFileEntry(entry, sourceDir, targetSubDir, type, results, overwrite);
      }
    } catch (error) {
      results.errors.push({ resource: entry.name, error: error.message });
      logger.error(`[ExtensionSync] Failed to sync ${entry.name}:`, error.message);
    }
  }
}
