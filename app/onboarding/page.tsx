'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const CANADIAN_PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
  'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
  'Quebec', 'Saskatchewan', 'Yukon'
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0); // 0 = email verification
  const [userEmail, setUserEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [formData, setFormData] = useState({
    // Q1: Emotional calibration
    emotionalState: [] as string[],
    
    // Q2: Financial context
    financialContext: [] as string[],
    
    // Q3: Motivation
    motivation: '',
    motivationOther: '',
    
    // Q4: Acquisition source
    acquisitionSource: '',
    acquisitionOther: '',
    
    // Q6: Insight preferences
    insightPreferences: [] as string[],
    insightOther: '',
    
    // Q9: Profile
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    recoveryPhone: '',
    provinceRegion: '',
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  const totalSteps = 8; // 0=verification, 1-7=questions

  // Get user email and name from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('ci.session.user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUserEmail(user.email || '');
      setFormData(prev => ({ ...prev, firstName: user.name || '' }));
    }
  }, []);

  const handleMultiSelect = (field: 'emotionalState' | 'financialContext' | 'insightPreferences', value: string) => {
    const currentValues = formData[field];
    if (currentValues.includes(value)) {
      setFormData({ ...formData, [field]: currentValues.filter(v => v !== value) });
    } else {
      setFormData({ ...formData, [field]: [...currentValues, value] });
    }
  };

  const handleVerificationCodeChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit
    
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleVerificationPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
    setVerificationCode(newCode.slice(0, 6));
    
    // Focus the last filled input or first empty
    const focusIndex = Math.min(pastedData.length, 5);
    const targetInput = document.getElementById(`code-${focusIndex}`);
    targetInput?.focus();
  };

  const handleVerificationKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const validateStep = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (currentStep === 4) {
      // Q2: Financial Context - Check savings radio group constraint
      const savingsOptions = [
        "I've been growing my savings this year",
        "I've been dipping into my savings this year",
        "Prefer not to answer"
      ];
      const selectedSavings = formData.financialContext.filter(opt => savingsOptions.includes(opt));
      if (selectedSavings.length > 1) {
        newErrors.financialContext = "Please select only one of growing savings, dipping into savings or prefer not to answer";
      }
    }

    if (currentStep === 6) {
      // Q9: Profile validation
      if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
      if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
      if (!formData.provinceRegion) newErrors.provinceRegion = "Province is required";
      
      // Age validation (must be 18+)
      if (formData.dateOfBirth) {
        const today = new Date();
        const birthDate = new Date(formData.dateOfBirth);
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
        
        if (actualAge < 18) {
          newErrors.dateOfBirth = "You need to be older than 18 years old to create an account.";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (validateStep()) {
      // Update progress after each step (to track drop-offs)
      if (currentStep > 0) { // Don't save on email verification step
        await updateProgress(currentStep);
      }
      
      if (currentStep < totalSteps - 1) {
        setCurrentStep(currentStep + 1);
        window.scrollTo(0, 0);
      } else {
        handleSubmit();
      }
    }
  };

  // Update progress to track drop-offs (updates same row)
  const updateProgress = async (completedStep: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const progressData = {
        ...formData,
        lastStep: completedStep, // Track which step they just completed
        completedAt: null,  // Not fully completed yet
      };

      console.log(`[Onboarding] Updating progress after step ${completedStep}`);

      await fetch('/api/onboarding/progress', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(progressData)
      });
    } catch (error) {
      console.error('[Onboarding] Failed to update progress:', error);
      // Don't block user progress if auto-save fails
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      // Clear session and go back to login page
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('ci.session.token');
      localStorage.removeItem('ci.session.user');
      window.location.href = '/';
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setErrors({});
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Add completion metadata
      const submissionData = {
        ...formData,
        lastStep: 7, // Completed all steps
        completedAt: new Date().toISOString()
      };
      
      console.log('[Onboarding] Submitting data:', submissionData);
      
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save onboarding data');
      }

      console.log('[Onboarding] Successfully saved responses');
      
      // Redirect to home (which will show dashboard for authenticated users)
      window.location.href = '/';
    } catch (error: any) {
      console.error('Error saving onboarding:', error);
      alert(`Failed to save your responses. ${error.message || 'Please try again.'}`);
    }
  };

  const renderStep0 = () => (
    <div className="space-y-6">
      <div className="pt-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-10">
          Verify your email
        </h2>
        <p className="text-gray-600 text-center">
          We sent a verification code to <span className="font-semibold">{userEmail}</span> - please enter it here
        </p>
      </div>

      {/* Extra whitespace before verification code input */}
      <div className="mt-10">
        <div className="flex gap-2 justify-center">
          {verificationCode.map((digit, index) => (
            <input
              key={index}
              id={`code-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleVerificationCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleVerificationKeyDown(index, e)}
              onPaste={index === 0 ? handleVerificationPaste : undefined}
              className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center pb-4">
        (Don't worry Ella, will actually check authentication once I confirm reg)
      </p>

      <div className="flex justify-between items-center">
        <button
          onClick={handleBack}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Change email or restart
        </button>
        <button
          onClick={handleNext}
          className="px-4 py-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          Skip
        </button>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          How does managing money make you feel?
        </h2>
        <p className="text-sm text-gray-600 mt-1">(Select all that apply)</p>
      </div>

      <div className="space-y-0">
        {[
          { text: "I feel stressed just by you mentioning it", emoji: "😰" },
          { text: "It sometimes feels overwhelming", emoji: "😵" },
          { text: "It's a chore I tend to put off", emoji: "💤" },
          { text: "I feel mostly in control", emoji: "😊" },
          { text: "I'm curious to learn new ways to do better", emoji: "🤔" },
          { text: "I'd love some personalized guidance", emoji: "✨" }
        ].map(option => (
          <label key={option.text} className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition-colors rounded-lg">
            <div className="flex items-center flex-1">
              <input
                type="checkbox"
                checked={formData.emotionalState.includes(`${option.text} ${option.emoji}`)}
                onChange={() => handleMultiSelect('emotionalState', `${option.text} ${option.emoji}`)}
                className="mr-3 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-700">{option.text}</span>
            </div>
            <span className="text-2xl ml-3">{option.emoji}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Everyone's finances look different — help us tailor your insights.
        </h2>
        <p className="text-sm text-gray-600 mt-1">(Select all that apply)</p>
      </div>

      <div className="space-y-0">
        {[
          "I earn a regular income",
          "I'm living paycheck to paycheck",
          "I've been growing my savings this year",
          "I've been dipping into my savings this year",
          "I have a comfortable savings cushion",
          "I share finances with a partner or have dependents",
          "I manage multiple accounts (e.g. work vs. personal, family members)",
          "Prefer not to answer"
        ].map(option => (
          <label key={option} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer transition-colors rounded-lg">
            <input
              type="checkbox"
              checked={formData.financialContext.includes(option)}
              onChange={() => handleMultiSelect('financialContext', option)}
              className="mr-3 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">{option}</span>
          </label>
        ))}
      </div>

      {errors.financialContext && (
        <p className="text-red-500 text-sm">Please select only one of growing savings, dipping into savings or prefer not to answer</p>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          What brings you here today?
        </h2>
        <p className="text-sm text-gray-600 mt-1">(Select the one that best describes you)</p>
      </div>

      <div className="space-y-0">
        {[
          "Just exploring",
          "Get organized (see where my money goes, combine accounts)",
          "Improve my finances (spend smarter, save more, get back on track)",
          "Plan ahead (for a goal, trip, event or the next year)",
          "Discover smarter, AI-powered insights",
          "Something else"
        ].map(option => (
          <label key={option} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer transition-colors rounded-lg">
            <input
              type="radio"
              name="motivation"
              checked={formData.motivation === option}
              onChange={() => setFormData({ ...formData, motivation: option, motivationOther: '' })}
              className="mr-3 h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">{option}</span>
          </label>
        ))}
      </div>

      {formData.motivation === "Something else" && (
        <div>
          <textarea
            value={formData.motivationOther}
            onChange={(e) => setFormData({ ...formData, motivationOther: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="What brings you here?"
            required
          />
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          How did you hear about us?
        </h2>
      </div>

      <div className="space-y-0">
        {[
          "I know one of the founders (hi 👋)",
          "Friend or family",
          "Social media or press",
          "Search (Google, etc.)",
          "AI tools (ChatGPT, Grok, Copilot…)",
          "Other"
        ].map(option => (
          <label key={option} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer transition-colors rounded-lg">
            <input
              type="radio"
              name="acquisitionSource"
              checked={formData.acquisitionSource === option}
              onChange={() => setFormData({ ...formData, acquisitionSource: option, acquisitionOther: '' })}
              className="mr-3 h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">{option}</span>
          </label>
        ))}
      </div>

      {formData.acquisitionSource === "Other" && (
        <div>
          <textarea
            value={formData.acquisitionOther}
            onChange={(e) => setFormData({ ...formData, acquisitionOther: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Please tell us how you heard about us"
            required
          />
        </div>
      )}
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          Would any of these AI-powered insights interest you?
        </h2>
        <p className="text-sm text-gray-600 mt-1">(Select all that apply)</p>
      </div>

      <div className="space-y-0">
        {[
          "Detect fraud or unwanted bank charges",
          "Flag changes in bills or recurring spend",
          "Catch duplicate or unnecessary fees",
          "Track and manage growing subscriptions",
          "Compare my spending to peers",
          "Discover where I could rebalance my spending",
          "I have a great idea that you didn't mention"
        ].map(option => (
          <label key={option} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer transition-colors rounded-lg">
            <input
              type="checkbox"
              checked={formData.insightPreferences.includes(option)}
              onChange={() => handleMultiSelect('insightPreferences', option)}
              className="mr-3 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">{option}</span>
          </label>
        ))}
      </div>

      {formData.insightPreferences.includes("I have a great idea that you didn't mention") && (
        <div>
          <textarea
            value={formData.insightOther}
            onChange={(e) => setFormData({ ...formData, insightOther: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="Tell us your idea"
            required
          />
        </div>
      )}
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Complete your profile
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="John"
          />
          {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last Name
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Doe"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Date of Birth <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.dateOfBirth}
          onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Province <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.provinceRegion}
          onChange={(e) => setFormData({ ...formData, provinceRegion: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="">Select your province</option>
          {CANADIAN_PROVINCES.map(province => (
            <option key={province} value={province}>{province}</option>
          ))}
          <option value="International / Outside of Canada">International / Outside of Canada</option>
        </select>
        {errors.provinceRegion && <p className="text-red-500 text-sm mt-1">{errors.provinceRegion}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Recovery Phone Number (Optional)
        </label>
        <input
          type="tel"
          value={formData.recoveryPhone}
          onChange={(e) => setFormData({ ...formData, recoveryPhone: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="+1 (555) 123-4567"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Step Content */}
          <div className="mb-8">
            {currentStep === 0 && renderStep0()}
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep3()}
            {currentStep === 3 && renderStep4()}
            {currentStep === 4 && renderStep2()}
            {currentStep === 5 && renderStep5()}
            {currentStep === 6 && renderStep6()}
          </div>

          {/* Navigation Buttons */}
          {currentStep > 0 && (
            <div className="flex justify-between items-center">
              <button
                onClick={handleBack}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {currentStep === 6 ? 'Complete Setup' : 'Continue'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
