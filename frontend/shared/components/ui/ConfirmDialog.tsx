/**
 * ConfirmDialog Component
 *
 * A reusable confirmation dialog component for destructive actions.
 * Provides an asynchronous alternative to window.confirm().
 *
 * ## Features
 * - Non-blocking, async confirmation
 * - Customizable title, message, and button labels
 * - Loading state support for async operations
 * - Consistent styling with the project theme
 * - Full accessibility support (keyboard, ARIA, focus management)
 *
 * ## Usage Example
 * ```tsx
 * const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
 *
 * const handleDelete = async () => {
 *   setShowDeleteConfirm(true);
 * };
 *
 * const handleConfirmDelete = async () => {
 *   // Perform delete operation
 *   await deleteSession();
 *   setShowDeleteConfirm(false);
 * };
 *
 * return (
 *   <>
 *     <button onClick={handleDelete}>Delete</button>
 *     <ConfirmDialog
 *       isOpen={showDeleteConfirm}
 *       title="Delete Session"
 *       message="Are you sure you want to delete this session? This action cannot be undone."
 *       confirmLabel="Delete"
 *       cancelLabel="Cancel"
 *       type="danger"
 *       onConfirm={handleConfirmDelete}
 *       onCancel={() => setShowDeleteConfirm(false)}
 *     />
 *   </>
 * );
 * ```
 */

import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import { cn } from '@/lib/utils';

/**
 * Dialog type variants
 */
export type DialogType = 'danger' | 'warning' | 'info';

/**
 * ConfirmDialog Props
 */
export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message/description */
  message: string;
  /** Label for the confirm button (default: 'Confirm') */
  confirmLabel?: string;
  /** Label for the cancel button (default: 'Cancel') */
  cancelLabel?: string;
  /** Label for the loading state (default: 'Processing...') */
  loadingLabel?: string;
  /** Dialog type - affects button styling (default: 'danger') */
  type?: DialogType;
  /** Whether the confirm action is in progress */
  isLoading?: boolean;
  /** Callback when confirm is clicked */
  onConfirm: () => void | Promise<void>;
  /** Callback when cancel is clicked */
  onCancel: () => void;
}

/** Button variant mapping for dialog types */
const BUTTON_VARIANTS: Record<DialogType, 'destructive' | 'default' | 'secondary'> = {
  danger: 'destructive',
  warning: 'default',
  info: 'secondary',
};

/** Icon styles for each dialog type */
const ICON_STYLES = {
  danger: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
  warning: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30',
  info: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
} as const;

/** SVG icon paths for each dialog type */
const ICON_PATHS = {
  danger: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  warning: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
} as const;

/**
 * DialogBody Component
 *
 * Renders the main content of the confirmation dialog.
 *
 * @param props - DialogBody props
 */
function DialogBody({
  type,
  title,
  message,
  confirmLabel,
  cancelLabel,
  loadingLabel,
  isLoading,
  onConfirm,
  onCancel,
  confirmButtonRef,
}: Omit<ConfirmDialogProps, 'isOpen'> & { confirmButtonRef: React.RefObject<HTMLButtonElement> }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isLoading ? undefined : onCancel}
        aria-label="Close dialog"
        disabled={isLoading}
        tabIndex={-1}
      />

      {/* Dialog Content */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4 p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        {/* Icon and Title */}
        <div className="flex items-start gap-4">
          <div className={cn('flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center', ICON_STYLES[type])}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICON_PATHS[type]} />
            </svg>
          </div>

          <div className="flex-1">
            <h3 id="dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            <p id="dialog-description" className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {message}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={BUTTON_VARIANTS[type]}
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {isLoading ? loadingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Custom hook for dialog side effects
 * Handles focus management, escape key, and body scroll prevention
 */
function useDialogEffects(isOpen: boolean, isLoading: boolean, onCancel: () => void, confirmButtonRef: React.RefObject<HTMLButtonElement>) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // Focus management: save and restore focus
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
      confirmButtonRef.current?.focus();
    } else {
      previousActiveElementRef.current?.focus();
    }
  }, [isOpen, confirmButtonRef]);

  // Close on escape key and prevent body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, isLoading, onCancel]);
}

/**
 * ConfirmDialog Component
 *
 * @param props - ConfirmDialog props
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loadingLabel = 'Processing...',
  type = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleConfirm = useCallback(async () => {
    await onConfirm();
  }, [onConfirm]);

  useDialogEffects(isOpen, isLoading, onCancel, confirmButtonRef);

  if (!isOpen) return null;

  return createPortal(
    <DialogBody
      type={type}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      loadingLabel={loadingLabel}
      isLoading={isLoading}
      onConfirm={handleConfirm}
      onCancel={onCancel}
      confirmButtonRef={confirmButtonRef}
    />,
    document.body
  );
}

export default ConfirmDialog;
