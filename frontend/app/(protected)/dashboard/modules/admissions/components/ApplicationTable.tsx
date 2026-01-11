// frontend/(protected)/dashboard/modules/admissions/components/ApplicationTable.tsx
"use client";
import { useEffect, useState } from 'react';
import api from '@/utils/api';
import Link from 'next/link';

interface Application {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  status: string;
  // Add more as needed
}

const ApplicationTable = ({ searchTerm }: { searchTerm: string }) => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
     const res = await api.get('/admissions/applications/');
      setApplications(res.data);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = applications.filter(app => 
    `${app.first_name} ${app.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.admission_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <p>Loading...</p>;

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="border p-2">Admission #</th>
          <th className="border p-2">Name</th>
          <th className="border p-2">Status</th>
          <th className="border p-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map(app => (
          <tr key={app.id}>
            <td className="border p-2">{app.admission_number}</td>
            <td className="border p-2">{app.first_name} {app.last_name}</td>
            <td className="border p-2">{app.status}</td>
            <td className="border p-2">
              <Link href={`/dashboard/modules/admissions/${app.id}`} className="text-blue-500">Edit</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ApplicationTable;