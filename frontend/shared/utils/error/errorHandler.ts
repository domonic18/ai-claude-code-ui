/**
 * Error Handler Utility
 *
 * Provides centralized error handling for the application.
 * Migrated from frontend/utils/errorHandler.ts
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

  if (showToast) {
    showToast(errorMessage);
  }
}

/**
 * Safely execute a function with error handling
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
