/**
 * Error Handling Utilities
 * 
 * Provides consistent error handling patterns for TanStack Router loaders
 * and Supabase operations across the application.
 */

import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Handles a Supabase query error in a loader context.
 * Logs the error and returns a safe fallback value.
 *
 * Usage in a loader:
 *   const { data, error } = await supabase.from('contacts').select('*');
 *   if (error) return handleLoaderError('contacts', error, []);
 */
export function handleLoaderError<T>(
  context: string,
  error: PostgrestError | Error | unknown,
  fallback: T,
): T {
  const message = error instanceof Error
    ? error.message
    : (error as PostgrestError)?.message || 'Unknown error';

  console.error(`[Loader:${context}] ${message}`, error);
  return fallback;
}

/**
 * Handles a Supabase mutation error (insert/update/delete).
 * Logs the error and optionally calls an onError callback.
 */
export function handleMutationError(
  context: string,
  error: PostgrestError | Error | unknown,
  onError?: (message: string) => void,
): void {
  const message = error instanceof Error
    ? error.message
    : (error as PostgrestError)?.message || 'Unknown error';

  console.error(`[Mutation:${context}] ${message}`, error);

  if (onError) {
    onError(message);
  }
}
