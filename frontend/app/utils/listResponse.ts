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

/** True when payload looks like a DRF PageNumberPagination response. */
export function isPaginatedList(data: unknown): data is {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: unknown[];
} {
  return (
    !!data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    Array.isArray((data as { results?: unknown }).results) &&
    ("count" in (data as object) ||
      "next" in (data as object) ||
      "previous" in (data as object))
  );
}
