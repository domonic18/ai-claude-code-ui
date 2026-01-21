/**
 * Extension Sync Service
 *
 * Manages synchronization of pre-configured extensions (agents, commands, skills, hooks, knowledge)
 * and configuration files (CLAUDE.md, settings.json) from the project root extensions/.claude/
 * directory to user .claude/ directories.
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
const EXTENSIONS_DIR = path.join(PROJECT_ROOT, 'extensions', '.claude');

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
    skills: { synced: 0, errors: [] },
    hooks: { synced: 0, errors: [] },
    knowledge: { synced: 0, errors: [] },
    config: { synced: 0, errors: [] }  // For CLAUDE.md and settings.json
  };

  try {
    // Ensure target subdirectories exist
    await fs.mkdir(path.join(targetDir, 'agents'), { recursive: true });
    await fs.mkdir(path.join(targetDir, 'commands'), { recursive: true });
    await fs.mkdir(path.join(targetDir, 'skills'), { recursive: true });
    await fs.mkdir(path.join(targetDir, 'hooks'), { recursive: true });
    await fs.mkdir(path.join(targetDir, 'knowledge'), { recursive: true });

    // Sync each type of extension
    await syncResourceType('agents', targetDir, results.agents, overwriteUserFiles);
    await syncResourceType('commands', targetDir, results.commands, overwriteUserFiles);
    await syncResourceType('skills', targetDir, results.skills, overwriteUserFiles);
    await syncResourceType('hooks', targetDir, results.hooks, overwriteUserFiles);
    await syncResourceType('knowledge', targetDir, results.knowledge, overwriteUserFiles);

    // Sync configuration files (CLAUDE.md and settings.json)
    await syncConfigFiles(targetDir, results.config, overwriteUserFiles);

    // 打印汇总日志
    const totalSynced = results.agents.synced + results.commands.synced + results.skills.synced +
                       results.hooks.synced + results.knowledge.synced + results.config.synced;
    if (totalSynced > 0) {
      console.log(`[ExtensionSync] Synced ${totalSynced} extensions (${results.agents.synced} agents, ${results.commands.synced} commands, ${results.skills.synced} skills, ${results.hooks.synced} hooks, ${results.knowledge.synced} knowledge, ${results.config.synced} config)`);
    }

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
 * @param {string} type - Resource type: 'agents', 'commands', 'skills', 'hooks', or 'knowledge'
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

  // File extension mapping for different resource types
  const fileExtensions = {
    agents: ['.json'],
    commands: ['.md'],
    hooks: ['.js', '.md', '.sh', '.py'],  // Shell scripts and Python scripts
    knowledge: ['.md', '.txt']
  };

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
        }
      } else if (type === 'hooks' || type === 'knowledge') {
        // Hooks and Knowledge support both files and directories
        if (entry.isFile()) {
          const ext = path.extname(entry.name);
          const allowedExts = fileExtensions[type] || [];

          if (allowedExts.includes(ext)) {
            const sourcePath = path.join(sourceDir, entry.name);
            const targetPath = path.join(targetSubDir, entry.name);

            if (!overwrite && await fileExists(targetPath)) {
              console.log(`[ExtensionSync] Skipping existing ${type.slice(0, -1)}: ${entry.name}`);
              continue;
            }

            await fs.copyFile(sourcePath, targetPath);
            results.synced++;
          }
        } else if (entry.isDirectory()) {
          // Support subdirectories (useful for knowledge categorization)
          const sourcePath = path.join(sourceDir, entry.name);
          const targetPath = path.join(targetSubDir, entry.name);

          if (!overwrite && await directoryExists(targetPath)) {
            console.log(`[ExtensionSync] Skipping existing directory: ${entry.name}`);
            continue;
          }

          await copyDirectory(sourcePath, targetPath);
          results.synced++;
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
 * Synchronize configuration files (CLAUDE.md and settings.json)
 *
 * @private
 * @param {string} targetDir - Target .claude directory
 * @param {Object} results - Results object to update
 * @param {boolean} overwrite - Whether to overwrite existing files
 */
async function syncConfigFiles(targetDir, results, overwrite) {
  const configFiles = ['CLAUDE.md', 'settings.json'];

  for (const filename of configFiles) {
    const sourcePath = path.join(EXTENSIONS_DIR, filename);
    const targetPath = path.join(targetDir, filename);

    try {
      // Check if source file exists
      if (!(await fileExists(sourcePath))) {
        console.log(`[ExtensionSync] Config file not found: ${filename}, skipping`);
        continue;
      }

      // Check if target exists and skip if not overwriting
      if (!overwrite && await fileExists(targetPath)) {
        console.log(`[ExtensionSync] Skipping existing config file: ${filename}`);
        continue;
      }

      // Copy the file
      await fs.copyFile(sourcePath, targetPath);
      results.synced++;
    } catch (error) {
      const errorMsg = `${filename}: ${error.message}`;
      results.errors.push({ resource: filename, error: error.message });
      console.error(`[ExtensionSync] Failed to sync ${filename}:`, error.message);
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
 * Get all available extensions from the extensions/.claude/ directory
 *
 * @returns {Promise<Object>} Object containing agents, commands, skills, hooks, and knowledge arrays
 */
export async function getAllExtensions() {
  const extensions = {
    agents: [],
    commands: [],
    skills: [],
    hooks: [],
    knowledge: []
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

  // Read Hooks (.js, .md, .sh, and .py files)
  const hooksDir = path.join(EXTENSIONS_DIR, 'hooks');
  if (await directoryExists(hooksDir)) {
    const entries = await fs.readdir(hooksDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (ext === '.js' || ext === '.md' || ext === '.sh' || ext === '.py') {
          const filePath = path.join(hooksDir, entry.name);

          let description = '';
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            // For .js files, try to extract description from JSDoc comments
            if (ext === '.js') {
              const match = content.match(/\/\*\*\s*([^*]|\*(?!\/))*\*\//);
              description = match ? match[0].substring(2, match[0].length - 2).trim().substring(0, 100) : 'JavaScript Hook';
            } else if (ext === '.md') {
              // For .md files, extract first heading
              const match = content.match(/^#\s+(.+)$/m);
              description = match ? match[1] : '';
            } else if (ext === '.sh') {
              // For .sh files, extract description from comment or use default
              const match = content.match(/^#\s*(.+)$/m);
              description = match ? match[1] : 'Shell Script Hook';
            } else {
              // For .py files, extract description from docstring or comment
              const docstringMatch = content.match(/"""[\s\S]*?"""/);
              if (docstringMatch) {
                description = docstringMatch[0].replace(/"/g, '').trim().substring(0, 100);
              } else {
                const commentMatch = content.match(/^#\s*(.+)$/m);
                description = commentMatch ? commentMatch[1] : 'Python Script Hook';
              }
            }
          } catch {
            description = ext === '.js' ? 'JavaScript Hook' :
                         ext === '.md' ? 'Markdown Hook' :
                         ext === '.sh' ? 'Shell Script Hook' : 'Python Script Hook';
          }

          extensions.hooks.push({
            filename: entry.name,
            name: entry.name.replace(/\.(js|md|sh|py)$/, ''),
            type: ext.substring(1),
            description
          });
        }
      }
    }
  }

  // Read Knowledge (.md and .txt files and directories)
  const knowledgeDir = path.join(EXTENSIONS_DIR, 'knowledge');
  if (await directoryExists(knowledgeDir)) {
    const entries = await fs.readdir(knowledgeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (ext === '.md' || ext === '.txt') {
          const filePath = path.join(knowledgeDir, entry.name);

          let description = '';
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            if (ext === '.md') {
              const match = content.match(/^#\s+(.+)$/m);
              description = match ? match[1] : content.substring(0, 100).trim();
            } else {
              description = content.substring(0, 100).trim();
            }
          } catch {
            description = 'Knowledge File';
          }

          extensions.knowledge.push({
            filename: entry.name,
            name: entry.name.replace(/\.(md|txt)$/, ''),
            type: ext.substring(1),
            description
          });
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
        // Knowledge subdirectories
        extensions.knowledge.push({
          filename: entry.name + '/',
          name: entry.name,
          type: 'dir',
          description: 'Knowledge Directory'
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
