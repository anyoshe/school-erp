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

/**
 * Load an image URL and return a PNG data-URL with near-solid / light
 * backgrounds made transparent so logos sit cleanly on receipts.
 * Best-effort; works well for white/off-white rectangular backgrounds.
 */
export async function stripLogoBackground(
  src: string,
  options?: { tolerance?: number; maxSize?: number }
): Promise<string | null> {
  if (typeof window === "undefined" || !src) return null;
  const tolerance = options?.tolerance ?? 42;
  const maxSize = options?.maxSize ?? 512;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width < 1 || height < 1) {
          resolve(null);
          return;
        }
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const d = imageData.data;

        // Sample corners + edge midpoints as background candidates
        const samples: Array<[number, number, number]> = [];
        const pick = (x: number, y: number) => {
          const i = (y * width + x) * 4;
          samples.push([d[i], d[i + 1], d[i + 2]]);
        };
        const xs = [0, Math.floor(width / 2), width - 1];
        const ys = [0, Math.floor(height / 2), height - 1];
        for (const x of xs) for (const y of ys) {
          if (x === Math.floor(width / 2) && y === Math.floor(height / 2)) continue;
          pick(x, y);
        }

        const near = (r: number, g: number, b: number, s: [number, number, number]) =>
          Math.abs(r - s[0]) <= tolerance &&
          Math.abs(g - s[1]) <= tolerance &&
          Math.abs(b - s[2]) <= tolerance;

        // Also treat very light pixels as background
        const isLight = (r: number, g: number, b: number) =>
          r >= 245 && g >= 245 && b >= 245;

        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          if (isLight(r, g, b) || samples.some((s) => near(r, g, b, s))) {
            d[i + 3] = 0;
          }
        }

        // Tight crop to non-transparent content
        let minX = width, minY = height, maxX = 0, maxY = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const a = d[(y * width + x) * 4 + 3];
            if (a > 10) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX <= minX || maxY <= minY) {
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL("image/png"));
          return;
        }
        const pad = 2;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(width - 1, maxX + pad);
        maxY = Math.min(height - 1, maxY + pad);
        const cw = maxX - minX + 1;
        const ch = maxY - minY + 1;
        const out = document.createElement("canvas");
        out.width = cw;
        out.height = ch;
        const octx = out.getContext("2d");
        if (!octx) {
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL("image/png"));
          return;
        }
        ctx.putImageData(imageData, 0, 0);
        octx.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
        resolve(out.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    // Cache-bust relative URLs so canvas can sometimes still work with CORS
    img.src = src.includes("?") ? src : `${src}${src.startsWith("data:") ? "" : ""}`;
  });
}
