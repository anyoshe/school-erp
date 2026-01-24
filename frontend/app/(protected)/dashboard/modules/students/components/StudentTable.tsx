"use client";

import { Student } from "../types/student";
import Link from "next/link";


interface Props {
  students: Student[];
  onEdit: (s: Student) => void;
  onDelete: (id: string) => void;
}

export default function StudentTable({ students, onEdit, onDelete }: Props) {
  return (
    <table className="w-full bg-white rounded-xl shadow">
      <thead className="bg-gray-100">
        <tr className="text-left">
          <th className="p-3">Admission No</th>
          <th className="p-3">Name</th>
          <th className="p-3">Gender</th>
          <th className="p-3">Date of Birth</th>
          <th className="p-3">Class</th>
          <th className="p-3">Status</th>
          <th className="p-3"></th>
        </tr>
      </thead>

      <tbody>
        {students.map((s) => (
          <tr key={s.id} className="border-t hover:bg-gray-50">
            <td className="p-3">{s.admission_number}</td>

            {/* <td className="p-3">
              {s.first_name} {s.last_name}
            </td> */}
            <td className="p-3">
              <Link
                href={`/dashboard/modules/students/${s.id}`}
                className="text-blue-600 hover:underline"
              >
                {s.first_name} {s.last_name}
              </Link>

            </td>


            <td className="p-3">{s.gender}</td>

            <td className="p-3">
              {s.date_of_birth
                ? new Date(s.date_of_birth).toLocaleDateString()
                : "-"}
            </td>

            <td className="p-3">
              {s.current_class ?? "—"}
            </td>

            <td className="p-3">
              <span
                className={`px-2 py-1 rounded text-sm ${s.status === "ACTIVE"
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-200 text-gray-700"
                  }`}
              >
                {s.status}
              </span>
            </td>

            <td className="p-3 space-x-2">
              <button
                onClick={() => onEdit(s)}
                className="text-blue-600 hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(s.id)}
                className="text-red-600 hover:underline"
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
