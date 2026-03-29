"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseRetryOptions {
  /** Maximum number of retry attempts. Default: 3 */
  maxRetries?: number;
  /** Base delay in milliseconds for exponential backoff. Default: 1000 */
  baseDelay?: number;
  /** Maximum delay cap in milliseconds. Default: 10000 */
  maxDelay?: number;
}

interface UseRetryReturn<T> {
  /** Execute the async function with retry support */
  execute: () => Promise<T | undefined>;
  /** Current loading state */
  loading: boolean;
  /** Last error encountered */
  error: string;
  /** Number of retries attempted so far */
  retryCount: number;
  /** Manually trigger a retry */
  retry: () => Promise<T | undefined>;
  /** Reset error and retry state */
  reset: () => void;
}

/**
 * Hook for retryable async operations with exponential backoff.
 *
 * @param asyncFn - The async function to execute
 * @param options - Retry configuration
 */
export function useRetry<T>(
  asyncFn: () => Promise<T>,
  options: UseRetryOptions = {},
): UseRetryReturn<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10_000 } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  // Keep asyncFn stable across renders via ref
  const asyncFnRef = useRef(asyncFn);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    asyncFnRef.current = asyncFn;
  }, [asyncFn]);

  const isCurrentRequest = useCallback(
    (requestId: number) => mountedRef.current && requestIdRef.current === requestId,
    [],
  );

  const execute = useCallback(async (): Promise<T | undefined> => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    setRetryCount(0);

    let lastError = "";

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (!isCurrentRequest(requestId)) return undefined;

      try {
        const result = await asyncFnRef.current();
        if (!isCurrentRequest(requestId)) return undefined;

        setLoading(false);
        setError("");
        return result;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : "An unexpected error occurred.";

        if (attempt < maxRetries) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (isCurrentRequest(requestId)) {
            setRetryCount(attempt + 1);
          }
        }
      }
    }

    if (isCurrentRequest(requestId)) {
      setError(lastError);
      setLoading(false);
    }

    return undefined;
  }, [maxRetries, baseDelay, maxDelay, isCurrentRequest]);

  const retry = useCallback(() => execute(), [execute]);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setLoading(false);
    setError("");
    setRetryCount(0);
  }, []);

  return { execute, loading, error, retryCount, retry, reset };
}
