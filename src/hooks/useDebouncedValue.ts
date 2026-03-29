"use client";

import { useEffect, useState } from "react";

/**
 * Returns a debounced version of the given value.
 * The returned value only updates after the specified delay
 * has elapsed since the last change, preventing excessive
 * re-renders during rapid input.
 *
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 300)
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
