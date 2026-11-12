// // app/layout.tsx
// import type { Metadata } from "next";
// // import "./globals.css";
// import { Toaster } from "react-hot-toast";
// import { QueryProvider } from "./providers";

// export const metadata: Metadata = {
//   title: "School ERP",
//   description: "School ERP Dashboard",
// };

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   return (
//     <html lang="en">
//       <body className="antialiased">
//         <QueryProvider>
//         {children}
//         <Toaster position="top-center" />
//         </QueryProvider>
//       </body>
//     </html>
//   );
// }

// app/layout.tsx

import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "./providers";

// Add Sonner
import { Toaster } from "sonner";

export const metadata: Metadata = {
  metadataBase: new URL("https://getaxe.com"),
  title: {
    default: "GETAXE SCHOOL MANAGEMENT | GetAxe Technologies",
    template: "%s | GETAXE SCHOOL MANAGEMENT",
  },
  description: "GETAXE SCHOOL MANAGEMENT brings academic, student, finance and learning workflows together for primary, junior secondary and senior secondary schools.",
  applicationName: "GETAXE SCHOOL MANAGEMENT",
  openGraph: {
    title: "GETAXE SCHOOL MANAGEMENT",
    description: "A connected platform for managing school operations and supporting learning across primary, junior secondary and senior secondary education.",
    siteName: "GETAXE SCHOOL MANAGEMENT",
    type: "website",
    images: [{ url: "/School-erp-Logo.webp", width: 1999, height: 1999, alt: "GETAXE SCHOOL MANAGEMENT logo" }],
  },
  twitter: {
    card: "summary",
    title: "GETAXE SCHOOL MANAGEMENT",
    description: "School management and learning tools by GetAxe Technologies.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <QueryProvider>
          {children}

          {/* Sonner Toaster - this makes ALL your toast.success() calls visible */}
          <Toaster
            richColors
            position="top-center"
            duration={60000}           // 60 seconds - enough time to copy password
            visibleToasts={5}
            closeButton                // adds X button for easy dismiss
            toastOptions={{
              classNames: {
                toast: "group toast bg-background text-foreground border-border shadow-xl rounded-xl",
                description: "group-[.toast]:text-muted-foreground",
                actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
