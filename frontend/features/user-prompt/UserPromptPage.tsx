/**
 * UserPromptPage.tsx
 *
 * 用户提示词管理页面
 * 允许用户编辑和保存用户提示词文件
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import { userPromptService } from '@/shared/services/userPromptService';
import { logger } from '@/shared/utils/logger';

interface UserPromptData {
  content: string;
  path: string;
}

/**
 * 用户提示词编辑器属性
 */
interface UserPromptEditorProps {
  content: string;
  isLoading: boolean;
  isSaving: boolean;
  onSave: () => void;
  onChange: (value: string) => void;
}

/**
 * 用户提示词内容编辑器：渲染 textarea + 保存按钮，支持加载/保存中状态
 */
function UserPromptEditor({ content, isLoading, isSaving, onSave, onChange }: UserPromptEditorProps) {
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
        id="user-prompt-editor"
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-[60vh] min-h-[400px] p-4 font-mono text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
        placeholder={t('userPrompt.placeholder')}
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
              {t('userPrompt.saving')}
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              {t('userPrompt.save')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * 页面头部属性
 */
interface UserPromptPageHeaderProps {
  saveSuccess: boolean;
  t: (key: string) => string;
}

/**
 * 用户提示词页面头部：返回按钮、标题、保存成功指示器
 */
function UserPromptPageHeader({ saveSuccess, t }: UserPromptPageHeaderProps) {
  return (
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
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-semibold">{t('userPrompt.title')}</h1>
          </div>

          {/* Success indicator */}
          {saveSuccess && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">{t('userPrompt.saved')}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * 错误提示属性
 */
interface ErrorMessageProps {
  error: string | null;
}

/**
 * 错误提示横幅：error 为空时不渲染
 */
function ErrorMessage({ error }: ErrorMessageProps) {
  if (!error) return null;
  return (
    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
    </div>
  );
}

// 由父组件调用，React 组件或常量：UserPromptPage
/**
 * 用户提示词页面组件
 */
export function UserPromptPage() {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载用户提示词文件
  const loadUserPrompt = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data: UserPromptData = await userPromptService.readUserPrompt();
      setContent(data.content);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load user prompt';
      setError(errorMessage);
      logger.error('[UserPromptPage] Error loading user prompt:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 保存用户提示词文件
  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      setError(null);
      await userPromptService.writeUserPrompt(content);
      setIsSaving(false);
      setSaveSuccess(true);

      // 3秒后隐藏成功提示
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save user prompt';
      setError(errorMessage);
      setIsSaving(false);
      logger.error('[UserPromptPage] Error saving user prompt:', err);
    }
  }, [content]);

  // 组件加载时获取用户提示词
  useEffect(() => {
    loadUserPrompt();
  }, [loadUserPrompt]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <UserPromptPageHeader saveSuccess={saveSuccess} t={t} />

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Error message */}
        <ErrorMessage error={error} />

        {/* Editor */}
        <UserPromptEditor
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

export default UserPromptPage;
