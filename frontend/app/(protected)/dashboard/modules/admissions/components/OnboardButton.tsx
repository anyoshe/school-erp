// frontend/(protected)/dashboard/modules/admissions/components/OnboardButton.tsx
import axios from 'axios';

const OnboardButton = ({ applicationId, onSuccess }: { applicationId: string; onSuccess: (studentId: string) => void }) => {
  const handleOnboard = async () => {
    try {
      const res = await axios.post(`/api/admissions/applications/${applicationId}/onboard_to_student/`);
      onSuccess(res.data.student_id);
    } catch (error) {
      console.error('Error onboarding:', error);
    }
  };

  return (
    <button onClick={handleOnboard} className="bg-purple-500 text-white px-4 py-2 rounded mt-4">
      Onboard to Student
    </button>
  );
};

export default OnboardButton;