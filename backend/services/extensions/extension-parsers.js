/**
 * Extension Metadata Parsers
 *
 * Helper functions for parsing extension metadata
 * Extracted from extension-reader.js to reduce complexity
 *
 * @module services/extensions/extension-parsers
 */

import fs from 'fs/promises';
import path from 'path';
import { fileExists, extractMarkdownTitle } from './extension-utils.js';
import { extractDescriptionByExtension } from './descriptionExtractors.js';

/**
 * Parses skill description from SKILL.md file
 * @param {string} filePath - Path to skill directory
 * @returns {Promise<string>} Extracted description or empty string
 */
export async function parseSkillDescription(filePath) {
  const skillMdPath = path.join(filePath, 'SKILL.md');

  if (!(await fileExists(skillMdPath))) {
    return '';
  }

  try {
    const content = await fs.readFile(skillMdPath, 'utf-8');
    return extractMarkdownTitle(content);
  } catch {
    return '[无法读取]';
  }
}

/**
 * Parses hook description from file content
 * @param {string} filePath - Path to hook file
 * @param {string} ext - File extension
 * @returns {Promise<string>} Extracted description
 */
export async function parseHookDescription(filePath, ext) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return extractDescriptionByExtension(ext, content);
  } catch {
    return extractDescriptionByExtension(ext, '');
  }
}

/**
 * Parses knowledge file metadata
 * @param {string} filePath - Path to knowledge file
 * @param {string} name - File name
 * @param {string} ext - File extension
 * @returns {Promise<Object|null>} Knowledge file metadata or null if not allowed
 */
export async function parseKnowledgeFile(filePath, name, ext) {
  const allowedExts = ['.md', '.txt'];

  if (!allowedExts.includes(ext)) {
    return null;
  }

  let description;
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    description = ext === '.md'
      ? (extractMarkdownTitle(content) || content.substring(0, 100).trim())
      : content.substring(0, 100).trim();
  } catch {
    description = 'Knowledge File';
  }

  return {
    filename: name,
    name: name.replace(/\.(md|txt)$/, ''),
    type: ext.substring(1),
    description
  };
}

/**
 * Creates knowledge directory metadata
 * @param {string} name - Directory name
 * @returns {Object} Knowledge directory metadata
 */
export function createKnowledgeDirMetadata(name) {
  return {
    filename: name + '/',
    name,
    type: 'dir',
    description: 'Knowledge Directory'
  };
}
