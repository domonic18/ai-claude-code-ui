/**
 * Extension Sync Entry Handlers
 *
 * Internal sync functions for different resource types
 *
 * @module extensions/extensionSyncEntries
 */

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../utils/logger.js';
import {
  directoryExists,
  fileExists,
  copyDirectory
} from './extension-utils.js';

const logger = createLogger('services/extensions/extensionSyncEntries');

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
