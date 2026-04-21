/**
 * tourApi.ts
 *
 * Backend API calls for product tour status
 * Extracted from useProductTour to reduce complexity
 */

const BACKEND_TIMEOUT = 5000;

/**
 * Check tour completion status from backend API.
 * Uses credentials: 'include' to send HttpOnly cookie for authentication.
 */
export async function fetchTourStatusFromBackend(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), BACKEND_TIMEOUT);

    const response = await fetch('/api/users/onboarding-status', {
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const data = await response.json();
    return data?.data?.hasCompletedOnboarding === true;
  } catch {
    return false;
  }
}

/**
 * Mark tour as completed on backend.
 * Uses credentials: 'include' to send HttpOnly cookie for authentication.
 */
export async function markTourCompletedOnBackend(): Promise<void> {
  try {
    await fetch('/api/users/complete-onboarding', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Silently fail - localStorage is the fallback
  }
}
