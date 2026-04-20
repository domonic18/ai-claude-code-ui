/**
 * Docker Image Handling Utilities
 *
 * Extracted image saving and container upload logic from DockerExecutor.
 */

import path from 'path';
import fs from 'fs/promises';
import tar from 'tar';

/**
 * Check if stderr contains real errors
 * @param {string} stderrOutput - stderr output
 * @returns {boolean} Whether it contains errors
 */
function hasRealError(stderrOutput) {
  const errorPatterns = [
    /^(?!\[SDK\]).*Error:/m,
    /^\s+at\s+/m,
    /process\.exit\(1\)/
  ];

  return errorPatterns.some(pattern => pattern.test(stderrOutput));
}

/**
 * Save base64 image data to local temp directory
 * @param {Array} images - Image attachment array
 * @param {string} tempDir - Temp directory path
 * @returns {Promise<Array<{localPath: string, containerPath: string, filename: string}>>}
 */
async function saveImagesLocally(images, tempDir) {
  const imagePaths = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      continue;
    }

    const [, mimeType, base64Data] = matches;
    const extension = mimeType.split('/')[1] || 'png';
    const filename = `image_${i}.${extension}`;
    const filepath = path.join(tempDir, filename);

    await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
    imagePaths.push({
      localPath: filepath,
      containerPath: '',
      filename
    });
  }

  return imagePaths;
}

/**
 * Organize image files to images subdirectory and set container paths
 * @param {string} tempDir - Temp directory
 * @param {Array} imagePaths - Image path info
 * @param {string} cwd - Container working directory
 */
async function organizeImageFiles(tempDir, imagePaths, cwd) {
  const imagesDir = path.join(tempDir, 'images');
  await fs.mkdir(imagesDir, { recursive: true });

  for (const img of imagePaths) {
    const newPath = path.join(imagesDir, img.filename);
    await fs.rename(img.localPath, newPath);
    img.containerPath = `${cwd}/.tmp/images/${img.filename}`;
  }
}

/**
 * Ensure directory exists in container
 * @param {object} container - Docker container instance
 * @param {string} dirPath - Container directory path
 */
async function ensureContainerDir(container, dirPath) {
  const mkdirExec = await container.exec({
    Cmd: ['mkdir', '-p', dirPath],
    AttachStdout: true,
    AttachStderr: true
  });

  await new Promise((resolve, reject) => {
    mkdirExec.start({ Detach: false }, (err, stream) => {
      if (err) { reject(err); return; }
      if (stream) {
        stream.on('close', resolve);
        stream.on('error', reject);
        setTimeout(resolve, 1000);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Upload tar archive to container
 * @param {object} container - Docker container instance
 * @param {string} tempDir - Temp directory
 * @param {string} cwd - Container working directory
 */
async function uploadTarToContainer(container, tempDir, cwd) {
  const tarPath = path.join(tempDir, 'images.tar');
  await tar.c({ file: tarPath, cwd: tempDir, gzip: false }, ['images']);
  const tarBuffer = await fs.readFile(tarPath);

  await ensureContainerDir(container, `${cwd}/.tmp`);

  await new Promise((resolve, reject) => {
    container.putArchive(tarBuffer, { path: `${cwd}/.tmp` }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Create tar archive and upload to container
 * @param {object} container - Docker container instance
 * @param {string} tempDir - Temp directory path
 * @param {Array} imagePaths - Image path info
 * @param {string} cwd - Container working directory
 */
async function createAndUploadArchive(container, tempDir, imagePaths, cwd) {
  await organizeImageFiles(tempDir, imagePaths, cwd);
  await uploadTarToContainer(container, tempDir, cwd);
}

/**
 * Copy images to container
 * @param {object} container - Docker container instance
 * @param {Array} images - Image attachment array
 * @param {string} cwd - Container working directory
 * @param {Function} logger - Logger function
 * @returns {Promise<Array<string>>} Container image paths
 */
async function copyImagesToContainer(container, images, cwd, logger) {
  if (!images || images.length === 0) {
    return [];
  }

  const tempDir = path.join(process.cwd(), '.tmp', 'images', Date.now().toString());
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const imagePaths = await saveImagesLocally(images, tempDir);
    if (imagePaths.length === 0) {
      return [];
    }

    await createAndUploadArchive(container, tempDir, imagePaths, cwd);

    logger.info('[DockerExecutor] Copied', imagePaths.length, 'images to container');

    await fs.rm(tempDir, { recursive: true, force: true });

    return imagePaths.map(p => p.containerPath);

  } catch (error) {
    logger.error({ err: error }, '[DockerExecutor] Error copying images to container');
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    throw new Error(`图片复制到容器失败: ${error.message}`);
  }
}

export {
  hasRealError,
  saveImagesLocally,
  organizeImageFiles,
  ensureContainerDir,
  uploadTarToContainer,
  createAndUploadArchive,
  copyImagesToContainer
};
