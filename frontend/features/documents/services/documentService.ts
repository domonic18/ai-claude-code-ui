/**
 * Document Service
 *
 * 文档管理 API 调用封装
 * 使用 shared/api 的 authenticatedFetch 处理认证
 */

import { authenticatedFetch } from '@/shared/services';
import type { DocumentListResponse, DocumentContentResponse } from '../types/document.types';

// 简易前端调试日志（生产环境可移除）
function debugLog(tag: string, ...args: any[]) {
  console.log(`%c[documentService] ${tag}`, 'color: #2196F3; font-weight: bold', ...args);
}

const API_BASE = '/api/projects';

/**
 * 获取项目下所有文档
 */
export async function fetchDocuments(projectName: string): Promise<DocumentListResponse> {
  const url = `${API_BASE}/${encodeURIComponent(projectName)}/documents`;
  debugLog('fetchDocuments 请求', { url });
  const res = await authenticatedFetch(url);
  debugLog('fetchDocuments 响应', { status: res.status, statusText: res.statusText, ok: res.ok });
  if (!res.ok) throw new Error(`Failed to fetch documents: ${res.statusText}`);
  const json = await res.json();
  debugLog('fetchDocuments 数据', { data: json.data });
  return json.data;
}

/**
 * 上传文档到项目
 */
export async function uploadDocument(
  projectName: string,
  file: File
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);

  const url = `${API_BASE}/${encodeURIComponent(projectName)}/documents/upload`;
  debugLog('uploadDocument 请求', {
    url,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  const res = await authenticatedFetch(url, {
    method: 'POST',
    body: formData
    // 不设置 Content-Type，让浏览器自动设置 multipart/form-data
  });

  debugLog('uploadDocument 响应', { status: res.status, statusText: res.statusText, ok: res.ok });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    debugLog('uploadDocument 失败响应体', body);
    throw new Error(`Upload failed: ${res.statusText} - ${body}`);
  }

  debugLog('uploadDocument 成功');
}

/**
 * 删除文档
 */
export async function deleteDocument(
  projectName: string,
  filePath: string,
  docType: 'upload' | 'ai_generated'
): Promise<void> {
  const res = await authenticatedFetch(
    `${API_BASE}/${encodeURIComponent(projectName)}/documents`,
    {
      method: 'DELETE',
      body: JSON.stringify({ file_path: filePath, doc_type: docType })
    }
  );
  if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`);
}

/**
 * 获取文档内容（预览）
 */
export async function fetchDocumentContent(
  projectName: string,
  filePath: string
): Promise<DocumentContentResponse> {
  const res = await authenticatedFetch(
    `${API_BASE}/${encodeURIComponent(projectName)}/documents/content?file_path=${encodeURIComponent(filePath)}`
  );
  if (!res.ok) throw new Error(`Failed to fetch content: ${res.statusText}`);
  const json = await res.json();
  return json.data;
}

/**
 * 保存文档内容（编辑后保存）
 */
export async function saveDocumentContent(
  projectName: string,
  filePath: string,
  content: string
): Promise<void> {
  const res = await authenticatedFetch(
    `${API_BASE}/${encodeURIComponent(projectName)}/documents/content`,
    {
      method: 'PUT',
      body: JSON.stringify({ file_path: filePath, content })
    }
  );
  if (!res.ok) throw new Error(`Failed to save document: ${res.statusText}`);
}
