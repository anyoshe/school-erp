"use client";

import { useParams } from "next/navigation";
import StudentTabs from "../[id]/components/StudentTabs";

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();

  if (!id) return <p>Student not found</p>;

  return (
    <div className="space-y-8">
      <StudentTabs studentId={id} />
    </div>
  );
}
