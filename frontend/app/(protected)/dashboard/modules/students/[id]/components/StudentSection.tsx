"use client";

import { useState } from "react";
import { useStudent } from "../../hooks/useStudent"; // Hook for single student
import StudentForm from "../../components/StudentForm";
import { Student } from "../../types/student";

interface Props {
  studentId: string;
}

export default function StudentSection({ studentId }: Props) {
  const { student, loading, refresh } = useStudent(studentId);
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = () => {
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseForm = () => {
    setIsEditing(false);
  };

  const handleSaved = () => {
    refresh();
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-b-4 border-indigo-900"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-20 bg-gradient-to-b from-slate-50 to-white rounded-2xl border-2 border-dashed border-slate-300">
        <div className="max-w-md mx-auto">
          <div className="text-6xl mb-6">🎓</div>
          <h3 className="text-2xl font-semibold text-slate-800 mb-4">
            Student Not Found
          </h3>
          <p className="text-slate-600">
            The student record could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-10">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">
            {student.firstName} {student.lastName}
          </h2>
          <p className="mt-2 text-lg text-slate-600">
            Admission No: <span className="font-medium">{student.admissionNo}</span>
          </p>
        </div>

        {/* Edit Button */}
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="mt-6 sm:mt-0 inline-flex items-center gap-3 bg-gradient-to-r from-indigo-900 to-indigo-800 hover:from-indigo-800 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-xl transition transform hover:scale-105"
          >
            <span className="text-xl">✏️</span>
            Edit Student Details
          </button>
        )}
      </div>

      {/* Edit Form */}
      {isEditing && (
        <div className="mb-12 animate-fadeIn">
          <StudentForm
            student={student}
            onClose={handleCloseForm}
            onSaved={handleSaved}
          />
        </div>
      )}

      {/* Student Details Card */}
      {!isEditing && (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white px-8 py-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-indigo-200 text-sm font-medium uppercase tracking-wider">Admission Number</p>
                <p className="text-2xl font-bold mt-2">{student.admissionNo}</p>
              </div>
              <div>
                <p className="text-indigo-200 text-sm font-medium uppercase tracking-wider">Current Class</p>
                <p className="text-2xl font-bold mt-2">{student.className || "Not Assigned"}</p>
              </div>
              <div>
                <p className="text-indigo-200 text-sm font-medium uppercase tracking-wider">Status</p>
                <div className="mt-2">
                  <span
                    className={`inline-block px-5 py-2 rounded-full text-lg font-bold ${
                      student.status === "ACTIVE"
                        ? "bg-emerald-500 text-white"
                        : student.status === "GRADUATED"
                        ? "bg-purple-500 text-white"
                        : "bg-amber-500 text-white"
                    }`}
                  >
                    {student.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-10 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Full Name</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {student.firstName} {student.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Gender</p>
                <p className="text-2xl font-bold text-slate-900 mt-2 capitalize">
                  {student.gender.toLowerCase()}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Date of Birth</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {student.dateOfBirth
                    ? new Date(student.dateOfBirth).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Age</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">
                  {student.dateOfBirth
                    ? Math.floor(
                        (Date.now() - new Date(student.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
                      )
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}