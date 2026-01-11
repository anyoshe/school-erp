// app/(protected)/dashboard/schools/[id]/page.tsx
import { notFound } from "next/navigation";
import api from "@/utils/api";
import SchoolForm from "../components/SchoolForm";

async function getSchool(id: string) {
  try {
    const res = await api.get(`/schools/schools/${id}/`);
    return res.data;
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

export default async function EditSchoolPage({ params }: { params: { id: string } }) {
  const school = await getSchool(params.id);

  if (!school) notFound();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Edit School: {school.name}</h1>
      <SchoolForm initial={school} />
    </div>
  );
}