// app/providers.tsx    ← recommended name
// or lib/QueryProvider.tsx if you prefer

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"; // optional but very helpful
import { useState } from "react";


export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a new QueryClient instance per render (avoids sharing across requests in SSR)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Recommended defaults for Next.js apps
            staleTime: 1000 * 60, // 1 minute — adjust based on how fresh you need data
            gcTime: 1000 * 60 * 5, // 5 minutes garbage collection
            retry: 1, // fewer retries in dev
            refetchOnWindowFocus: false, // usually better UX in admin apps
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Optional: shows query inspector in dev mode */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}