export interface Student {
  id: string;

  admissionNo: string;
  firstName: string;
  lastName: string;

  gender: "Male" | "Female";

  dateOfBirth?: string;

  classId?: string | null;
  className?: string; // for table display

  status: "ACTIVE" | "GRADUATED" | "TRANSFERRED";

  createdAt?: string;
  _offline?: boolean;
}
