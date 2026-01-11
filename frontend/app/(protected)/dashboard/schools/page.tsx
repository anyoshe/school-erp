"use client";
import { useEffect, useState } from "react";
import api from "@/utils/api";
import Link from "next/link";

export default function SchoolsPage() {
  const [schools, setSchools] = useState<any[]>([]);

  useEffect(() => {
    api.get("/schools/schools/").then(res => setSchools(res.data));
  }, []);

  return (
    <div className="p-6">
      <Link href="/dashboard/schools/new" className="bg-green-600 text-white px-4 py-2 rounded">
        New School
      </Link>

      <table className="mt-4 w-full border">
        <thead>
          <tr>
            <th>Name</th>
            <th>Modules</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {schools.map(s => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.modules.map((m: any) => m.name).join(", ")}</td>
              <td>
                <Link href={`/dashboard/schools/${s.id}`} className="text-blue-600">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
