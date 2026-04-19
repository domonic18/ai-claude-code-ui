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

  useEffect(() => {
    const provider = localStorage.getItem('selected-provider') || 'claude';
    if (selectedSession?.__provider && selectedSession.__provider !== provider) {
      localStorage.setItem('selected-provider', selectedSession.__provider);
    }
  }, [selectedSession]);
}
