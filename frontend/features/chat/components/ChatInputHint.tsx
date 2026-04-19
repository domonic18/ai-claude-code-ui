/**
 * ChatInputHint Component
 *
 * Displays hint text at the bottom of the chat input
 * showing keyboard shortcuts for sending messages and commands.
 */

import { useTranslation } from 'react-i18next';

interface ChatInputHintProps {
  /** Send by Ctrl+Enter */
  sendByCtrlEnter?: boolean;
  /** Has selected project */
  hasProject?: boolean;
}

export function ChatInputHint({ sendByCtrlEnter = false, hasProject = false }: ChatInputHintProps) {
  const { t } = useTranslation();

  return (
    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {sendByCtrlEnter ? (
        <>{t('chat.pressCtrlEnter')} <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+Enter</kbd> {t('chat.toSend')}</>
      ) : (
        <>{t('chat.pressEnter')} <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> {t('chat.toSend')}, <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Shift+Enter</kbd> {t('chat.forNewLine')}</>
      )}
      {hasProject && !sendByCtrlEnter && (
        <span>, {t('chat.typeForCommands')} <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">/</kbd> {t('chat.forCommands')} {t('chat.or')} <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">@</kbd> {t('chat.forFiles')}</span>
      )}
    </div>
  );
}
