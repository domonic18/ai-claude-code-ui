/**
 * useMemoryEditor - Custom hook for memory CRUD operations
 *
 * @module features/memory/useMemoryEditor
 */

import { useState, useEffect, useCallback } from 'react';
import { authenticatedFetch } from '@/shared/services';

// 由组件调用，自定义 Hook：useMemoryEditor
/**
 * 记忆编辑器 Hook：管理长期记忆的加载、编辑和保存
 * @returns {{memoryContent: string, setMemoryContent: function, loading: boolean, saving: boolean, saveMemory: function}}
 */
export function useMemoryEditor() {
  const [memoryContent, setMemoryContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadMemory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/memory');
      if (!response.ok) throw new Error('Failed to load memory');
      const result = await response.json();
      setMemoryContent(result.data?.content || result.content || '');
    } catch (error) {
      console.error('Error loading memory:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveMemory = useCallback(async (content) => {
    try {
      setSaving(true);
      const response = await authenticatedFetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error('Failed to save memory');
      const result = await response.json();
      alert(result.data?.message || result.message || '保存成功');
    } catch (error) {
      console.error('Error saving memory:', error);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => { loadMemory(); }, [loadMemory]);

  return { memoryContent, setMemoryContent, loading, saving, saveMemory };
}
