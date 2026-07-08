/**
 * useProjectPrompt Hook
 *
 * 管理项目级提示词（.project-prompt.md）的加载与保存。
 * - projectName 变化时自动加载；
 * - 会话结束（claude-complete）时刷新，同步 AI 对该文件的直接编辑；
 *   但用户有未保存编辑时跳过刷新，避免覆盖输入（Observer 回调用 ref 中转）。
 *
 * 仿 memoryService 范式（走 api.projectPrompt，PUT 保存），不复用已删除的 useMemoryEditor。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/shared/services/api';
import { onConversationComplete } from '../services/documentEvents';
import { logger } from '@/shared/utils/logger';

interface UseProjectPromptReturn {
  /** 当前编辑区内容 */
  content: string;
  setContent: (c: string) => void;
  /** 上次保存的内容（取消编辑时用于恢复） */
  savedContent: string;
  loading: boolean;
  saving: boolean;
  /** 丢弃当前编辑，恢复到已保存内容 */
  reset: () => void;
  /** 保存到后端 */
  save: () => Promise<void>;
}

/**
 * 项目提示词 Hook
 * @param projectName - 当前项目名称（为 null 时不加载）
 */
export function useProjectPrompt(projectName: string | null): UseProjectPromptReturn {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 是否有未保存的编辑：Observer(onConversationComplete) 回调通过 ref 读取，
  // 避免回调闭包捕获旧值；用户正在编辑时跳过自动刷新，防止覆盖输入。
  const isDirtyRef = useRef(false);
  useEffect(() => {
    isDirtyRef.current = content !== savedContent;
  }, [content, savedContent]);

  // 加载请求序号：每次 loadPrompt 自增，响应回来时若已非最新则丢弃，
  // 避免快速切项目 / 会话结束刷新时，旧请求的响应覆盖新请求的结果（竞态）。
  const loadIdRef = useRef(0);

  const loadPrompt = useCallback(async (name: string) => {
    const myId = ++loadIdRef.current;
    setLoading(true);
    try {
      const res = await api.projectPrompt.read(name);
      const result = await res.json();
      if (myId !== loadIdRef.current) return; // 已有更新的加载请求，丢弃本次响应
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to read project prompt');
      }
      const c = result.data.content ?? '';
      setContent(c);
      setSavedContent(c);
    } catch (err) {
      if (myId !== loadIdRef.current) return; // 过期请求，不处理错误、不 setState
      logger.error({ err, projectName: name }, 'Failed to load project prompt');
      setContent('');
      setSavedContent('');
    } finally {
      if (myId === loadIdRef.current) setLoading(false); // 仅最新请求负责复位 loading
    }
  }, []);

  // projectName 变化时加载（进入项目 / 切项目）
  useEffect(() => {
    if (!projectName) {
      setContent('');
      setSavedContent('');
      return;
    }
    loadPrompt(projectName);
  }, [projectName, loadPrompt]);

  // 会话结束时刷新：兜底同步 AI 用 Edit 直接修改的 .project-prompt.md。
  // claude-complete 为全局消息；用户有未保存编辑时跳过，避免覆盖。
  useEffect(() => {
    const unsubscribe = onConversationComplete(() => {
      if (projectName && !isDirtyRef.current) {
        loadPrompt(projectName);
      }
    });
    return unsubscribe;
  }, [projectName, loadPrompt]);

  const reset = useCallback(() => {
    setContent(savedContent);
  }, [savedContent]);

  const save = useCallback(async () => {
    if (!projectName) return;
    setSaving(true);
    try {
      const res = await api.projectPrompt.write(projectName, content);
      const result = await res.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to save project prompt');
      }
      setSavedContent(content);
    } catch (err) {
      logger.error({ err, projectName }, 'Failed to save project prompt');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [projectName, content]);

  return { content, setContent, savedContent, loading, saving, reset, save };
}

export default useProjectPrompt;
