/**
 * HtmlPreview Component
 *
 * Full-screen HTML file preview using Blob URL + iframe.
 * Toolbar is fixed-positioned separately from iframe to avoid
 * event capture issues with sandboxed iframes.
 *
 * @module shared/components/common/HtmlPreview
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { ConfirmDialog } from '@/shared/components/ui/ConfirmDialog';
import { X, ExternalLink, Download, Maximize2, Minimize2 } from 'lucide-react';
import { authenticatedFetch } from '@/shared/services';
import { logger } from '@/shared/utils/logger';

export interface HtmlPreviewFile {
  name: string;
  path: string;
  projectName: string;
}

export interface HtmlPreviewProps {
  file: HtmlPreviewFile;
  onClose: () => void;
}

interface HtmlLoaderResult {
  blobUrl: string | null;
  error: string | null;
  loading: boolean;
}

/** Toolbar height in px, used to offset the iframe below */
const TOOLBAR_HEIGHT = 44;

/**
 * Custom hook to load HTML content via API and create a Blob URL for iframe rendering.
 * Uses Blob URL instead of direct API URL to avoid authentication issues in iframe.
 *
 * @param {string} filePath - The API path to fetch the HTML content from
 * @returns {HtmlLoaderResult} - Object containing blobUrl, error, and loading state
 */
function useHtmlLoader(filePath: string): HtmlLoaderResult {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const blobUrlRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const loadHtml = async () => {
      try {
        setLoading(true);
        setError(null);
        setBlobUrl(null);

        controllerRef.current = new AbortController();

        const response = await authenticatedFetch(filePath, {
          signal: controllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const htmlText = await response.text();
        const blob = new Blob([htmlText], { type: 'text/html; charset=utf-8' });
        blobUrlRef.current = URL.createObjectURL(blob);
        setBlobUrl(blobUrlRef.current);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        logger.error('Error loading HTML preview:', err);
        setError('Unable to load HTML preview');
      } finally {
        setLoading(false);
      }
    };

    loadHtml();

    return () => {
      controllerRef.current?.abort();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [filePath]);

  return { blobUrl, error, loading };
}

/**
 * HtmlPreview - Full-screen HTML file preview component
 *
 * Renders HTML content in a sandboxed iframe using Blob URL.
 * Toolbar is fixed at the top, iframe fills remaining space below.
 */
function HtmlPreview({ file, onClose }: HtmlPreviewProps) {
  const htmlPath = `/api/projects/${file.projectName}/files/content?path=${encodeURIComponent(file.path)}`;
  const { blobUrl, error, loading } = useHtmlLoader(htmlPath);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOpenConfirm, setShowOpenConfirm] = useState(false);

  /** Show confirmation dialog before opening in a new tab */
  const handleRequestOpenInNewTab = useCallback(() => {
    if (!blobUrl) return;
    setShowOpenConfirm(true);
  }, [blobUrl]);

  /** Open the HTML content in a new browser tab after user confirmation */
  const handleConfirmOpenInNewTab = useCallback(() => {
    if (!blobUrl) return;
    // Use noopener+noreferrer to prevent the new window from accessing
    // window.opener or leaking Referer information.
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
    setShowOpenConfirm(false);
  }, [blobUrl]);

  /** Download the HTML file to local disk */
  const handleDownload = useCallback(() => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [blobUrl, file.name]);

  /** Toggle fullscreen mode */
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  return (
    <>
      {/* Background overlay */}
      <div className="fixed inset-0 bg-black/80 z-50" />

      {/* Toolbar — fixed at top, separate from iframe layer */}
      <div
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 bg-gray-900 z-[60]"
        style={{ height: TOOLBAR_HEIGHT }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-200 truncate">
            {file.name}
          </span>
          <span className="text-xs text-gray-500 truncate hidden sm:inline">
            {file.path}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRequestOpenInNewTab}
            disabled={!blobUrl}
            className="h-7 px-2 text-xs border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 hover:border-gray-500"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">New Tab</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleFullscreen}
            className="h-7 px-2 text-xs border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 hover:border-gray-500"
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Full'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={!blobUrl}
            className="h-7 px-2 text-xs border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 hover:border-gray-500"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Download</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-7 px-3 text-xs border-red-800 text-red-400 hover:text-white hover:bg-red-700 hover:border-red-600"
          >
            <X className="h-3 w-3" />
            Close
          </Button>
        </div>
      </div>

      {/* iframe content — positioned below toolbar */}
      {!isFullscreen && (
        <div
          className="fixed left-4 right-4 bottom-4 bg-white rounded-b-lg overflow-hidden z-[55]"
          style={{ top: TOOLBAR_HEIGHT + 8 }}
        >
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-3" />
                <p>Loading preview...</p>
              </div>
            </div>
          )}
          {!loading && blobUrl && (
            <iframe
              src={blobUrl}
              sandbox="allow-scripts allow-popups allow-downloads"
              className="w-full h-full border-0"
              title={file.name}
            />
          )}
          {!loading && !blobUrl && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <p>{error || 'Unable to load HTML preview'}</p>
                <p className="text-sm mt-2 break-all">{file.path}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen iframe */}
      {isFullscreen && (
        <div
          className="fixed left-0 right-0 bottom-0 bg-white overflow-hidden z-[55]"
          style={{ top: TOOLBAR_HEIGHT }}
        >
          {blobUrl && (
            <iframe
              src={blobUrl}
              sandbox="allow-scripts allow-popups allow-downloads"
              className="w-full h-full border-0"
              title={file.name}
            />
          )}
        </div>
      )}

      {/* Confirmation dialog for opening HTML in a new tab */}
      <ConfirmDialog
        isOpen={showOpenConfirm}
        title="Open HTML in New Tab"
        message="Opening in a new tab removes the iframe sandbox protection. The HTML content will run with full browser permissions, which may include scripts from the file. Only proceed if you trust this file."
        confirmLabel="Open"
        cancelLabel="Cancel"
        type="warning"
        onConfirm={handleConfirmOpenInNewTab}
        onCancel={() => setShowOpenConfirm(false)}
      />
    </>
  );
}

export default HtmlPreview;
