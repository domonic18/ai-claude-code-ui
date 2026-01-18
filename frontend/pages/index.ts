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

export { default as OnboardingPage } from './Onboarding/OnboardingPage';

// New pages
export { Homepage } from './Homepage';
export { ChatPage } from './Chat';
export { SettingsPage } from './Settings';
