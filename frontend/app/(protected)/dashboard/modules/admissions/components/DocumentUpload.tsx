"use client";

import { useState } from 'react';
import { Upload, X, File, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DocumentUploadProps {
  files: File[]; // The component now reads directly from parent state
  onFilesChange: (files: File[]) => void;
  initialFiles?: Array<{ id: string; file: string; description?: string }>;
}

// export default function DocumentUpload({ files, onFilesChange, initialFiles = [] }: DocumentUploadProps) {
export default function DocumentUpload({ 
  files = [], // Ensure default value here
  onFilesChange, 
  initialFiles = [] 
}: DocumentUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = [
    'application/pdf', 
    'image/jpeg', 
    'image/png', 
    'application/msword', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const fingerprint = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      setError(`${file.name} is too large. Max 10MB.`);
      return false;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(`${file.name} format not supported.`);
      return false;
    }
    return true;
  };

  const handleFiles = (newlySelected: FileList | null) => {
    setError(null);
    if (!newlySelected) return;

    const existingFingerprints = new Set(files.map(fingerprint));
    const validNewFiles = Array.from(newlySelected)
      .filter(validateFile)
      .filter(f => !existingFingerprints.has(fingerprint(f)));

    if (validNewFiles.length > 0) {
      onFilesChange([...files, ...validNewFiles]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = ''; // Reset input so same file can be re-selected if deleted
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + ['Bytes', 'KB', 'MB'][i];
  };

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative rounded-lg border-2 border-dashed transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
      >
        <input
          type="file"
          multiple
          onChange={handleChange}
          className="hidden"
          id="document-upload"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        />
        <label htmlFor="document-upload" className="flex flex-col items-center justify-center p-8 cursor-pointer">
          <Upload className="h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-700">Drag & drop or click to select</p>
          <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG, DOC (Max 10MB)</p>
        </label>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* NEW FILES LIST */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">New Documents ({files.length})</h4>
          <ul className="space-y-2">
            {files.map((file, i) => (
              <li key={`new-${i}`} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(i)}
                  className="text-red-600 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* INITIAL FILES LIST */}
      {initialFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Previously Uploaded</h4>
          <ul className="space-y-2">
            {initialFiles.map((doc) => (
              <li key={doc.id} className="flex items-center gap-2 p-3 bg-gray-50 border rounded-lg">
                <File className="h-4 w-4 text-gray-400" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.file.split('/').pop()}</p>
                  {doc.description && <p className="text-xs text-gray-500">{doc.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}