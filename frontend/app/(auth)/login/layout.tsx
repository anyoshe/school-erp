// app/login/layout.tsx
"use client";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center h-screen bg-neutral">
      {children}
    </div>
  );
}
