// frontend/(protected)/dashboard/modules/admissions/components/ApplicationForm.tsx
import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import DocumentUpload from './DocumentUpload';
import FeePaymentForm from './FeePaymentForm';

// Define form data matching Django Application model
interface FormData {
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string; // ISO string from <input type="date">
  class_applied: string | number; // Class ID
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  address: string;
  previous_school: string;
  nationality: string;
  religion: string;
  category: string;
  status: string;
  admission_date?: string;
  notes?: string;
}

interface ApplicationFormProps {
  initialData?: Partial<FormData & { fee_payments: Array<{ amount: number; payment_method: string }> }>;
  onSubmit: (formData: globalThis.FormData) => void; // This is the processed form data (multipart later)
}

const ApplicationForm: React.FC<ApplicationFormProps> = ({ initialData, onSubmit }) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      first_name: initialData?.first_name ?? '',
      last_name: initialData?.last_name ?? '',
      gender: initialData?.gender ?? '',
      date_of_birth: initialData?.date_of_birth ?? '',
      class_applied: initialData?.class_applied ?? '',
      parent_name: initialData?.parent_name ?? '',
      parent_phone: initialData?.parent_phone ?? '',
      parent_email: initialData?.parent_email ?? '',
      address: initialData?.address ?? '',
      previous_school: initialData?.previous_school ?? '',
      nationality: initialData?.nationality ?? '',
      religion: initialData?.religion ?? '',
      category: initialData?.category ?? '',
      status: initialData?.status ?? 'DRAFT',
      admission_date: initialData?.admission_date ?? '',
      notes: initialData?.notes ?? '',
    },
  });

  const [uploadedDocuments, setUploadedDocuments] = useState<File[]>([]);
  const [payments, setPayments] = useState<Array<{ amount: number; payment_method: string }>>(
    initialData?.fee_payments ?? []
  );

  const submitHandler = (data: FormData) => {
    // Build FormData for multipart request (files + JSON)
    const formData = new FormData();

    // Append all regular fields
    (Object.keys(data) as (keyof FormData)[]).forEach((key) => {
      const value = data[key];
      if (value != null && value !== '') {
        formData.append(key, String(value));
      }
    });

    // Append uploaded documents
    uploadedDocuments.forEach((file) => {
      formData.append('documents', file);
    });

    // Append fee payments as JSON string (as expected by your Django serializer)
    if (payments.length > 0) {
      formData.append('fee_payments', JSON.stringify(payments));
    }

    // Pass the final FormData object up
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="space-y-6 max-w-4xl">
      {/* === Student Information === */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Student Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="first_name"
            control={control}
            rules={{ required: 'First name is required' }}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">First Name *</label>
                <input
                  {...field}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name.message}</p>}
              </div>
            )}
          />

          <Controller
            name="last_name"
            control={control}
            rules={{ required: 'Last name is required' }}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Last Name *</label>
                <input
                  {...field}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {errors.last_name && <p className="text-red-500 text-sm mt-1">{errors.last_name.message}</p>}
              </div>
            )}
          />

          <Controller
            name="gender"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Gender</label>
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            )}
          />

          <Controller
            name="date_of_birth"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Date of Birth</label>
                <input
                  {...field}
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          />

          <Controller
            name="class_applied"
            control={control}
            rules={{ required: 'Please select a class' }}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Class Applied For *</label>
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Class</option>
                  {/* You will replace this with real data from API later */}
                  <option value="1">Nursery</option>
                  <option value="2">LKG</option>
                  <option value="3">UKG</option>
                  <option value="4">Class 1</option>
                  {/* ... more options */}
                </select>
                {errors.class_applied && <p className="text-red-500 text-sm mt-1">{errors.class_applied.message}</p>}
              </div>
            )}
          />
        </div>
      </section>

      {/* === Parent Information === */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Parent / Guardian Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="parent_name"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Parent Name</label>
                <input
                  {...field}
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            )}
          />

          <Controller
            name="parent_phone"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Parent Phone</label>
                <input
                  {...field}
                  type="tel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            )}
          />

          <Controller
            name="parent_email"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Parent Email</label>
                <input
                  {...field}
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            )}
          />
        </div>

        <Controller
          name="address"
          control={control}
          render={({ field }) => (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea
                {...field}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          )}
        />
      </section>

      {/* === Additional Info === */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Additional Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Controller
            name="previous_school"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Previous School</label>
                <input {...field} type="text" className="w-full px-3 py-2 border rounded-md" />
              </div>
            )}
          />

          <Controller
            name="nationality"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Nationality</label>
                <input {...field} type="text" className="w-full px-3 py-2 border rounded-md" />
              </div>
            )}
          />

          <Controller
            name="religion"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Religion</label>
                <input {...field} type="text" className="w-full px-3 py-2 border rounded-md" />
              </div>
            )}
          />

          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select {...field} className="w-full px-3 py-2 border rounded-md">
                  <option value="">Select</option>
                  <option value="GENERAL">General</option>
                  <option value="OBC">OBC</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                </select>
              </div>
            )}
          />
        </div>
      </section>

      {/* === Documents & Fees === */}
      <section>
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Documents & Admission Fee</h2>
        <DocumentUpload onFilesChange={setUploadedDocuments} />
        <div className="mt-6">
          <FeePaymentForm payments={payments} onPaymentsChange={setPayments} />
        </div>
      </section>

      {/* === Submit Button === */}
      <div className="mt-10">
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg transition"
        >
          Save Application
        </button>
      </div>
    </form>
  );
};

export default ApplicationForm;