/**
 * File Upload Handler
 *
 * Handles file upload operations for FileController
 *
 * @module controllers/api/fileUploadHandler
 */

import fs from 'fs/promises';
import { execSync } from 'child_process';
import containerManager from '../../services/container/core/index.js';
import { ALLOWED_UPLOAD_EXTENSIONS } from '../../services/files/constants.js';
import { createLogger } from '../../utils/logger.js';
import { validateFileExtension } from './fileOperationHelpers.js';

const logger = createLogger('controllers/api/fileUploadHandler');

// 处理业务逻辑，供路由层调用
/**
 * Handles file upload via Docker putArchive API
 * @param {Object} file - Uploaded file object with buffer and metadata
 * @param {string} userId - User ID
 * @param {string} projectName - Project name
 * @returns {Promise<Object>} Upload result with file metadata
 */
export async function handleFileUpload(file, userId, projectName) {
  const originalName = file.originalname;
  const ext = validateFileExtension(originalName, ALLOWED_UPLOAD_EXTENSIONS);

  const today = new Date().toISOString().split('T')[0];

  // Generate ASCII-safe filename
  const uniqueId = Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
  const safeFilename = `${uniqueId}${ext}`;

  // Container paths
  const containerPath = `/workspace/${projectName}/uploads/${today}/${safeFilename}`;
  const containerDir = `/workspace/${projectName}/uploads/${today}`;

  // Get user volume name
  const volumeName = `claude-user-${userId}-workspace`;

  // Use putArchive API to write file to user volume
  const container = await containerManager.getOrCreateContainer(userId);
  const dockerContainer = containerManager.docker.getContainer(container.id);

  // Create local temp files and tar (preserve full directory structure)
  const tempDir = `/tmp/upload_${Date.now()}`;
  const localDirPath = `${tempDir}/${projectName}/uploads/${today}`;
  const localFilePath = `${localDirPath}/${safeFilename}`;

  await fs.mkdir(localDirPath, { recursive: true });
  await fs.writeFile(localFilePath, file.buffer);

  // Create tar archive (preserve directory structure, use ustar format to avoid extended attributes)
  const tarPath = `${tempDir}/archive.tar`;
  execSync(
    `tar --format=ustar -cf "${tarPath}" -C "${tempDir}" "${projectName}/uploads/${today}/${safeFilename}"`,
    { cwd: tempDir }
  );

  // Read tar file
  const tarBuffer = await fs.readFile(tarPath);

  // Upload to container using putArchive (uploads to /workspace, auto-extracts)
  await new Promise((resolve, reject) => {
    dockerContainer.putArchive(tarBuffer, { path: '/workspace' }, (err) => {
      if (err) {
        reject(new Error(`putArchive failed: ${err.message}`));
      } else {
        resolve();
      }
    });
  });

  // Cleanup temp files
  await fs.rm(tempDir, { recursive: true, force: true });

  const responseData = {
    displayName: originalName,
    filename: safeFilename,
    path: containerPath,
    size: file.size,
    type: file.mimetype,
    date: today,
  };

  logger.info('[fileUploadHandler] User', userId, 'uploaded:', originalName, '->', containerPath);

  return responseData;
}

