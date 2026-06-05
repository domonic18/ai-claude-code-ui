/**
 * Documents Feature
 *
 * 文档面板功能的统一导出
 */

export { DocumentPanel } from './components/DocumentPanel';
export { DocumentSection } from './components/DocumentSection';
export { DocumentItem } from './components/DocumentItem';
export { DocumentUploadZone } from './components/DocumentUploadZone';
export { DocumentPreview } from './components/DocumentPreview';
export { useDocuments } from './hooks/useDocuments';
export { useDocumentPreview } from './hooks/useDocumentPreview';
export { emitDocumentCreated, onDocumentCreated, emitNavigateToConversation, onNavigateToConversation } from './services/documentEvents';
export type { DocumentItem as DocumentItemType, DocumentFileType, DocumentListResponse } from './types/document.types';
