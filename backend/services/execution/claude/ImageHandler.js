/**
 * ImageHandler.js
 *
 * 图像处理模块
 * 处理 base64 图像的临时文件创建和清理
 *
 * @module execution/claude/ImageHandler
 */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * 处理图像 - 将 base64 图像保存到临时文件并修改提示
 * @param {string} command - 原始用户提示
 * @param {Array} images - 包含 base64 数据的图像对象数组
 * @param {string} cwd - 用于创建临时文件的工作目录
 * @returns {Promise<Object>} {modifiedCommand, tempImagePaths, tempDir}
 */
export async function handleImages(command, images, cwd) {
  const tempImagePaths = [];
  let tempDir = null;

  if (!images || images.length === 0) {
    return { modifiedCommand: command, tempImagePaths, tempDir };
  }

  try {
    // 在项目目录中创建临时目录
    const workingDir = cwd || process.cwd();
    tempDir = path.join(workingDir, '.tmp', 'images', Date.now().toString());
    await fs.mkdir(tempDir, { recursive: true });

    // 将每个图像保存到临时文件
    for (const [index, image] of images.entries()) {
      // 提取 base64 数据和 mime 类型
      const matches = image.data.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        console.error('Invalid image data format');
        continue;
      }

      const [, mimeType, base64Data] = matches;
      const extension = mimeType.split('/')[1] || 'png';
      const filename = `image_${index}.${extension}`;
      const filepath = path.join(tempDir, filename);

      // 将 base64 数据写入文件
      await fs.writeFile(filepath, Buffer.from(base64Data, 'base64'));
      tempImagePaths.push(filepath);
    }

    // 在提示中包含完整图像路径
    let modifiedCommand = command;
    if (tempImagePaths.length > 0 && command && command.trim()) {
      const imageNote = `\n\n[Images provided at the following paths:]\n${tempImagePaths.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
      modifiedCommand = command + imageNote;
    }

    console.log(`Processed ${tempImagePaths.length} images to temp directory: ${tempDir}`);
    return { modifiedCommand, tempImagePaths, tempDir };
  } catch (error) {
    console.error('Error processing images for SDK:', error);
    return { modifiedCommand: command, tempImagePaths, tempDir };
  }
}

/**
 * 清理临时图像文件
 * @param {Array<string>} tempImagePaths - 要删除的临时文件路径数组
 * @param {string} tempDir - 要删除的临时目录
 * @returns {Promise<void>}
 */
export async function cleanupTempFiles(tempImagePaths, tempDir) {
  if (!tempImagePaths || tempImagePaths.length === 0) {
    return;
  }

  try {
    // 删除单个临时文件
    for (const imagePath of tempImagePaths) {
      await fs.unlink(imagePath).catch(err =>
        console.error(`Failed to delete temp image ${imagePath}:`, err)
      );
    }

    // 删除临时目录
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(err =>
        console.error(`Failed to delete temp directory ${tempDir}:`, err)
      );
    }

    console.log(`Cleaned up ${tempImagePaths.length} temp image files`);
  } catch (error) {
    console.error('Error during temp file cleanup:', error);
  }
}

export default {
  handleImages,
  cleanupTempFiles
};
