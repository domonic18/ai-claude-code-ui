/**
 * Extension Archive Builder
 *
 * Creates tar archives of extension files for synchronization to containers.
 * Supports both local development and Docker-in-Docker environments.
 *
 * @module services/extensions/extension-tar
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Readable } from 'stream';
import { finished } from 'stream';
import { createLogger } from '../../utils/logger.js';
const logger = createLogger('services/extensions/extension-tar');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path configuration
// This file is at: backend/services/extensions/extension-tar.js
// Project root is 4 levels up: extensions -> services -> backend -> project_root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const EXTENSIONS_DIR = path.join(PROJECT_ROOT, 'extensions', '.claude');

/**
 * Copy requested extension directories
 * @param {Object} options - Include options
 * @param {string} targetDir - Target directory
 */
async function _copyRequestedDirectories(options, targetDir) {
  const DIR_MAPPING = {
    includeSkills: 'skills',
    includeAgents: 'agents',
    includeCommands: 'commands',
    includeHooks: 'hooks',
    includeKnowledge: 'knowledge'
  };

  const copyPromises = Object.entries(DIR_MAPPING)
    .filter(([optionKey]) => options[optionKey])
    .map(([, dirName]) => copyDirectoryIfExists(dirName, targetDir));

  await Promise.all(copyPromises);
}

/**
 * Setup stream cleanup handlers
 * @param {Readable} stream - Tar stream
 * @param {Function} cleanup - Cleanup function
 */
function _setupStreamCleanup(stream, cleanup) {
  finished(stream, () => cleanup());

  const timeoutId = setTimeout(cleanup, 5 * 60 * 1000);
  stream.on('end', () => clearTimeout(timeoutId));
  stream.on('error', () => clearTimeout(timeoutId));
  stream.cleanup = cleanup;
}

/**
 * Create a tar archive stream of extension files
 *
 * @param {Object} options - Options
 * @param {boolean} options.includeSkills - Include skills directory (default: true)
 * @param {boolean} options.includeAgents - Include agents directory (default: true)
 * @param {boolean} options.includeCommands - Include commands directory (default: true)
 * @param {boolean} options.includeHooks - Include hooks directory (default: true)
 * @param {boolean} options.includeKnowledge - Include knowledge directory (default: true)
 * @param {boolean} options.includeConfig - Include config files like CLAUDE.md and settings.json (default: true)
 * @returns {Promise<Readable>} Tar archive as a readable stream
 */
export async function createExtensionTar(options = {}) {
  const {
    includeSkills = true,
    includeAgents = true,
    includeCommands = true,
    includeHooks = true,
    includeKnowledge = true,
    includeConfig = true
  } = options;

  const tempDir = path.join(PROJECT_ROOT, 'workspace', 'temp', `extensions-${Date.now()}`);
  const cleanup = () => {
    fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  };

  try {
    await fs.promises.mkdir(tempDir, { recursive: true });

    const claudeDir = path.join(tempDir, '.claude');
    await fs.promises.mkdir(claudeDir, { recursive: true });

    await _copyRequestedDirectories({
      includeSkills,
      includeAgents,
      includeCommands,
      includeHooks,
      includeKnowledge
    }, claudeDir);

    if (includeConfig) {
      await copyConfigFiles(claudeDir);
    }

    const tarPath = path.join(tempDir, 'extensions.tar');
    await createTarArchive(tempDir, tarPath);

    const stream = fs.createReadStream(tarPath);
    _setupStreamCleanup(stream, cleanup);

    return stream;

  } catch (error) {
    cleanup();
    throw error;
  }
}

/**
 * Copy directory if it exists
 * @private
 * @param {string} dirName - Directory name to copy
 * @param {string} targetDir - Target directory
 */
async function copyDirectoryIfExists(dirName, targetDir) {
  const sourceDir = path.join(EXTENSIONS_DIR, dirName);

  try {
    await fs.promises.access(sourceDir);
    await copyDirectory(sourceDir, path.join(targetDir, dirName));
  } catch (error) {
    // Directory doesn't exist, skip
    logger.info(`[ExtensionTar] Directory ${dirName} not found, skipping`);
  }
}

/**
 * Copy configuration files
 * @private
 * @param {string} targetDir - Target directory
 */
async function copyConfigFiles(targetDir) {
  const configFiles = ['CLAUDE.md', 'settings.json'];

  for (const filename of configFiles) {
    const sourcePath = path.join(EXTENSIONS_DIR, filename);
    const targetPath = path.join(targetDir, filename);

    try {
      await fs.promises.copyFile(sourcePath, targetPath);
    } catch (error) {
      // File doesn't exist, skip
      logger.info(`[ExtensionTar] Config file ${filename} not found, skipping`);
    }
  }
}

/**
 * Copy a directory recursively
 * @private
 * @param {string} source - Source directory path
 * @param {string} target - Target directory path
 */
async function copyDirectory(source, target) {
  await fs.promises.mkdir(target, { recursive: true });
  const entries = await fs.promises.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.promises.copyFile(sourcePath, targetPath);

      // Set execute permission for hook scripts
      if (source.endsWith('hooks') && (entry.name.endsWith('.sh') || entry.name.endsWith('.js'))) {
        await fs.promises.chmod(targetPath, 0o755);
      }
    }
  }
}

/**
 * Create a tar archive using system tar command
 * @private
 * @param {string} sourceDir - Source directory to archive
 * @param {string} outputPath - Output tar file path
 */
async function createTarArchive(sourceDir, outputPath) {
  try {
    // Use system tar command for better compatibility
    // Change to sourceDir and tar all contents (including hidden files)
    // This creates: .claude/skills/..., .claude/agents/..., etc.
    const { spawn } = await import('child_process');

    await new Promise((resolve, reject) => {
      // 使用 --no-xattrs 排除 macOS 扩展属性，避免容器内解压失败
      // macOS 的 com.apple.provenance 等属性在容器内不受支持
      const tar = spawn('tar', ['--no-xattrs', '-cf', outputPath, '.'], {
        cwd: sourceDir,
        stdio: 'ignore'
      });

      tar.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar exited with code ${code}`));
        }
      });

      tar.on('error', reject);
    });
  } catch (error) {
    throw new Error(`Failed to create tar archive: ${error.message}`);
  }
}

/**
 * Count non-hidden entries in a directory
 * @param {string} dirPath - Directory path
 * @returns {Promise<number>} Count of non-hidden entries
 */
async function countNonHiddenEntries(dirPath) {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => !e.name.startsWith('.')).length;
  } catch (_error) {
    return 0;
  }
}

/**
 * Get extension statistics
 * @returns {Promise<Object>} Extension statistics
 */
export async function getExtensionStats() {
  const stats = {
    skills: 0,
    agents: 0,
    commands: 0,
    hooks: 0,
    knowledge: 0,
    totalSize: 0
  };

  try {
    const types = ['skills', 'agents', 'commands', 'hooks', 'knowledge'];

    for (const type of types) {
      stats[type] = await countNonHiddenEntries(path.join(EXTENSIONS_DIR, type));
    }

    return stats;
  } catch (error) {
    logger.error('[ExtensionTar] Failed to get extension stats:', error);
    return stats;
  }
}

export default {
  createExtensionTar,
  getExtensionStats
};
