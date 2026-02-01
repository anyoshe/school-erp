// src/types/application.ts
export interface ApplicationDocument {
  id: string;
  file: string;           // URL or media path, e.g. "/media/admission_documents/abc.pdf"
  description?: string;
  uploaded_at?: string;   // optional, from backend
}