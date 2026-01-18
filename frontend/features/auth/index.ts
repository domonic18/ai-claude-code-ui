/**
 * Auth Module
 *
 * Authentication and authorization components for user management.
 * Organized following the standard feature module structure.
 *
 * @example
 * ```ts
 * // Import components
 * import { LoginForm, LoginModal, SetupForm } from '@/features/auth';
 *
 * // Import hooks
 * import { useAuth, useUserRole } from '@/features/auth/hooks';
 *
 * // Import types
 * import type { User, LoginCredentials, AuthResponse } from '@/features/auth/types';
 *
 * // Import services
 * import { getAuthService } from '@/features/auth/services';
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
