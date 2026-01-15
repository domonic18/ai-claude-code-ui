/**
 * Error Handler Utility
 *
 * Provides centralized error handling for the application including:
 * - Custom error classes
 * - Error logging with context
 * - Error categorization
 */

/**
 * Application error with context information
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Network error for API/fetch failures
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    public statusCode?: number,
    context?: Record<string, any>
  ) {
    super(message, 'NETWORK_ERROR', context);
    this.name = 'NetworkError';
  }
}

/**
 * Validation error for invalid input
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public field?: string,
    context?: Record<string, any>
  ) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

/**
 * Handle error with logging and optional user notification
 *
 * @param error - The error to handle
 * @param context - Context where the error occurred
 * @param showToast - Whether to show a toast notification (optional)
 */
export function handleError(
  error: unknown,
  context: string,
  showToast?: (message: string) => void
): void {
  let errorMessage = 'An unexpected error occurred';
  let errorCode = 'UNKNOWN_ERROR';

  if (error instanceof AppError) {
    console.error(`[${context}] ${error.code}:`, error.message, error.context);
    errorMessage = error.message;
    errorCode = error.code;
  } else if (error instanceof Error) {
    console.error(`[${context}]:`, error.message, error.stack);
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    console.error(`[${context}]:`, error);
    errorMessage = error;
  } else {
    console.error(`[${context}]:`, error);
  }

  // Show toast notification if callback provided
  if (showToast) {
    showToast(errorMessage);
  }

  // TODO: Send to error tracking service (e.g., Sentry)
  // reportErrorToService(error, context, errorCode);
}

/**
 * Safely execute a function with error handling
 *
 * @param fn - Function to execute
 * @param context - Context for error logging
 * @param fallback - Fallback value if function fails
 * @returns Result of function or fallback value
 */
export function safeExecute<T>(
  fn: () => T,
  context: string,
  fallback?: T
): T | undefined {
  try {
    return fn();
  } catch (error) {
    handleError(error, context);
    return fallback;
  }
}

/**
 * Safely execute an async function with error handling
 *
 * @param fn - Async function to execute
 * @param context - Context for error logging
 * @param fallback - Fallback value if function fails
 * @returns Result of function or fallback value
 */
export async function safeExecuteAsync<T>(
  fn: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    return fallback;
  }
}
