// // frontend/(protected)/dashboard/modules/admissions/components/DocumentUpload.tsx
import { useState } from 'react';

// const DocumentUpload = ({ onFilesChange }: { onFilesChange: (files: File[]) => void }) => {
//   const [files, setFiles] = useState<File[]>([]);

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files) {
//       const newFiles = Array.from(e.target.files);
//       setFiles(prev => [...prev, ...newFiles]);
//       onFilesChange([...files, ...newFiles]);
//     }
//   };

//   return (
//     <div>
//       <label>Upload Documents</label>
//       <input type="file" multiple onChange={handleChange} className="p-2 border rounded w-full" />
//       <ul>{files.map(file => <li key={file.name}>{file.name}</li>)}</ul>
//     </div>
//   );
// };

// export default DocumentUpload;
// DocumentUpload.tsx
interface DocumentUploadProps {
  onFilesChange: (files: File[]) => void;
  initialFiles?: Array<{ id: string; file: string; description?: string }> | File[]; // accept both uploaded (backend) and new File objects
}

export default function DocumentUpload({ onFilesChange, initialFiles = [] }: DocumentUploadProps) {
  const [files, setFiles] = useState<File[]>([]);

  // Show initial files (backend URLs) separately if needed
  // For example: render previews from initialFiles if they have .file URL

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const updated = [...files, ...newFiles];
      setFiles(updated);
      onFilesChange(updated);
    }
  };

  return (
    <div>
      <label className="block mb-2">Upload Documents</label>
      <input type="file" multiple onChange={handleChange} className="..." />
      <ul className="mt-2">
        {/* Show already uploaded (backend) */}
        {initialFiles.map((doc, i) => (
          <li key={i}>
            {typeof doc === 'object' && 'file' in doc ? doc.file.split('/').pop() : doc.name}
          </li>
        ))}
        {/* Show new local files */}
        {files.map((file, i) => (
          <li key={`new-${i}`}>{file.name}</li>
        ))}
      </ul>
    </div>
  );
}