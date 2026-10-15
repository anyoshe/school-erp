/**
 * Normalize DRF (and similar) list payloads to a real array.
 * Handles: bare arrays, { results }, { data }, { items }.
 * Never throws — returns [] for unexpected shapes.
 */
export function asList<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.results)) return obj.results as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }
  return [];
}

/**
 * True when payload looks like a list envelope (DRF pagination or similar).
 * Intentionally does not require count/next — some endpoints only return { results }.
 */
export function isPaginatedList(data: unknown): data is { results: unknown[] } {
  return (
    !!data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    Array.isArray((data as { results?: unknown }).results)
  );
}
