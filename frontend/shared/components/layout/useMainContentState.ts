/*
 * useMainContentState.ts - Combined hook for managing main content state
 */

import { useEditorResize } from './useEditorResize';
import { useFileEditor } from './useFileEditor';

export function useMainContentState(isMobile: boolean) {
  const resizeState = useEditorResize(isMobile);
  const fileEditorState = useFileEditor();

  return {
    ...resizeState,
    ...fileEditorState
  };
}
