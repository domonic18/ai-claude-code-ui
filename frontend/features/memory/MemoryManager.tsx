/**
 * MemoryManager.tsx
 *
 * 记忆管理器组件 - 长期记忆管理
 *
 * @module features/memory/MemoryManager
 */

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { authenticatedFetch } from '@/shared/services';

export function MemoryManager() {
  const [memoryContent, setMemoryContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 加载长期记忆
  useEffect(() => {
    loadMemory();
  }, []);

  // 加载长期记忆
  const loadMemory = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/memory');
      if (!response.ok) throw new Error('Failed to load memory');
      const result = await response.json();
      // 后端返回格式: { success: true, data: { content: "" } }
      setMemoryContent(result.data?.content || result.content || '');
    } catch (error) {
      console.error('Error loading memory:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存长期记忆
  const saveMemory = async () => {
    try {
      setSaving(true);
      const response = await authenticatedFetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: memoryContent })
      });
      if (!response.ok) throw new Error('Failed to save memory');
      const result = await response.json();
      // 后端返回格式: { success: true, data: { message: "" } }
      alert(result.data?.message || result.message || '保存成功');
    } catch (error) {
      console.error('Error saving memory:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">记忆管理</h1>
          <p className="text-muted-foreground">管理您的长期记忆</p>
        </div>
      </div>

      {/* 长期记忆内容 */}
      <div className="space-y-4 border border-border rounded-lg p-4 bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">长期记忆</h2>
            <p className="text-sm text-muted-foreground">
              审查风格和常见问题答复规则
            </p>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            加载中...
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              value={memoryContent}
              onChange={(e) => setMemoryContent(e.target.value)}
              placeholder="在此输入您的长期记忆..."
              className="w-full min-h-[400px] p-3 text-sm font-mono border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={saveMemory}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-2 inline" />
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 说明 */}
      <div className="border border-border rounded-lg p-4 bg-card">
        <h3 className="text-sm font-semibold text-foreground mb-2">说明</h3>
        <p className="text-sm text-muted-foreground">
          长期记忆将作为 AI 对话的上下文使用，帮助 AI 记住您的偏好和工作习惯。
          会话结束后，系统会自动分析对话内容并智能更新长期记忆。
        </p>
      </div>
    </div>
  );
}
