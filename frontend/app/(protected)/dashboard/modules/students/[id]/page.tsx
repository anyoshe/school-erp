"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader } from "lucide-react";

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Implement student profile page
    setLoading(false);
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">Student Profile</h1>
      <p className="text-gray-600">Student ID: {id}</p>
      <p className="text-gray-600 mt-4">This page is under development.</p>
    </div>
  );
}