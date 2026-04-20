/**
 * fileApiHelpers.ts
 *
 * API response handling utilities for file operations
 * Provides unified error handling and response processing
 */

/**
 * Handles API response validation and error extraction
 * @param response - Fetch API response object
 * @param errorMessage - Fallback error message if response doesn't contain specific error
 * @throws Error with extracted error message from response or fallback
 * @returns Promise that resolves if response is ok, rejects otherwise
 */
export async function handleApiResponse(response: Response, errorMessage: string): Promise<void> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || errorMessage);
  }
}

/**
 * Extracts error message from error object or unknown value
 * @param error - Error object or unknown value
 * @param fallback - Fallback message if error cannot be extracted
 * @returns Extracted error message string
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
