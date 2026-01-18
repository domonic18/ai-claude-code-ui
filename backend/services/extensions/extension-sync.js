/**
 * Extension Sync Service
 *
 * Manages synchronization of pre-configured extensions (agents, commands, skills)
 * from the project root extensions/ directory to user .claude/ directories.
 *
 * @module services/extensions/extension-sync
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path configuration
// This file is at: backend/services/extensions/extension-sync.js
// Project root is 4 levels up: extensions -> services -> backend -> project_root
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const EXTENSIONS_DIR = path.join(PROJECT_ROOT, 'extensions');

/**
 * Synchronize pre-configured extensions to user directory
 *
 * @param {string} targetDir - Target .claude directory (e.g., workspace/users/user_1/data/.claude)
 * @param {Object} options - Sync options
 * @param {boolean} options.overwriteUserFiles - Whether to overwrite existing user files (default: true)
 * @returns {Promise<Object>} Sync results with counts and errors
 */
export async function syncExtensions(targetDir, options = {}) {
  const { overwriteUserFiles = true } = options;

  const results = {
    agents: { synced: 0, errors: [] },
    commands: { synced: 0, errors: [] },
    skills: { synced: 0, errors: [] }
  };

  try {
    // Ensure target subdirectories exist
    await fs.mkdir(path.join(targetDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(targetDir, 'commands'), { recursive: true });
    await fs.mkdir(path.join(targetDir, 'skills'), { recursive: true });

    // Sync each type of extension
    await syncResourceType('agents', targetDir, results.agents, overwriteUserFiles);
    await syncResourceType('commands', targetDir, results.commands, overwriteUserFiles);
    await syncResourceType('skills', targetDir, results.skills, overwriteUserFiles);

    return results;
  } catch (error) {
    console.error('[ExtensionSync] Failed to sync extensions:', error);
    throw error;
  }
}

/**
 * Sync a specific type of resource
 *
 * @private
 * @param {string} type - Resource type: 'agents', 'commands', or 'skills'
 * @param {string} targetDir - Target .claude directory
 * @param {Object} results - Results object to update
 * @param {boolean} overwrite - Whether to overwrite existing files
 */
async function syncResourceType(type, targetDir, results, overwrite) {
  const sourceDir = path.join(EXTENSIONS_DIR, type);
  const targetSubDir = path.join(targetDir, type);

  if (!await directoryExists(sourceDir)) {
    console.log(`[ExtensionSync] Source directory not found: ${sourceDir}, skipping ${type}`);
    return;
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    // Skip README files and hidden files
    if (entry.name === 'README.md' || entry.name.startsWith('.')) {
      continue;
    }

    try {
      if (type === 'skills') {
        // Skills are directories containing SKILL.md
        if (entry.isDirectory()) {
          const sourcePath = path.join(sourceDir, entry.name);
          const targetPath = path.join(targetSubDir, entry.name);

          // Check if target exists and skip if not overwriting
          if (!overwrite && await directoryExists(targetPath)) {
            console.log(`[ExtensionSync] Skipping existing skill: ${entry.name}`);
            continue;
          }

          await copyDirectory(sourcePath, targetPath);
          results.synced++;
          console.log(`[ExtensionSync] Synced skill: ${entry.name}`);
        }
      } else {
        // Agents and Commands are files
        if (entry.isFile()) {
          const sourcePath = path.join(sourceDir, entry.name);
          const targetPath = path.join(targetSubDir, entry.name);

          // Check if target exists and skip if not overwriting
          if (!overwrite && await fileExists(targetPath)) {
            console.log(`[ExtensionSync] Skipping existing ${type.slice(0, -1)}: ${entry.name}`);
            continue;
          }

          await fs.copyFile(sourcePath, targetPath);
          results.synced++;
          console.log(`[ExtensionSync] Synced ${type.slice(0, -1)}: ${entry.name}`);
        }
      }
    } catch (error) {
      const errorMsg = `${entry.name}: ${error.message}`;
      results.errors.push({ resource: entry.name, error: error.message });
      console.error(`[ExtensionSync] Failed to sync ${entry.name}:`, error.message);
    }
  }
}

/**
 * Synchronize extensions to all users
 *
 * @param {Object} options - Sync options
 * @param {boolean} options.overwriteUserFiles - Whether to overwrite existing user files (default: false)
 * @returns {Promise<Object>} Sync results with total, synced, failed counts
 */
export async function syncToAllUsers(options = {}) {
  const { overwriteUserFiles = false } = options;

  // Import User repository dynamically to avoid circular dependency
  const { repositories } = await import('../../database/db.js');
  const { User } = repositories;
  const { getWorkspaceDir } = await import('../../config/config.js');

  const users = User.getAll();
  const workspaceDir = getWorkspaceDir();

  const results = {
    total: users.length,
    synced: 0,
    failed: 0,
    errors: []
  };

  for (const user of users) {
    try {
      const claudeDir = path.join(workspaceDir, 'users', `user_${user.id}`, 'data', '.claude');
      await syncExtensions(claudeDir, { overwriteUserFiles });
      results.synced++;
      console.log(`[ExtensionSync] Synced extensions for user ${user.id} (${user.username})`);
    } catch (error) {
      results.failed++;
      results.errors.push({ userId: user.id, username: user.username, error: error.message });
      console.error(`[ExtensionSync] Failed to sync for user ${user.id}:`, error.message);
    }
  }

  return results;
}

/**
 * Get all available extensions from the extensions/ directory
 *
 * @returns {Promise<Object>} Object containing agents, commands, and skills arrays
 */
export async function getAllExtensions() {
  const extensions = {
    agents: [],
    commands: [],
    skills: []
  };

  // Read Agents
  const agentsDir = path.join(EXTENSIONS_DIR, 'agents');
  if (await directoryExists(agentsDir)) {
    const entries = await fs.readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        const filePath = path.join(agentsDir, entry.name);
        try {
          const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
          extensions.agents.push({
            filename: entry.name,
            name: content.name || entry.name.replace('.json', ''),
            description: content.description || ''
          });
        } catch {
          extensions.agents.push({
            filename: entry.name,
            name: entry.name.replace('.json', ''),
            description: '[解析失败]'
          });
        }
      }
    }
  }

  // Read Commands
  const commandsDir = path.join(EXTENSIONS_DIR, 'commands');
  if (await directoryExists(commandsDir)) {
    const entries = await fs.readdir(commandsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        extensions.commands.push({
          filename: entry.name,
          name: entry.name.replace('.md', '')
        });
      }
    }
  }

  // Read Skills
  const skillsDir = path.join(EXTENSIONS_DIR, 'skills');
  if (await directoryExists(skillsDir)) {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');

        let description = '';
        if (await fileExists(skillMdPath)) {
          try {
            const content = await fs.readFile(skillMdPath, 'utf-8');
            const match = content.match(/^#\s+(.+)$/m);
            description = match ? match[1] : '';
          } catch {
            description = '[无法读取]';
          }
        }

        extensions.skills.push({
          name: entry.name,
          description
        });
      }
    }
  }

  return extensions;
}

/**
 * Check if a directory exists
 *
 * @private
 * @param {string} dirPath - Directory path to check
 * @returns {Promise<boolean>} True if directory exists
 */
async function directoryExists(dirPath) {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a file exists
 *
 * @private
 * @param {string} filePath - File path to check
 * @returns {Promise<boolean>} True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy a directory recursively
 *
 * @private
 * @param {string} source - Source directory path
 * @param {string} target - Target directory path
 */
async function copyDirectory(source, target) {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
    } else {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

export default {
  syncExtensions,
  syncToAllUsers,
  getAllExtensions
};
