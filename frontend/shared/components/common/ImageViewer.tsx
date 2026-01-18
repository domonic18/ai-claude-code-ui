import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/shared/components/ui/Button';
import { X } from 'lucide-react';
import { authenticatedFetch } from '@/shared/services';

export interface ImageViewerFile {
  name: string;
  path: string;
  projectName: string;
}

export interface ImageViewerProps {
  file: ImageViewerFile;
  onClose: () => void;
}

function ImageViewer({ file, onClose }: ImageViewerProps) {
  const imagePath = `/api/projects/${file.projectName}/files/content?path=${encodeURIComponent(file.path)}`;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const objectUrlRef = useRef<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(null);
        setImageUrl(null);

        controllerRef.current = new AbortController();

        const response = await authenticatedFetch(imagePath, {
          signal: controllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const blob = await response.blob();
        objectUrlRef.current = URL.createObjectURL(blob);
        setImageUrl(objectUrlRef.current);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        console.error('Error loading image:', err);
        setError('Unable to load image');
      } finally {
        setLoading(false);
      }
    };

    loadImage();

    return () => {
      controllerRef.current?.abort();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [imagePath]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {file.name}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 flex justify-center items-center bg-gray-50 dark:bg-gray-900 min-h-[400px]">
          {loading && (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p>Loading image…</p>
            </div>
          )}
          {!loading && imageUrl && (
            <img
              src={imageUrl}
              alt={file.name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
            />
          )}
          {!loading && !imageUrl && (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p>{error || 'Unable to load image'}</p>
              <p className="text-sm mt-2 break-all">{file.path}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 dark:bg-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {file.path}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ImageViewer;
