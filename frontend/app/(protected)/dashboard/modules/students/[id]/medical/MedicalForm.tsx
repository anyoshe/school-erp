"use client";

import { useState } from "react";
import { medicalService } from "./medicalService";
import { MedicalRecord } from "./medical.types";

interface Props {
  studentId: string;
  record?: MedicalRecord;
  onSaved: () => void;
  onClose?: () => void;
}

export default function MedicalForm({ studentId, record, onSaved, onClose }: Props) {
  const [form, setForm] = useState({
    allergies: record?.allergies || "",
    conditions: record?.conditions || "",
    immunizationNotes: record?.immunizationNotes || "",
    lastVisit: record?.lastVisit || "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (record) {
      await medicalService.updateRecord(record.id, form);
    } else {
      await medicalService.createRecord(studentId, form);
    }
    onSaved();
    onClose?.();
  };

  return (
    <div className="space-y-3">
      <textarea name="allergies" placeholder="Allergies" value={form.allergies} onChange={handleChange} />
      <textarea name="conditions" placeholder="Conditions" value={form.conditions} onChange={handleChange} />
      <textarea name="immunizationNotes" placeholder="Immunization Notes" value={form.immunizationNotes} onChange={handleChange} />
      <input type="date" name="lastVisit" value={form.lastVisit} onChange={handleChange} />
      <button onClick={handleSubmit} className="btn-primary">
        {record ? "Update" : "Add"} Record
      </button>
    </div>
  );
}
