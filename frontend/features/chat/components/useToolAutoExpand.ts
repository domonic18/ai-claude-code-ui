/**
 * useToolAutoExpand Hook
 *
 * Custom hook for auto-expanding tools on scroll into view.
 *
 * @module features/chat/components/useToolAutoExpand
 */

import { useState, useEffect } from 'react';

/**
 * Custom hook for auto-expanding tools on scroll into view
 *
 * @param messageRef - Reference to the message element
 * @param isToolUse - Whether the message is a tool use
 * @param autoExpandTools - Whether auto-expand is enabled
 * @returns Whether the tool has been expanded
 */
export function useToolAutoExpand(
  messageRef: React.RefObject<HTMLDivElement>,
  isToolUse: boolean,
  autoExpandTools: boolean
) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!autoExpandTools || !messageRef.current || !isToolUse) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isExpanded) {
            setIsExpanded(true);
            const details = messageRef.current?.querySelectorAll('details');
            details?.forEach(detail => {
              detail.open = true;
            });
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(messageRef.current);

    return () => {
      if (messageRef.current) {
        observer.unobserve(messageRef.current);
      }
    };
  }, [autoExpandTools, isExpanded, isToolUse, messageRef]);

  return isExpanded;
}
