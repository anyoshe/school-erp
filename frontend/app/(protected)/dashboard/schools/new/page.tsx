// app/(protected)/dashboard/schools/new/page.tsx
import SchoolForm from "../components/SchoolForm";

export default function NewSchoolPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Create New School</h1>
      <SchoolForm />
    </div>
  );
}