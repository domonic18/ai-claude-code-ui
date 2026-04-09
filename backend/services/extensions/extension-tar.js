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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path configuration
// This file is at: backend/services/extensions/extension-tar.js
// Project root is 4 levels up: extensions -> services -> backend -> project_root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const EXTENSIONS_DIR = path.join(PROJECT_ROOT, 'extensions', '.claude');

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

  // Create a temporary directory for the tar content
  const tempDir = path.join(PROJECT_ROOT, 'workspace', 'temp', `extensions-${Date.now()}`);

  // Cleanup function to remove temp directory
  const cleanup = () => {
    fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  };

  try {
    // Ensure temp directory exists
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Create .claude directory structure
    const claudeDir = path.join(tempDir, '.claude');
    await fs.promises.mkdir(claudeDir, { recursive: true });

    // Copy requested directories
    if (includeSkills) {
      await copyDirectoryIfExists('skills', claudeDir);
    }
    if (includeAgents) {
      await copyDirectoryIfExists('agents', claudeDir);
    }
    if (includeCommands) {
      await copyDirectoryIfExists('commands', claudeDir);
    }
    if (includeHooks) {
      await copyDirectoryIfExists('hooks', claudeDir);
    }
    if (includeKnowledge) {
      await copyDirectoryIfExists('knowledge', claudeDir);
    }

    // Copy config files
    if (includeConfig) {
      await copyConfigFiles(claudeDir);
    }

    // Create tar archive path
    const tarPath = path.join(tempDir, 'extensions.tar');
    await createTarArchive(tempDir, tarPath);

    // Create a readable stream from the tar file
    const stream = fs.createReadStream(tarPath);

    // Use stream.finished() to ensure cleanup happens when stream is finalized
    // This is more reliable than just 'end' and 'error' events
    finished(stream, (err) => {
      // Ignore errors, just cleanup
      cleanup();
    });

    // Also set up timeout-based cleanup as a safety net
    // If stream is not consumed within 5 minutes, cleanup anyway
    const timeoutId = setTimeout(cleanup, 5 * 60 * 1000);

    // Clear timeout when stream is consumed
    stream.on('end', () => clearTimeout(timeoutId));
    stream.on('error', () => clearTimeout(timeoutId));

    // Expose cleanup function for manual cleanup if needed
    stream.cleanup = cleanup;

    return stream;

  } catch (error) {
    // Clean up on error
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
    console.log(`[ExtensionTar] Directory ${dirName} not found, skipping`);
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
      console.log(`[ExtensionTar] Config file ${filename} not found, skipping`);
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
      const dirPath = path.join(EXTENSIONS_DIR, type);

      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.name.startsWith('.')) {
            stats[type]++;
          }
        }
      } catch (error) {
        // Directory doesn't exist
      }
    }

    return stats;
  } catch (error) {
    console.error('[ExtensionTar] Failed to get extension stats:', error);
    return stats;
  }
}

export default {
  createExtensionTar,
  getExtensionStats
};
