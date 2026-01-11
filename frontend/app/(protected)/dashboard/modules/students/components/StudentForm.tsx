// "use client";

// import { useState, useEffect } from "react";
// import { studentService } from "../services/studentService";
// import { Student } from "../types/student";
// import api from "../../../../../utils/api"; // Axios instance

// interface Props {
//   student?: Student;
//   onClose: () => void;
//   onSaved: () => void;
// }

// interface ClassOption {
//   id: string;
//   name: string;
// }

// function mapStatusToAPI(status: string) {
//   switch (status) {
//     case "Active":
//       return "ACTIVE";
//     case "Graduated":
//       return "GRADUATED";
//     case "Transferred":
//       return "TRANSFERRED";
//     default:
//       return "ACTIVE";
//   }
// }


// export default function StudentForm({ student, onClose, onSaved }: Props) {
//   const [form, setForm] = useState({
//     admissionNo: student?.admissionNo ?? "",
//     firstName: student?.firstName ?? "",
//     lastName: student?.lastName ?? "",
//     gender: student?.gender ?? "Male",
//     classId: student?.classId ?? "",
//     status: student?.status ?? "Active",
//     dateOfBirth: student?.dateOfBirth ? student.dateOfBirth.split("T")[0] // if ISO string
//       : "",
//   });

//   const [classes, setClasses] = useState<ClassOption[]>([]);

//   useEffect(() => {
//     // Fetch classes from API
//     const fetchClasses = async () => {
//       try {
//         const { data } = await api.get("/academics/classes/");
//         setClasses(data.results ?? data);
//       } catch (err) {
//         console.error("Failed to fetch classes", err);
//       }
//     };
//     fetchClasses();
//   }, []);

//   const handleChange = (e: any) => {
//     setForm({ ...form, [e.target.name]: e.target.value });
//   };

//   const handleSubmit = async () => {
//     const payload: any = {};
//     if (form.admissionNo) payload.admission_number = form.admissionNo;
//     if (form.firstName) payload.first_name = form.firstName;
//     if (form.lastName) payload.last_name = form.lastName;
//     if (form.gender) payload.gender = form.gender;
//     if (form.status) payload.status = mapStatusToAPI(form.status);
//     if (form.classId !== undefined) payload.current_class = form.classId || null;
//     if (form.dateOfBirth) payload.date_of_birth = form.dateOfBirth;


//     try {
//       if (student) {
//         await studentService.update(student.id, payload);
//       } else {
//         await studentService.create(payload);
//       }
//       onSaved();
//       onClose();
//     } catch (err) {
//       console.error("Failed to save student:", err);
//     }
//   };

//   return (
//     <div className="space-y-4">
//       <input
//         className="input"
//         name="admissionNo"
//         value={form.admissionNo}
//         onChange={handleChange}
//         placeholder="Admission No"
//       />
//       <input
//         className="input"
//         name="firstName"
//         value={form.firstName}
//         onChange={handleChange}
//         placeholder="First Name"
//       />
//       <input
//         className="input"
//         name="lastName"
//         value={form.lastName}
//         onChange={handleChange}
//         placeholder="Last Name"
//       />
//       <input
//         className="input"
//         type="date"
//         name="dateOfBirth"
//         value={form.dateOfBirth}
//         onChange={handleChange}
//         placeholder="Date of Birth"
//       />

//       <select className="input" name="gender" value={form.gender} onChange={handleChange}>
//         <option>Male</option>
//         <option>Female</option>
//       </select>

//       <select className="input" name="classId" value={form.classId} onChange={handleChange}>
//         <option value="">Select Class</option>
//         {classes.map((cls) => (
//           <option key={cls.id} value={cls.id}>
//             {cls.name}
//           </option>
//         ))}
//       </select>

//       <select className="input" name="status" value={form.status} onChange={handleChange}>
//         <option>Active</option>
//         <option>Graduated</option>
//         <option>Transferred</option>
//       </select>

//       <div className="flex justify-end gap-2">
//         <button onClick={onClose} className="btn-secondary">Cancel</button>
//         <button onClick={handleSubmit} className="btn-primary">Save</button>
//       </div>
//     </div>
//   );
// }

"use client";

import { useState, useEffect } from "react";
import { studentService } from "../services/studentService";
import { Student } from "../types/student";
import api from "../../../../../utils/api";

interface ClassOption {
  id: string;
  name: string;
}

interface Props {
  student?: Student;
  onClose: () => void;
  onSaved: () => void;
}

const mapStatusToAPI = (status: string) => {
  const map: Record<string, string> = {
    Active: "ACTIVE",
    Graduated: "GRADUATED",
    Transferred: "TRANSFERRED",
  };
  return map[status] || "ACTIVE";
};

export default function StudentForm({ student, onClose, onSaved }: Props) {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    admissionNo: student?.admissionNo ?? "",
    firstName: student?.firstName ?? "",
    lastName: student?.lastName ?? "",
    gender: student?.gender ?? "Male",
    classId: student?.classId ?? "",
    status: student?.status ?? "Active",
    dateOfBirth: student?.dateOfBirth ? student.dateOfBirth.split("T")[0] : "",
  });

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const { data } = await api.get("/academics/classes/");
        setClasses(data.results ?? data);
      } catch (err) {
        console.error("Failed to fetch classes", err);
      }
    };
    fetchClasses();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form.admissionNo || !form.firstName || !form.lastName) {
      alert("Admission No, First Name, and Last Name are required.");
      return;
    }

    setLoading(true);
    const payload: any = {
      admission_number: form.admissionNo,
      first_name: form.firstName,
      last_name: form.lastName,
      gender: form.gender,
      status: mapStatusToAPI(form.status),
      current_class: form.classId || null,
      date_of_birth: form.dateOfBirth || null,
    };

    try {
      if (student) {
        await studentService.update(student.id, payload);
      } else {
        await studentService.create(payload);
      }
      onSaved();
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save student.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold text-slate-900">
          {student ? "Edit Student" : "Enroll New Student"}
        </h3>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-700 font-medium"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Admission Number <span className="text-red-500">*</span>
          </label>
          <input
            name="admissionNo"
            value={form.admissionNo}
            onChange={handleChange}
            placeholder="e.g., STD001"
            className="w-full px-5 py-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Date of Birth
          </label>
          <input
            type="date"
            name="dateOfBirth"
            value={form.dateOfBirth}
            onChange={handleChange}
            className="w-full px-5 py-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            placeholder="e.g., John"
            className="w-full px-5 py-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            placeholder="e.g., Doe"
            className="w-full px-5 py-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
          <select
            name="gender"
            value={form.gender}
            onChange={handleChange}
            className="w-full px-5 py-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Current Class</label>
          <select
            name="classId"
            value={form.classId}
            onChange={handleChange}
            className="w-full px-5 py-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          >
            <option value="">— No Class —</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="w-full px-5 py-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          >
            <option>Active</option>
            <option>Graduated</option>
            <option>Transferred</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-4 mt-10">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-10 py-4 bg-gradient-to-r from-indigo-900 to-indigo-800 hover:from-indigo-800 hover:to-indigo-700 text-white font-bold rounded-xl shadow-xl transition transform hover:scale-105 disabled:opacity-60"
        >
          {loading ? "Saving..." : student ? "Update Student" : "Enroll Student"}
        </button>
      </div>
    </div>
  );
}