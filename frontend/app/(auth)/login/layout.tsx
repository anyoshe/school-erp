// app/(auth)/login/layout.tsx
"use client";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh min-h-screen w-full flex items-center justify-center bg-neutral overflow-x-hidden overflow-y-auto">
      <div className="w-full max-w-full">{children}</div>
    </div>
  );
}
