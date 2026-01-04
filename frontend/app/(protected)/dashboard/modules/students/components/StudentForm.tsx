"use client";

import { useState, useEffect } from "react";
import { studentService } from "../services/studentService";
import { Student } from "../types/student";
import api from "../../../../../utils/api"; // Axios instance

interface Props {
  student?: Student;
  onClose: () => void;
  onSaved: () => void;
}

interface ClassOption {
  id: string;
  name: string;
}

function mapStatusToAPI(status: string) {
  switch (status) {
    case "Active":
      return "ACTIVE";
    case "Graduated":
      return "GRADUATED";
    case "Transferred":
      return "TRANSFERRED";
    default:
      return "ACTIVE";
  }
}


export default function StudentForm({ student, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    admissionNo: student?.admissionNo ?? "",
    firstName: student?.firstName ?? "",
    lastName: student?.lastName ?? "",
    gender: student?.gender ?? "Male",
    classId: student?.classId ?? "",
    status: student?.status ?? "Active",
    dateOfBirth: student?.dateOfBirth ? student.dateOfBirth.split("T")[0] // if ISO string
      : "",
  });

  const [classes, setClasses] = useState<ClassOption[]>([]);

  useEffect(() => {
    // Fetch classes from API
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

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const payload: any = {};
    if (form.admissionNo) payload.admission_number = form.admissionNo;
    if (form.firstName) payload.first_name = form.firstName;
    if (form.lastName) payload.last_name = form.lastName;
    if (form.gender) payload.gender = form.gender;
    if (form.status) payload.status = mapStatusToAPI(form.status);
    if (form.classId !== undefined) payload.current_class = form.classId || null;
    if (form.dateOfBirth) payload.date_of_birth = form.dateOfBirth;


    try {
      if (student) {
        await studentService.update(student.id, payload);
      } else {
        await studentService.create(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save student:", err);
    }
  };

  return (
    <div className="space-y-4">
      <input
        className="input"
        name="admissionNo"
        value={form.admissionNo}
        onChange={handleChange}
        placeholder="Admission No"
      />
      <input
        className="input"
        name="firstName"
        value={form.firstName}
        onChange={handleChange}
        placeholder="First Name"
      />
      <input
        className="input"
        name="lastName"
        value={form.lastName}
        onChange={handleChange}
        placeholder="Last Name"
      />
      <input
        className="input"
        type="date"
        name="dateOfBirth"
        value={form.dateOfBirth}
        onChange={handleChange}
        placeholder="Date of Birth"
      />

      <select className="input" name="gender" value={form.gender} onChange={handleChange}>
        <option>Male</option>
        <option>Female</option>
      </select>

      <select className="input" name="classId" value={form.classId} onChange={handleChange}>
        <option value="">Select Class</option>
        {classes.map((cls) => (
          <option key={cls.id} value={cls.id}>
            {cls.name}
          </option>
        ))}
      </select>

      <select className="input" name="status" value={form.status} onChange={handleChange}>
        <option>Active</option>
        <option>Graduated</option>
        <option>Transferred</option>
      </select>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={handleSubmit} className="btn-primary">Save</button>
      </div>
    </div>
  );
}
