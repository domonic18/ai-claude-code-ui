/**
 * File Download Handler
 *
 * Handles file download operations for FileController
 *
 * @module controllers/api/fileDownloadHandler
 */

import path from 'path';
import tar from 'tar';
import containerManager from '../../services/container/core/index.js';
import { createLogger } from '../../utils/logger.js';
import { buildContainerPath, getContentType } from './fileOperationHelpers.js';

const logger = createLogger('controllers/api/fileDownloadHandler');

/**
 * Downloads file from container using Docker getArchive API
 * @param {string} userId - User ID
 * @param {string} filePath - File path
 * @param {string} projectName - Project name
 * @returns {Promise<{content: Buffer, contentType: string, fileName: string}>} Download data
 */
export async function handleFileDownload(userId, filePath, projectName) {
  // Get container
  const container = await containerManager.getOrCreateContainer(userId);
  const dockerContainer = containerManager.docker.getContainer(container.id);

  // File path in container
  const containerPath = buildContainerPath(filePath, projectName);

  // Get filename for download
  const fileName = path.basename(containerPath);

  // Detect file extension for Content-Type
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const contentType = getContentType(ext);

  // Get tar stream using Docker getArchive API
  const tarStream = await new Promise((resolve, reject) => {
    dockerContainer.getArchive({ path: containerPath }, (err, stream) => {
      if (err) {
        reject(new Error(`getArchive failed: ${err.message}`));
        return;
      }
      resolve(stream);
    });
  });

  // Parse tar archive and extract file in memory
  const entries = [];
  await new Promise((resolve, reject) => {
    const parser = new tar.Parse();

    parser.on('entry', (entry) => {
      const chunks = [];
      entry.on('data', (chunk) => chunks.push(chunk));
      entry.on('end', () => {
        entries.push({
          path: entry.path,
          data: Buffer.concat(chunks)
        });
      });
      entry.resume();
    });

    parser.on('end', resolve);
    parser.on('error', reject);

    tarStream.pipe(parser);
  });

  // Find target file
  const targetEntry = entries.find(
    e => e.path.endsWith(fileName) || path.basename(e.path) === fileName
  );

  if (!targetEntry) {
    logger.error('[fileDownloadHandler] File not found in archive. Available entries:',
      entries.map(e => e.path));
    throw new Error('File not found in archive');
  }

  const fileContent = targetEntry.data;

  logger.info('[fileDownloadHandler] User', userId, 'downloaded:', containerPath,
    'size:', fileContent.length, 'entry:', targetEntry.path);

  return {
    content: fileContent,
    contentType,
    fileName
  };
}
