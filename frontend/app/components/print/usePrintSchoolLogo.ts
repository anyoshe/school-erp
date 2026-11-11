"use client";

import { useEffect, useState } from "react";
import { preparePrintLogo, resolveMediaUrl } from "@/utils/media";

/**
 * Shared rule for every printable document header:
 * enlarge + remove solid backgrounds (or pass through SVG).
 */
export function usePrintSchoolLogo(
  logo: string | null | undefined,
  deps: unknown[] = []
): string | null {
  const [src, setSrc] = useState<string | null>(() => resolveMediaUrl(logo) || null);

  useEffect(() => {
    let cancelled = false;
    const raw = logo || null;
    if (!raw) {
      setSrc(null);
      return;
    }
    // Show resolved URL immediately, then upgrade to cleaned version
    setSrc(resolveMediaUrl(raw) || (String(raw).startsWith("http") ? String(raw) : null));
    (async () => {
      const prepared = await preparePrintLogo(raw);
      if (!cancelled && prepared) setSrc(prepared);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo, ...deps]);

  return src;
}
