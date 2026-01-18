/**
 * System Module
 *
 * System-level functionality including version management, updates, and PWA features.
 * Organized following the standard feature module structure.
 *
 * @example
 * ```ts
 * // Import components
 * import { VersionUpgradeModal } from '@/features/system';
 *
 * // Import hooks
 * import { useVersionUpgrade, usePWA } from '@/features/system/hooks';
 *
 * // Import types
 * import type { ReleaseInfo, PWAStatus } from '@/features/system/types';
 *
 * // Import services
 * import { getSystemService } from '@/features/system/services';
 * ```
 */

// Components
export * from './components/index';

// Hooks
export * from './hooks/index';

// Services
export * from './services/index';

// Types
export * from './types/index';

// Utilities
export * from './utils/index';
