/**
 * FileDocumentReader.js
 *
 * 文档读取器 - 封装不同文件类型的读取命令生成逻辑
 * 支持通过命令行工具读取 PDF、Word 等二进制文档的文本内容
 *
 * @module files/FileDocumentReader
 */

import path from 'path';
import { FILE_TYPE_MAP } from './constants.js';

/**
 * MIME 类型映射
 * 用于根据 MIME 类型判断文件类型
 */
const MIME_TYPE_MAP = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
};

/**
 * 文档读取器配置
 * 每种文件类型对应的读取命令模板
 */
const DOCUMENT_READERS = {
  /**
   * PDF 读取器 - 使用 pdftotext (poppler-utils)
   * -layout 参数保留布局格式
   */
  pdf: (filePath) => `Bash tool: pdftotext -layout '${filePath}' -`,

  /**
   * DOCX 读取器 - 使用 pandoc
   * 转换为纯文本输出到 stdout
   */
  docx: (filePath) => `Bash tool: pandoc '${filePath}' -t plain -o -`,

  /**
   * DOC 读取器 - 使用 pandoc
   * 注意：旧版 DOC 格式支持有限，建议转换为 DOCX
   */
  doc: (filePath) => `Bash tool: pandoc '${filePath}' -t plain -o -`,

  /**
   * 默认读取器 - 使用 Read 工具
   * 适用于文本文件和代码文件
   */
  default: () => 'Read tool'
};

/**
 * 获取文件扩展名（带点）
 * @param {string} fileName - 文件名
 * @returns {string} 文件扩展名（如 '.pdf'），无扩展名返回空字符串
 */
function getFileExtension(fileName) {
  if (!fileName) return '';
  const ext = path.extname(fileName).toLowerCase();
  return ext || '';
}

/**
 * 根据文件扩展名获取文件类型
 * @param {string} fileName - 文件名
 * @returns {string|null} 文件类型（如 'pdf', 'docx'），未知类型返回 null
 */
function getFileTypeByExtension(fileName) {
  const ext = getFileExtension(fileName);
  return FILE_TYPE_MAP[ext] || null;
}

/**
 * 根据 MIME 类型获取文件类型
 * @param {string} mimeType - MIME 类型
 * @returns {string|null} 文件类型（如 'pdf', 'docx'），未知类型返回 null
 */
function getFileTypeByMimeType(mimeType) {
  if (!mimeType) return null;
  return MIME_TYPE_MAP[mimeType] || null;
}

/**
 * 获取文件类型
 * 优先使用 MIME 类型，回退到文件扩展名
 * @param {string} fileName - 文件名
 * @param {string} mimeType - MIME 类型（可选）
 * @returns {string|null} 文件类型，未知类型返回 null
 */
function getFileType(fileName, mimeType) {
  return getFileTypeByMimeType(mimeType) || getFileTypeByExtension(fileName);
}

/**
 * 生成文档读取命令
 * 根据文件类型返回对应的读取命令
 * @param {string} filePath - 文件路径
 * @param {string} fileName - 文件名
 * @param {string} mimeType - MIME 类型（可选）
 * @returns {string} 读取命令描述
 */
export function getReadCommand(filePath, fileName, mimeType = null) {
  const fileType = getFileType(fileName, mimeType);

  // 根据文件类型选择读取器
  const reader = DOCUMENT_READERS[fileType] || DOCUMENT_READERS.default;
  return reader(filePath);
}

/**
 * 生成文件读取指令文本
 * 用于在 Claude 命令中描述如何读取文件
 * @param {string} filePath - 文件路径
 * @param {string} fileName - 文件名
 * @param {number} index - 文件序号（从 1 开始）
 * @param {string} mimeType - MIME 类型（可选）
 * @returns {string} 读取指令文本
 */
export function formatReadInstruction(filePath, fileName, index, mimeType = null) {
  const readMethod = getReadCommand(filePath, fileName, mimeType);
  return `${index}. \`${filePath}\` (${fileName}) - Use ${readMethod}`;
}

/**
 * 批量生成文件读取指令
 * @param {Array<{path: string, name: string, type?: string}>} files - 文件列表
 * @returns {string} 多行读取指令文本
 */
export function formatReadInstructions(files) {
  return files
    .map((f, i) => formatReadInstruction(f.path, f.name, i + 1, f.type))
    .join('\n');
}

/**
 * 判断文件是否为需要特殊工具的文档类型
 * @param {string} fileName - 文件名
 * @param {string} mimeType - MIME 类型（可选）
 * @returns {boolean} 是否为特殊文档类型
 */
export function isSpecialDocument(fileName, mimeType = null) {
  const fileType = getFileType(fileName, mimeType);
  return ['pdf', 'docx', 'doc', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileType);
}

/**
 * 导出供外部使用的配置
 */
export const SUPPORTED_DOCUMENT_TYPES = Object.keys(DOCUMENT_READERS).filter(k => k !== 'default');
export const DOCUMENT_TYPE_MAP = MIME_TYPE_MAP;
