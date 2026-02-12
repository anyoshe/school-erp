// // app/hooks/useCurrentUser.ts
// "use client";

// import { useEffect, useState } from "react";
// import { getCurrentUser } from "@/utils/api";

// export interface CurrentUser {
//   id: string;
//   email: string;
//   role: string;
// }

// export function useCurrentUser() {
//   const [user, setUser] = useState<CurrentUser | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     getCurrentUser()
//       .then(setUser)
//       .catch(() => setUser(null))
//       .finally(() => setLoading(false));
//   }, []);

//   return { user, loading };
// }

// app/hooks/useCurrentUser.ts
"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "@/utils/api";

export interface CurrentUser {
  id: string;
  email: string;
  role: string;           // the code e.g. "ADMISSIONS_OFFICER"
  role_display?: string;  // the nice name e.g. "Admissions Officer / Registrar"
  full_name: string;
  schools: Array<{
    id: string;
    name: string;
    // ... other fields you need
  }>;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    getCurrentUser(true) // force fresh on mount — avoids stale role data
      .then((data) => {
        if (isMounted) {
          setUser(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load current user:", err);
          setError("Failed to load user information");
          setUser(null);
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { user, loading, error };
}