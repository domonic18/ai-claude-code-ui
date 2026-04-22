// 模型切换通知 hook：监听 model-switch 自定义事件，在图片附件场景下自动降级模型时提示用户
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
      // 仅在图片附件触发降级时通知，其他切换原因静默处理
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
