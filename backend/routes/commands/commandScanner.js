/**
 * Command Scanner
 *
 * Recursively scans directories for command files (.md) and parses their metadata.
 *
 * @module routes/commands/commandScanner
 */

import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('commands/scanner');

/**
 * Recursively scan directory for command files (.md)
 * @param {string} dir - Directory to scan
 * @param {string} baseDir - Base directory for relative path calculation
 * @param {string} namespace - Command namespace ('project', 'user', or 'builtin')
 * @returns {Promise<Array<{name: string, path: string, relativePath: string, description: string, namespace: string, metadata: object}>>}
 */
export async function scanCommandsDirectory(dir, baseDir, namespace) {
  const commands = [];

  try {
    await fs.access(dir);

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subCommands = await scanCommandsDirectory(fullPath, baseDir, namespace);
        commands.push(...subCommands);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = await fs.readFile(fullPath, 'utf8');
          const { data: frontmatter, content: commandContent } = matter(content);

          const relativePath = path.relative(baseDir, fullPath);
          const commandName = '/' + relativePath.replace(/\.md$/, '').replace(/\\/g, '/');

          let description = frontmatter.description || '';
          if (!description) {
            const firstLine = commandContent.trim().split('\n')[0];
            description = firstLine.replace(/^#+\s*/, '').trim();
          }

          commands.push({
            name: commandName,
            path: fullPath,
            relativePath,
            description,
            namespace,
            metadata: frontmatter
          });
        } catch (err) {
          logger.error(`Error parsing command file ${fullPath}:`, err.message);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT' && err.code !== 'EACCES') {
      logger.error(`Error scanning directory ${dir}:`, err.message);
    }
  }

  return commands;
}
