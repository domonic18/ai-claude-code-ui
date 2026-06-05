/**
 * Document Types
 *
 * 文档面板相关类型定义
 */

/** 文档类型 */
export type DocumentFileType = 'upload' | 'ai_generated';

/** 文档项 */
export interface DocumentItem {
  /** 文件名 */
  file_name: string;
  /** 文件在容器内的完整路径 */
  file_path: string;
  /** 文件大小（bytes） */
  file_size?: number;
  /** 文档类型 */
  type: DocumentFileType;
  /** 创建时间 */
  created_at?: string;
  /** 关联的对话 ID（AI 生成文档） */
  conversation_id?: string | null;
  /** 关联的消息 ID（用于跳转定位） */
  message_id?: string | null;
}

/** 文档列表响应 */
export interface DocumentListResponse {
  /** 用户上传的文档 */
  uploads: DocumentItem[];
  /** AI 生成的文档 */
  aiGenerated: DocumentItem[];
}

/** 文档内容响应（预览用） */
export interface DocumentContentResponse {
  /** 文件内容（文本） */
  content: string;
  /** MIME 类型 */
  mime_type: string;
}
