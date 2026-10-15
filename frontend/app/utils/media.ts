const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/** Origin of the API host (strip trailing /api) */
function apiOrigin(): string {
  try {
    const u = new URL(API_BASE);
    // e.g. http://localhost:8000/api → http://localhost:8000
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:8000";
  }
}

/**
 * Resolve a media path from the API to a browser-loadable URL.
 * Handles absolute URLs and relative /media/... paths.
 */
export function resolveMediaUrl(
  path: string | null | undefined
): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }
  const origin = apiOrigin();
  if (path.startsWith("/")) return `${origin}${path}`;
  return `${origin}/${path}`;
}
