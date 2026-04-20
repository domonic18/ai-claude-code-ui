/**
 * Description Extractors
 *
 * Extracts descriptions from different file types for extensions
 *
 * @module services/extensions/descriptionExtractors
 */

/**
 * Extracts JSDoc description from .js file content
 * @param {string} content - File content
 * @returns {string} Extracted description
 */
export function extractJsDescription(content) {
  const match = content.match(/\/\*\*\s*([^*]|\*(?!\/))*\*\//);
  return match
    ? match[0].substring(2, match[0].length - 2).trim().substring(0, 100)
    : 'JavaScript Hook';
}

/**
 * Extracts first-line comment description from .sh file content
 * @param {string} content - File content
 * @returns {string} Extracted description
 */
export function extractShDescription(content) {
  const match = content.match(/^#\s*(.+)$/m);
  return match ? match[1] : 'Shell Script Hook';
}

/**
 * Extracts docstring or comment description from .py file content
 * @param {string} content - File content
 * @returns {string} Extracted description
 */
export function extractPyDescription(content) {
  const docstringMatch = content.match(/"""[\s\S]*?"""/);
  if (docstringMatch) {
    return docstringMatch[0].replace(/"/g, '').trim().substring(0, 100);
  }

  const commentMatch = content.match(/^#\s*(.+)$/m);
  return commentMatch ? commentMatch[1] : 'Python Script Hook';
}

/**
 * Extracts description from file content based on extension
 * @param {string} ext - File extension with dot (e.g., '.js')
 * @param {string} content - File content
 * @returns {string} Extracted description
 */
export function extractDescriptionByExtension(ext, content) {
  try {
    const extractors = {
      '.js': extractJsDescription,
      '.md': (content) => content.substring(0, 100).trim(),
      '.sh': extractShDescription,
      '.py': extractPyDescription
    };

    const extractor = extractors[ext];
    return extractor ? extractor(content) : content.substring(0, 100).trim();
  } catch {
    const defaults = {
      '.js': 'JavaScript Hook',
      '.md': 'Markdown Hook',
      '.sh': 'Shell Script Hook',
      '.py': 'Python Script Hook'
    };
    return defaults[ext] || 'Unknown';
  }
}
