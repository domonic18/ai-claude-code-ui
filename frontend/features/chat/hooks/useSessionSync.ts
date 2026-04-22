// 会话选择同步 hook：将 sidebar 的会话选择同步到聊天状态，切换时清理草稿输入
import { useEffect, useRef } from 'react';
import { STORAGE_KEYS } from '../constants';

export function useSessionSync({
  selectedSession,
  selectedProject,
  currentSessionId,
  setCurrentSessionId,
  setMessages,
}: {
  selectedSession?: { id: string; __provider?: string };
  selectedProject?: { name: string; path: string };
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  setMessages: (msgs: any[]) => void;
}) {
  const prevSelectedSessionIdRef = useRef<string | undefined>(selectedSession?.id);

  // 新选会话时同步 ID 并清除残留草稿；取消选择时清空消息列表
  useEffect(() => {
    const prevId = prevSelectedSessionIdRef.current;
    const newId = selectedSession?.id;
    prevSelectedSessionIdRef.current = newId;

    if (newId) {
      if (currentSessionId !== newId) {
        setCurrentSessionId(newId);
        if (selectedProject?.name) {
          localStorage.removeItem(STORAGE_KEYS.DRAFT_INPUT(selectedProject.name));
        }
      }
    } else if (prevId !== undefined && newId === undefined) {
      setCurrentSessionId(null);
      setMessages([]);
      if (selectedProject?.name) {
        localStorage.removeItem(STORAGE_KEYS.DRAFT_INPUT(selectedProject.name));
      }
    }
  }, [selectedSession?.id, setMessages, currentSessionId, selectedProject?.name]);

  // 同步会话关联的 provider 到 localStorage，确保下次打开使用正确的 AI 后端
  useEffect(() => {
    const provider = localStorage.getItem('selected-provider') || 'claude';
    if (selectedSession?.__provider && selectedSession.__provider !== provider) {
      localStorage.setItem('selected-provider', selectedSession.__provider);
    }
  }, [selectedSession]);
}
