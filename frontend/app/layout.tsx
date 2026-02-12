// // app/layout.tsx
// import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
// import "./globals.css";
// import { Toaster } from "react-hot-toast";
// import { QueryProvider } from "./providers";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

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
//       <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "./providers";

// Add Sonner
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "School ERP",
  description: "School ERP Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
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