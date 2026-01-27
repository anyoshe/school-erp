// // DocumentUpload.tsx
// "use client";

// import { useState } from 'react';
// import { Upload, X, File, AlertCircle } from 'lucide-react';
// import { Button } from '@/components/ui/button';
// import { Alert, AlertDescription } from '@/components/ui/alert';

// interface DocumentUploadProps {
//   onFilesChange: (files: File[]) => void;
//   initialFiles?: Array<{ id: string; file: string; description?: string } | { name: string; url: string }> | File[];
// }

// export default function DocumentUpload({ onFilesChange, initialFiles = [] }: DocumentUploadProps) {
//   const [files, setFiles] = useState<File[]>([]);
//   const [dragActive, setDragActive] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
//   const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

//   const validateFile = (file: File): boolean => {
//     if (file.size > MAX_FILE_SIZE) {
//       setError(`${file.name} is too large. Maximum size is 10MB.`);
//       return false;
//     }
//     if (!ALLOWED_TYPES.includes(file.type)) {
//       setError(`${file.name} has unsupported format. Allowed: PDF, JPG, PNG, DOC, DOCX.`);
//       return false;
//     }
//     return true;
//   };

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     setError(null);
//     if (e.target.files) {
//       const newFiles = Array.from(e.target.files).filter(validateFile);
//       if (newFiles.length > 0) {
//         const updated = [...files, ...newFiles];
//         setFiles(updated);
//         onFilesChange(updated);
//       }
//     }
//   };

//   const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
//     e.preventDefault();
//     e.stopPropagation();
//     if (e.type === 'dragenter' || e.type === 'dragover') {
//       setDragActive(true);
//     } else if (e.type === 'dragleave') {
//       setDragActive(false);
//     }
//   };

//   const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setDragActive(false);
//     setError(null);

//     if (e.dataTransfer.files) {
//       const newFiles = Array.from(e.dataTransfer.files).filter(validateFile);
//       if (newFiles.length > 0) {
//         const updated = [...files, ...newFiles];
//         setFiles(updated);
//         onFilesChange(updated);
//       }
//     }
//   };

//   const removeFile = (index: number) => {
//     const updated = files.filter((_, i) => i !== index);
//     setFiles(updated);
//     onFilesChange(updated);
//   };

//   const formatFileSize = (bytes: number): string => {
//     if (bytes === 0) return '0 Bytes';
//     const k = 1024;
//     const sizes = ['Bytes', 'KB', 'MB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
//   };

//   return (
//     <div className="space-y-4">
//       {/* Upload Area */}
//       <div
//         onDragEnter={handleDrag}
//         onDragLeave={handleDrag}
//         onDragOver={handleDrag}
//         onDrop={handleDrop}
//         className={`relative rounded-lg border-2 border-dashed transition-colors ${
//           dragActive 
//             ? 'border-blue-500 bg-blue-50' 
//             : 'border-gray-300 bg-gray-50 hover:border-gray-400'
//         }`}
//       >
//         <input
//           type="file"
//           multiple
//           onChange={handleChange}
//           className="hidden"
//           id="document-upload"
//           accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
//         />
//         <label
//           htmlFor="document-upload"
//           className="flex flex-col items-center justify-center p-8 cursor-pointer"
//         >
//           <Upload className="h-8 w-8 text-gray-400 mb-2" />
//           <p className="text-sm font-medium text-gray-700 text-center">
//             Drag and drop files here, or click to select
//           </p>
//           <p className="text-xs text-gray-500 mt-1 text-center">
//             Supported formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB each)
//           </p>
//         </label>
//       </div>

//       {/* Error Alert */}
//       {error && (
//         <Alert variant="destructive">
//           <AlertCircle className="h-4 w-4" />
//           <AlertDescription>{error}</AlertDescription>
//         </Alert>
//       )}

//       {/* File List */}
//       {files.length > 0 && (
//         <div className="space-y-2">
//           <h4 className="text-sm font-medium text-gray-900">Uploaded Files ({files.length})</h4>
//           <ul className="space-y-2">
//             {files.map((file, i) => (
//               <li
//                 key={`new-${i}`}
//                 className="flex items-center justify-between p-3 bg-white border rounded-lg"
//               >
//                 <div className="flex items-center gap-2 min-w-0">
//                   <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
//                   <div className="min-w-0">
//                     <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
//                     <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
//                   </div>
//                 </div>
//                 <Button
//                   type="button"
//                   variant="ghost"
//                   size="sm"
//                   onClick={() => removeFile(i)}
//                   className="ml-2 text-red-600 hover:text-red-700 hover:bg-red-50"
//                 >
//                   <X className="h-4 w-4" />
//                 </Button>
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}

//       {/* Initial Files from Backend */}
//       {initialFiles.length > 0 && typeof initialFiles[0] === 'object' && 'file' in initialFiles[0] && (
//         <div className="space-y-2">
//           <h4 className="text-sm font-medium text-gray-900">Previously Uploaded</h4>
//           <ul className="space-y-2">
//             {(initialFiles as Array<{ id: string; file: string; description?: string }>).map((doc) => (
//               <li key={doc.id} className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg">
//                 <File className="h-4 w-4 text-gray-400" />
//                 <div>
//                   <p className="text-sm font-medium text-gray-900">
//                     {doc.file.split('/').pop()}
//                   </p>
//                   {doc.description && (
//                     <p className="text-xs text-gray-500">{doc.description}</p>
//                   )}
//                 </div>
//               </li>
//             ))}
//           </ul>
//         </div>
//       )}

//       {/* Empty State */}
//       {files.length === 0 && initialFiles.length === 0 && (
//         <p className="text-xs text-gray-500 text-center py-4">
//           No documents uploaded yet
//         </p>
//       )}
//     </div>
//   );
// }
"use client";

import { useState, useEffect } from 'react';
import { Upload, X, File, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DocumentFile {
  id?: string;           // from backend (for existing documents)
  name: string;
  url?: string;          // full media URL for viewing/downloading existing
  file?: File;           // for newly selected files (not yet uploaded)
  description?: string;  // optional backend description
  size?: number;         // for display
}

interface DocumentUploadProps {
  onFilesChange: (newFiles: File[]) => void;  // parent gets only NEW files to upload
  initialFiles?: DocumentFile[];              // array of existing docs from backend
  onRemoveExisting?: (docId: string) => void; // optional: callback to delete from backend
}

export default function DocumentUpload({
  onFilesChange,
  initialFiles = [],
  onRemoveExisting, // optional prop — call this if you want real delete
}: DocumentUploadProps) {
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [allFiles, setAllFiles] = useState<DocumentFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  // Sync allFiles when initialFiles or newFiles change
  useEffect(() => {
    const backendFiles = (initialFiles || []).map((f) => ({
      ...f,
      name: f.name || f.url?.split('/').pop() || 'Unnamed document',
    }));

    const localFiles = newFiles.map((file) => ({
      name: file.name,
      file,
      size: file.size,
    }));

    setAllFiles([...backendFiles, ...localFiles]);
  }, [initialFiles, newFiles]);

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      setError(`${file.name} is too large (max 10MB).`);
      return false;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`${file.name}: unsupported format (PDF, JPG, PNG, DOC, DOCX only).`);
      return false;
    }
    return true;
  };

  const addFiles = (incoming: FileList | File[]) => {
    setError(null);
    const valid = Array.from(incoming).filter(validateFile);
    if (valid.length > 0) {
      setNewFiles((prev) => [...prev, ...valid]);
      onFilesChange([...newFiles, ...valid]); // only new ones go to parent
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    const file = allFiles[index];
    if (file.file) {
      // New file → remove locally
      const updatedNew = newFiles.filter((f) => f !== file.file);
      setNewFiles(updatedNew);
      onFilesChange(updatedNew);
    } else if (file.id && onRemoveExisting) {
      // Existing file → call backend delete (optional)
      onRemoveExisting(file.id);
    }

    // Always remove from display
    setAllFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDrop={handleDrop}
        className={`relative rounded-lg border-2 border-dashed transition-colors p-8 text-center cursor-pointer ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <input
          type="file"
          multiple
          onChange={handleChange}
          className="hidden"
          id="doc-upload"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        />
        <label htmlFor="doc-upload" className="flex flex-col items-center">
          <Upload className="h-10 w-10 text-gray-400 mb-4" />
          <p className="font-semibold text-gray-700 mb-1">Drag & drop files here</p>
          <p className="text-sm text-gray-500">or click to browse</p>
          <p className="text-xs text-gray-400 mt-2">
            PDF, JPG, PNG, DOC, DOCX • Max 10MB per file
          </p>
        </label>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* File List */}
      {allFiles.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">
            Documents ({allFiles.length})
          </h4>
          <ul className="space-y-2 divide-y">
            {allFiles.map((doc, index) => {
              const isNew = !!doc.file;
              return (
                <li
                  key={`${isNew ? 'new' : 'existing'}-${index}`}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate max-w-xs">{doc.name}</p>
                      <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                        {doc.size && <span>{formatFileSize(doc.size)}</span>}
                        {doc.description && <span>{doc.description}</span>}
                        {isNew && <span className="text-amber-600">Pending upload</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {doc.url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700"
                        asChild
                      >
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" title="Download / View">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeFile(index)}
                      title="Remove"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-gray-500 italic">
          No documents added yet
        </div>
      )}
    </div>
  );
}