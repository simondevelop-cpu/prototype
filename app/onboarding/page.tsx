'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const CANADIAN_PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
  'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
  'Quebec', 'Saskatchewan', 'Yukon'
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
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
  const [showMotivationMessage, setShowMotivationMessage] = useState('');

  const totalSteps = 7; // Excluding email/password which happens at signup

  const handleMultiSelect = (field: 'emotionalState' | 'financialContext' | 'insightPreferences', value: string) => {
    const currentValues = formData[field];
    if (currentValues.includes(value)) {
      setFormData({ ...formData, [field]: currentValues.filter(v => v !== value) });
    } else {
      setFormData({ ...formData, [field]: [...currentValues, value] });
    }
  };

  const validateStep = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (currentStep === 2) {
      // Q2: Check savings radio group constraint
      const savingsOptions = [
        "I've been growing my savings this year",
        "I've been dipping into my savings this year",
        "Prefer not to answer"
      ];
      const selectedSavings = formData.financialContext.filter(opt => savingsOptions.includes(opt));
      if (selectedSavings.length > 1) {
        newErrors.financialContext = "Please select only one option from: growing savings, dipping into savings, or prefer not to answer";
      }
    }

    if (currentStep === 7) {
      // Q9: Profile validation
      if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
      if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
      if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
      if (!formData.provinceRegion) newErrors.provinceRegion = "Province/region is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep()) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
        window.scrollTo(0, 0);
      } else {
        handleSubmit();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSkipToProfile = () => {
    setCurrentStep(7); // Skip to profile (Q9)
    window.scrollTo(0, 0);
  };

  const handleSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save onboarding data');

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      console.error('Error saving onboarding:', error);
      alert('Failed to save your responses. Please try again.');
    }
  };

  const renderProgressBar = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-600">Step {currentStep} of {totalSteps}</span>
        <span className="text-sm text-gray-600">{Math.round((currentStep / totalSteps) * 100)}% complete</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / totalSteps) * 100}%` }}
        />
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          How do you feel about managing your money right now?
        </h2>
        <p className="text-gray-600 mb-6">(Select all that apply)</p>
      </div>

      <div className="space-y-3">
        {[
          "I feel stressed about it",
          "It sometimes feels overwhelming",
          "It's a chore I tend to put off",
          "I feel mostly in control",
          "I'm curious to learn new ways to do better",
          "I'd love some personalized guidance"
        ].map(option => (
          <label key={option} className="flex items-start p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={formData.emotionalState.includes(option)}
              onChange={() => handleMultiSelect('emotionalState', option)}
              className="mt-1 mr-3 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">{option}</span>
          </label>
        ))}
      </div>

      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleSkipToProfile}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          Skip questions and go to profile setup →
        </button>
        <p className="text-xs text-gray-500 mt-1">(Temporary skip option for testing)</p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Everyone's finances look different — help us tailor your insights.
        </h2>
        <p className="text-gray-600 mb-6">(Select all that apply)</p>
      </div>

      {errors.financialContext && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          {errors.financialContext}
        </div>
      )}

      <div className="space-y-3">
        {[
          "I earn a regular income",
          "I'm living paycheck to paycheck",
          "I've been growing my savings this year",
          "I've been dipping into my savings this year",
          "I have a comfortable savings cushion",
          "I share finances with a partner or have dependents",
          "I manage multiple accounts or budgets (e.g. work vs. personal, family members)",
          "Prefer not to answer"
        ].map(option => (
          <label key={option} className="flex items-start p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={formData.financialContext.includes(option)}
              onChange={() => handleMultiSelect('financialContext', option)}
              className="mt-1 mr-3 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">{option}</span>
          </label>
        ))}
      </div>

      {formData.financialContext.includes("Prefer not to answer") && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-800 text-sm">
          That's ok, we can set you up without it.
        </div>
      )}
    </div>
  );

  const renderStep3 = () => {
    const handleMotivationChange = (value: string) => {
      setFormData({ ...formData, motivation: value, motivationOther: '' });
      
      // Set inline message
      if (value === "Plan ahead (for a goal, trip, event or the next year)") {
        setShowMotivationMessage("We can help with that, but we think you'll stick around because of our insights engine - that will only get more insightful. We're excited for you to see it in all of its glory!");
      } else if (value === "Discover smarter, AI-powered insights") {
        setShowMotivationMessage("Genuinely stoked you said so! We believe the insights engine is the most important part of this business.");
      } else {
        setShowMotivationMessage('');
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            What brings you here today?
          </h2>
          <p className="text-gray-600 mb-6">(Select the one that best describes you)</p>
        </div>

        <div className="space-y-3">
          {[
            "Just exploring",
            "Get organized (see where my money goes, combine accounts)",
            "Improve my finances (spend smarter, save more, get back on track)",
            "Plan ahead (for a goal, trip, event or the next year)",
            "Discover smarter, AI-powered insights",
            "Something else"
          ].map(option => (
            <label key={option} className="flex items-start p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors">
              <input
                type="radio"
                name="motivation"
                checked={formData.motivation === option}
                onChange={() => handleMotivationChange(option)}
                className="mt-1 mr-3 h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-700">{option}</span>
            </label>
          ))}
        </div>

        {showMotivationMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
            {showMotivationMessage}
          </div>
        )}

        {formData.motivation === "Something else" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Please tell us more:
            </label>
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
  };

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          How did you hear about us?
        </h2>
      </div>

      <div className="space-y-3">
        {[
          "I know one of the founders (hi 👋)",
          "Friend or family",
          "Social media or press",
          "Search (Google, etc.)",
          "AI tools (ChatGPT, Grok, Copilot…)",
          "Other"
        ].map(option => (
          <label key={option} className="flex items-start p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors">
            <input
              type="radio"
              name="acquisitionSource"
              checked={formData.acquisitionSource === option}
              onChange={() => setFormData({ ...formData, acquisitionSource: option })}
              className="mt-1 mr-3 h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">{option}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Which AI-powered insights interest you most?
        </h2>
        <p className="text-gray-600 mb-6">(Select all that apply)</p>
      </div>

      <div className="space-y-3">
        {[
          "Detect fraud or unwanted bank charges",
          "Flag changes in bills or recurring spend",
          "Catch duplicate or unnecessary fees",
          "Track and manage growing subscriptions",
          "Compare my spending to peers",
          "Discover where I could rebalance my spending",
          "I have an idea you didn't mention"
        ].map(option => (
          <label key={option} className="flex items-start p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={formData.insightPreferences.includes(option)}
              onChange={() => handleMultiSelect('insightPreferences', option)}
              className="mt-1 mr-3 h-5 w-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-700">{option}</span>
          </label>
        ))}
      </div>

      {formData.insightPreferences.includes("I have an idea you didn't mention") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tell us your idea:
          </label>
          <textarea
            value={formData.insightOther}
            onChange={(e) => setFormData({ ...formData, insightOther: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            placeholder="What insight would you like to see?"
            required
          </label>
        </div>
      )}
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Verify your email
        </h2>
        <p className="text-gray-600 mb-6">
          We sent a verification code to your email address
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Verification Code
        </label>
        <input
          type="text"
          placeholder="Enter 6-digit code"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
          maxLength={6}
        />
      </div>

      <div className="flex gap-3">
        <button
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          disabled
        >
          Resend Code
        </button>
        <button
          onClick={handleNext}
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Skip for Now
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        (Email verification will be fully implemented in a future update)
      </p>
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Complete your profile
        </h2>
        <p className="text-gray-600 mb-6">
          Just a few more details to personalize your experience
        </p>
      </div>

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
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Doe"
          />
          {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Province or Region <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.provinceRegion}
          onChange={(e) => setFormData({ ...formData, provinceRegion: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="">Select your province or region</option>
          {CANADIAN_PROVINCES.map(province => (
            <option key={province} value={province}>{province}</option>
          ))}
          <option value="International / Outside of Canada">International / Outside of Canada</option>
        </select>
        {errors.provinceRegion && <p className="text-red-500 text-sm mt-1">{errors.provinceRegion}</p>}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Canadian Insights! 🇨🇦</h1>
            <p className="text-gray-600">Let's personalize your experience</p>
          </div>

          {renderProgressBar()}

          {/* Step Content */}
          <div className="mb-8">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}
            {currentStep === 6 && renderStep6()}
            {currentStep === 7 && renderStep7()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex gap-4">
            {currentStep > 1 && currentStep !== 6 && (
              <button
                onClick={handleBack}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Back
              </button>
            )}
            {currentStep !== 6 && (
              <button
                onClick={handleNext}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {currentStep === totalSteps ? 'Complete Setup' : 'Continue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

