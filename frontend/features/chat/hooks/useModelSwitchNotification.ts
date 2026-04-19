import { useState, useEffect, useRef } from 'react';

interface ModelSwitchNotification {
  show: boolean;
  message: string;
}

export function useModelSwitchNotification() {
  const [notification, setNotification] = useState<ModelSwitchNotification>({ show: false, message: '' });
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleModelSwitch = (event: CustomEvent) => {
      const { newModel, reason } = event.detail;
      if (reason === 'image-attachment') {
        setNotification({ show: true, message: `当前模型不支持图片，已切换到 ${newModel}` });
        timeoutRef.current = window.setTimeout(() => {
          setNotification({ show: false, message: '' });
          timeoutRef.current = null;
        }, 3000);
      }
    };

    window.addEventListener('model-switch', handleModelSwitch as EventListener);
    return () => {
      window.removeEventListener('model-switch', handleModelSwitch as EventListener);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return notification;
}
