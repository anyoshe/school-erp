// frontend/(protected)/dashboard/modules/admissions/hooks/useApplications.ts
import { useState, useEffect } from 'react';
import axios from 'axios';

export const useApplications = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get('/api/admissions/applications/');
        setApplications(res.data);
      } catch (error) {
        // Offline fallback: localStorage.getItem('applications')
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { applications, loading };
};