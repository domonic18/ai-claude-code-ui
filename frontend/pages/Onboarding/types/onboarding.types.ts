/**
 * Onboarding Module Types
 *
 * Type definitions for user onboarding flow.
 */

/**
 * Onboarding step enum
 */
export type OnboardingStep = 0 | 1 | 2;

/**
 * Onboarding state
 */
export interface OnboardingState {
  currentStep: OnboardingStep;
  gitName: string;
  gitEmail: string;
  isSubmitting: boolean;
  error: string;
}

/**
 * Git configuration
 */
export interface GitConfig {
  name: string;
  email: string;
}

/**
 * Agent authentication status
 */
export interface AgentAuthStatus {
  authenticated: boolean;
  email: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Agent type enum
 */
export type AgentType = 'claude' | 'cursor' | 'codex';

/**
 * Agent configuration
 */
export interface AgentConfig {
  type: AgentType;
  name: string;
  logo: React.ComponentType<{ size?: number }>;
  authStatus: AgentAuthStatus;
  loginAction: () => void;
}

/**
 * Onboarding page props
 */
export interface OnboardingPageProps {
  onComplete?: () => void;
  onCancel?: () => void;
  initialStep?: OnboardingStep;
}

/**
 * Onboarding step data
 */
export interface OnboardingStepData {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  required: boolean;
}

/**
 * Onboarding progress
 */
export interface OnboardingProgress {
  currentStep: OnboardingStep;
  totalSteps: number;
  completedSteps: OnboardingStep[];
  isStepValid: (step: OnboardingStep) => boolean;
}

/**
 * Active login provider state
 */
export type ActiveLoginProvider = AgentType | null;
