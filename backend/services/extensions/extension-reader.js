/**
 * Extension Metadata Reader
 *
 * Reads extension metadata from extensions/.claude/ directory
 * Used for management UI to display available agents, commands, skills, hooks, and knowledge
 *
 * @module services/extensions/extension-reader
 */

import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../utils/logger.js';
import {
  EXTENSIONS_DIR,
  FILE_EXTENSIONS,
  directoryExists
} from './extension-utils.js';
import {
  parseSkillDescription,
  parseHookDescription,
  parseKnowledgeFile,
  createKnowledgeDirMetadata
} from './extension-parsers.js';

const logger = createLogger('services/extensions/extension-reader');

/**
 * Generic directory reader - eliminates repetitive structure in readAgents/readCommands/readSkills/readHooks/readKnowledge
 * @param {string} subDir - Subdirectory name relative to EXTENSIONS_DIR
 * @param {Object} options - Options
 * @param {Function} [options.filter] - Filter directory entries (entry) => boolean
 * @param {Function} [options.parseEntry] - Parse metadata from directory entry (entry, fullPath) => Promise<object>
 * @returns {Promise<Array>} Parsed extension entries
 */
async function readExtensionDir(subDir, { filter = () => true, parseEntry } = {}) {
  const results = [];
  const dirPath = path.join(EXTENSIONS_DIR, subDir);

  if (!(await directoryExists(dirPath))) return results;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!filter(entry)) continue;

    if (parseEntry) {
      try {
        const item = await parseEntry(entry, path.join(dirPath, entry.name));
        if (item) results.push(item);
      } catch {
        results.push({ filename: entry.name, name: entry.name, description: '[解析失败]' });
      }
    }
  }

  return results;
}

/**
 * Reads agents from extensions directory
 * @returns {Promise<Array>} Array of agent metadata
 */
async function readAgents() {
  return readExtensionDir('agents', {
    filter: (entry) => entry.isFile() && entry.name.endsWith('.json'),
    parseEntry: async (entry, filePath) => {
      try {
        const content = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        return {
          filename: entry.name,
          name: content.name || entry.name.replace('.json', ''),
          description: content.description || ''
        };
      } catch {
        return {
          filename: entry.name,
          name: entry.name.replace('.json', ''),
          description: '[解析失败]'
        };
      }
    }
  });
}

/**
 * Reads commands from extensions directory
 * @returns {Promise<Array>} Array of command metadata
 */
async function readCommands() {
  return readExtensionDir('commands', {
    filter: (entry) => entry.isFile() && entry.name.endsWith('.md'),
    parseEntry: async (entry) => ({
      filename: entry.name,
      name: entry.name.replace('.md', '')
    })
  });
}

/**
 * Reads skills from extensions directory
 * @returns {Promise<Array>} Array of skill metadata
 */
async function readSkills() {
  return readExtensionDir('skills', {
    filter: (entry) => entry.isDirectory() && !entry.name.startsWith('.'),
    parseEntry: async (entry, filePath) => {
      const description = await parseSkillDescription(filePath);
      return { name: entry.name, description };
    }
  });
}

/**
 * Reads hooks from extensions directory
 * @returns {Promise<Array>} Array of hook metadata
 */
async function readHooks() {
  const allowedExts = FILE_EXTENSIONS.hooks;

  return readExtensionDir('hooks', {
    filter: (entry) => entry.isFile() && allowedExts.includes(path.extname(entry.name)),
    parseEntry: async (entry, filePath) => {
      const ext = path.extname(entry.name);
      const description = await parseHookDescription(filePath, ext);

      return {
        filename: entry.name,
        name: entry.name.replace(/\.(js|md|sh|py)$/, ''),
        type: ext.substring(1),
        description
      };
    }
  });
}

/**
 * Reads knowledge from extensions directory
 * @returns {Promise<Array>} Array of knowledge metadata
 */
async function readKnowledge() {
  return readExtensionDir('knowledge', {
    filter: () => true,
    parseEntry: async (entry, filePath) => {
      if (entry.isFile()) {
        const ext = path.extname(entry.name);
        return parseKnowledgeFile(filePath, entry.name, ext);
      }

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        return createKnowledgeDirMetadata(entry.name);
      }

      return null;
    }
  });
}

// ─── Public API ─────────────────────────────────────────

/** Extension metadata cache (avoids reading all files from disk on every request) */
let extensionsCache = null;
let extensionsCacheTime = 0;
const EXTENSIONS_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Gets metadata for all available extensions
 * @param {Object} [options] - Options
 * @param {boolean} [options.forceRefresh=false] - Force cache refresh
 * @returns {Promise<Object>} Object containing agents, commands, skills, hooks, knowledge arrays
 */
export async function getAllExtensions(options = {}) {
  const now = Date.now();

  if (!options.forceRefresh && extensionsCache && (now - extensionsCacheTime) < EXTENSIONS_CACHE_TTL_MS) {
    return extensionsCache;
  }

  const [agents, commands, skills, hooks, knowledge] = await Promise.all([
    readAgents(),
    readCommands(),
    readSkills(),
    readHooks(),
    readKnowledge()
  ]);

  extensionsCache = { agents, commands, skills, hooks, knowledge };
  extensionsCacheTime = now;

  return extensionsCache;
}

/**
 * Clears extension metadata cache (call when extension files change)
 */
export function clearExtensionsCache() {
  extensionsCache = null;
  extensionsCacheTime = 0;
}
