"use client";

import { useState, useEffect, ChangeEvent } from "react";
import { useCurrentSchool } from '@/contexts/CurrentSchoolContext';
import api from '@/utils/api';
import { Phone, Mail, MapPin, Upload } from 'lucide-react';
import { motion } from 'framer-motion';

// Month mapping to convert backend number to month name
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const getMonthName = (monthNumber?: number) =>
  monthNumber ? monthNames[monthNumber - 1] : "January";

const getMonthNumber = (monthName: string) =>
  monthNames.indexOf(monthName) + 1 || 1;

export default function EditSchoolPage() {
  const { currentSchool, refreshSchools } = useCurrentSchool();

  const [formData, setFormData] = useState({
    schoolName: '',
    shortName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'Kenya',
    website: '',
    currency: 'KES',
    academicYearStart: 'January',
    academicYearEnd: 'December',
    termSystem: 'terms',
    numberOfTerms: 3,
    gradingSystem: 'percentage',
    passingMark: 50,
    officialRegistrationNumber: '',
    registrationAuthority: '',
    registrationDate: '',
    logo: null as File | null,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Prefill form with currentSchool data
  useEffect(() => {
    if (currentSchool) {
      setFormData({
        schoolName: currentSchool.name || '',
        shortName: currentSchool.short_name || '',
        email: currentSchool.email || '',
        phone: currentSchool.phone || '',
        address: currentSchool.address || '',
        city: currentSchool.city || '',
        country: currentSchool.country || 'Kenya',
        website: currentSchool.website || '',
        currency: currentSchool.currency || 'KES',
        academicYearStart: getMonthName(currentSchool.academic_year_start_month),
        academicYearEnd: getMonthName(currentSchool.academic_year_end_month),
        termSystem: currentSchool.term_system || 'terms',
        numberOfTerms: currentSchool.number_of_terms || 3,
        gradingSystem: currentSchool.grading_system || 'percentage',
        passingMark: currentSchool.passing_mark || 50,
        officialRegistrationNumber: currentSchool.official_registration_number || '',
        registrationAuthority: currentSchool.registration_authority || '',
        registrationDate: currentSchool.registration_date || '',
        logo: null,
      });
    }
  }, [currentSchool]);

  const updateForm = <K extends keyof typeof formData>(key: K, value: typeof formData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!currentSchool) return;
    setIsLoading(true);
    try {
      const payload = new FormData();
      payload.append('name', formData.schoolName);
      payload.append('short_name', formData.shortName);
      payload.append('email', formData.email);
      payload.append('phone', formData.phone);
      payload.append('address', formData.address);
      payload.append('city', formData.city);
      payload.append('country', formData.country);
      payload.append('website', formData.website);
      payload.append('currency', formData.currency);
      payload.append('academic_year_start_month', getMonthNumber(formData.academicYearStart).toString());
      payload.append('academic_year_end_month', getMonthNumber(formData.academicYearEnd).toString());
      payload.append('term_system', formData.termSystem);
      payload.append('number_of_terms', formData.numberOfTerms.toString());
      payload.append('grading_system', formData.gradingSystem);
      payload.append('passing_mark', formData.passingMark.toString());
      payload.append('official_registration_number', formData.officialRegistrationNumber);
      payload.append('registration_authority', formData.registrationAuthority);
      payload.append('registration_date', formData.registrationDate);
      if (formData.logo) payload.append('logo', formData.logo);

      await api.patch(`/schools/${currentSchool.id}/`, payload);
      setSuccess(true);
      refreshSchools();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 space-y-6"
      >
        <h2 className="text-3xl font-bold text-primary">Edit School Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* School Name */}
          <div>
            <label className="block text-sm font-medium text-textMuted mb-2">School Name</label>
            <input
              type="text"
              value={formData.schoolName}
              onChange={e => updateForm('schoolName', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Short Name */}
          <div>
            <label className="block text-sm font-medium text-textMuted mb-2">Short Name</label>
            <input
              type="text"
              value={formData.shortName}
              onChange={e => updateForm('shortName', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-textMuted mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 w-5 h-5 text-textMuted" />
              <input
                type="email"
                value={formData.email}
                onChange={e => updateForm('email', e.target.value)}
                className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-textMuted mb-2">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-3.5 w-5 h-5 text-textMuted" />
              <input
                type="tel"
                value={formData.phone}
                onChange={e => updateForm('phone', e.target.value)}
                className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-textMuted mb-2">Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3.5 w-5 h-5 text-textMuted" />
              <input
                type="text"
                value={formData.address}
                onChange={e => updateForm('address', e.target.value)}
                className="w-full pl-10 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium text-textMuted mb-2">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={e => updateForm('city', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-textMuted mb-2">Country</label>
            <input
              type="text"
              value={formData.country}
              onChange={e => updateForm('country', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Academic Year Start */}
          <div>
            <label className="block text-sm font-medium text-textMuted mb-2">Academic Year Start</label>
            <select
              value={formData.academicYearStart}
              onChange={e => updateForm('academicYearStart', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent"
            >
              {monthNames.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          {/* Academic Year End */}
          <div>
            <label className="block text-sm font-medium text-textMuted mb-2">Academic Year End</label>
            <select
              value={formData.academicYearEnd}
              onChange={e => updateForm('academicYearEnd', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent"
            >
              {monthNames.map((month) => (
                <option key={month} value={month}>{month}</option>
              ))}
            </select>
          </div>

          {/* School Logo */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-textMuted mb-2">School Logo</label>
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer hover:bg-background transition-colors">
              <Upload className="w-12 h-12 text-textMuted mb-4" />
              <p className="text-textMuted">Click to upload new logo</p>
              {formData.logo && <p className="text-primary mt-2">Selected: {formData.logo.name}</p>}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) updateForm('logo', file);
                }}
              />
            </label>
            {currentSchool?.logo && !formData.logo && <img src={currentSchool.logo} className="mt-4 h-24" />}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading}
          className="mt-6 w-full py-3 bg-gradient-to-r from-primary to-accent text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all"
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>

        {success && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-secondary font-medium text-center mt-4">Saved successfully!</motion.div>}
      </motion.div>
    </div>
  );
}
