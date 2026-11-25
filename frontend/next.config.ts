import type { NextConfig } from "next";
import path from "path";

/**
 * Force the workspace root to this frontend app.
 * Parent folders (repo root / Desktop) must not own package resolution —
 * that breaks Tailwind (`Can't resolve 'tailwindcss' in '.../school-erp'`).
 */
const nextConfig: NextConfig = {
  // Next 16+ / Turbopack
  turbopack: {
    root: path.join(__dirname),
  },
  // Keep file tracing inside frontend as well
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
