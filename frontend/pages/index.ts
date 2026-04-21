/**
 * Pages Module
 *
 * Exports all page-level components.
 */

export { default as ErrorPage } from './ErrorPage';
export type { ErrorPageProps } from './ErrorPage';

export { default as NotFoundPage } from './NotFoundPage';
export type { NotFoundPageProps } from './NotFoundPage';

export { default as LoadingPage } from './LoadingPage';
export type { LoadingPageProps } from './LoadingPage';

// New pages
export { Homepage } from './homepage';
export { ChatPage } from './chat';
export { SettingsPage } from './settings';
export { AdminPage } from './admin';

// Feature pages
export { MemoryPage } from '../features/memory';
