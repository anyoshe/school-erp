// frontend/(protected)/dashboard/modules/admissions/components/DocumentUpload.tsx
import { useState } from 'react';

const DocumentUpload = ({ onFilesChange }: { onFilesChange: (files: File[]) => void }) => {
  const [files, setFiles] = useState<File[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      onFilesChange([...files, ...newFiles]);
    }
  };

  return (
    <div>
      <label>Upload Documents</label>
      <input type="file" multiple onChange={handleChange} className="p-2 border rounded w-full" />
      <ul>{files.map(file => <li key={file.name}>{file.name}</li>)}</ul>
    </div>
  );
};

export default DocumentUpload;