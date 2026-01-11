// export default ApplicationDetailPage;
"use client";

import { useEffect, useState } from 'react';
import React from 'react';  // ← Important: Import React
import api from '@/utils/api';
import ApplicationForm from '../components/ApplicationForm';
import OnboardButton from '../components/OnboardButton';
import { useRouter } from 'next/navigation';

const ApplicationDetailPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const router = useRouter();
  
  // ← Correct way: Unwrap params with React.use()
  const { id } = React.use(params);
  
  const isNew = id === 'new';
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isNew) {
      fetchApplication();
    } else {
      setLoading(false);
    }
  }, [id, isNew]);

  const fetchApplication = async () => {
    try {
      const res = await api.get(`/admissions/applications/${id}/`);
      setApplication(res.data);
    } catch (error) {
      console.error('Error fetching application:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: FormData) => {
    try {
      if (isNew) {
        const res = await api.post('/admissions/applications/', formData);
        router.push(`/dashboard/modules/admissions/${res.data.id}`);
      } else {
        await api.patch(`/admissions/applications/${id}/`, formData);
        fetchApplication();
      }
    } catch (error: any) {
      console.error('Error saving application:', error);
    }
  };

  if (loading) return <p className="p-6">Loading application...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        {isNew ? 'New Admission Application' : 'Edit Application'}
      </h1>
      
      <ApplicationForm 
        initialData={application || {}} 
        onSubmit={handleSubmit} 
      />
      
      {!isNew && application?.status === 'ACCEPTED' && application?.fee_payments?.length > 0 && !application?.student && (
        <OnboardButton 
          applicationId={id} 
          onSuccess={(studentId) => router.push(`/dashboard/modules/students/${studentId}`)} 
        />
      )}
      
      {application?.student && (
        <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium">
            ✓ Successfully onboarded as Student ID: <span className="font-bold">{application.student.id}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default ApplicationDetailPage;