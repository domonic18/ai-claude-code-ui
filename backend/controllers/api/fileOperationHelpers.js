/**
 * File Operation Helpers
 *
 * Helper functions for file operations in FileController
 *
 * @module controllers/api/fileOperationHelpers
 */

/**
 * Content type lookup table for file extensions
 */
const CONTENT_TYPES = {
  // Images
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'ico': 'image/x-icon',

  // Documents
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'pdf': 'application/pdf',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  // Archives
  'zip': 'application/zip',

  // Media
  'mp3': 'audio/mpeg',
  'mp4': 'video/mp4',

  // Default
  'default': 'application/octet-stream'
};

// 获取资源，供路由层调用
/**
 * Gets content type for file extension
 * @param {string} ext - File extension (without dot)
 * @returns {string} Content type
 */
export function getContentType(ext) {
  return CONTENT_TYPES[ext.toLowerCase()] || CONTENT_TYPES.default;
}

// 处理业务逻辑，供路由层调用
/**
 * Builds container path from file path and project name
 * @param {string} filePath - File path
 * @param {string} projectName - Project name
 * @returns {string} Container path
 */
export function buildContainerPath(filePath, projectName) {
  if (filePath.startsWith('/')) {
    return filePath;
  }
  return `/workspace/${projectName}/${filePath}`;
}

// 处理业务逻辑，供路由层调用
/**
 * Validates file extension for upload
 * @param {string} filename - Original filename
 * @param {Array<string>} allowedExtensions - Array of allowed extensions (with dots)
 * @returns {string} Extracted extension
 * @throws {Error} If extension not allowed
 */
export function validateFileExtension(filename, allowedExtensions) {
  const ext = filename.toLowerCase().includes('.')
    ? '.' + filename.split('.').pop().toLowerCase()
    : '';

  if (!allowedExtensions.includes(ext)) {
    throw new Error(
      `Unsupported file type: ${ext}. Allowed types: ${allowedExtensions.join(', ')}`
    );
  }

  return ext;
}

