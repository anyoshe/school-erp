"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/app/utils/auth";
import Link from "next/link";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login"); // redirect if not logged in
    } else {
      setLoading(false); // show content if authenticated
    }
  }, [router]);

  if (loading) return null; // optionally render a spinner

  return (
    <div className="flex min-h-screen bg-neutral">
      <aside className="w-64 bg-primary text-white p-6">
        <h1 className="text-2xl font-bold mb-6">School ERP</h1>
        <nav className="flex flex-col gap-2">
          <Link href="/protected/dashboard">Dashboard</Link>
          <Link href="/protected/modules/accounts/users">Users</Link>
          <Link href="/protected/modules/students/students">Students</Link>
          <Link href="/protected/modules/academics/classes">Classes</Link>
          <Link href="/protected/modules/academics/subjects">Subjects</Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
};

export default Layout;
