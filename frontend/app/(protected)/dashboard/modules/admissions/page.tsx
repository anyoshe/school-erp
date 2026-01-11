// frontend/(protected)/dashboard/modules/admissions/page.tsx
"use client";
import { useState } from 'react';
import ApplicationTable from './components/ApplicationTable';
import Link from 'next/link';

const AdmissionsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Admissions Management</h1>
        <Link href="/dashboard/modules/admissions/new" className="bg-blue-500 text-white px-4 py-2 rounded">
          New Application
        </Link>
      </div>
      <input
        type="text"
        placeholder="Search by name or admission number..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4 p-2 border rounded w-full"
      />
      <ApplicationTable searchTerm={searchTerm} />
    </div>
  );
};

export default AdmissionsPage;