/**
 * MemoryPage.tsx
 *
 * 记忆管理页面
 * 允许用户编辑和保存长期记忆文件
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Brain, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { memoryService } from '@/shared/services/memoryService';
import { logger } from '@/shared/utils/logger';

interface MemoryData {
  content: string;
  path: string;
}

/**
 * Memory Editor Component
 *
 * Renders the textarea editor with save button for editing memory content.
 */
interface MemoryEditorProps {
  content: string;
  isLoading: boolean;
  isSaving: boolean;
  onSave: () => void;
  onChange: (value: string) => void;
}

function MemoryEditor({ content, isLoading, isSaving, onSave, onChange }: MemoryEditorProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <textarea
        id="memory-editor"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[60vh] min-h-[400px] p-4 font-mono text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
        placeholder={t('memory.placeholder')}
        spellCheck={false}
      />
      <div className="flex justify-end">
        <Button
          key={isSaving ? 'saving' : 'idle'}
          onClick={onSave}
          disabled={isSaving || isLoading}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2" />
              {t('memory.saving')}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {t('memory.save')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * 记忆页面组件
 */
export function MemoryPage() {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载记忆文件
  const loadMemory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data: MemoryData = await memoryService.readMemory();
      setContent(data.content);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load memory';
      setError(errorMessage);
      logger.error('[MemoryPage] Error loading memory:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 保存记忆文件
  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setError(null);
      await memoryService.writeMemory(content);
      setIsSaving(false);
      setSaveSuccess(true);

      // 3秒后隐藏成功提示
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save memory';
      setError(errorMessage);
      setIsSaving(false);
      logger.error('[MemoryPage] Error saving memory:', err);
    }
  }, [content]);

  // 组件加载时获取记忆
  useEffect(() => {
    loadMemory();
  }, [loadMemory]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Back button */}
            <Link
              to="/chat"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">{t('common.back') || 'Back'}</span>
            </Link>

            {/* Title */}
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-semibold">{t('memory.title')}</h1>
            </div>

            {/* Success indicator */}
            {saveSuccess && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">{t('memory.saved')}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Editor */}
        <MemoryEditor
          content={content}
          isLoading={isLoading}
          isSaving={isSaving}
          onSave={handleSave}
          onChange={setContent}
        />
      </main>
    </div>
  );
}

export default MemoryPage;
