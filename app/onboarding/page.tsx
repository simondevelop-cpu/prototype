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

  const totalSteps = 7; // 0=verification, 1-6=questions (step 6 is profile, the final step)

  // Get user email and name from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('ci.session.user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setUserEmail(user.email || '');
      setFormData(prev => ({ ...prev, firstName: user.name || '' }));
    }

    // Check for concurrent onboarding sessions (multiple tabs)
    const onboardingLock = localStorage.getItem('onboarding.lock');
    if (onboardingLock) {
      const lockTime = parseInt(onboardingLock);
      const now = Date.now();
      // If lock is less than 5 minutes old, warn user
      if (now - lockTime < 5 * 60 * 1000) {
        console.warn('[Onboarding] Concurrent session detected');
        // Allow it but log warning - user might have closed other tab
      }
    }
    // Set lock for this session
    localStorage.setItem('onboarding.lock', Date.now().toString());

    // Handle browser back button (prevent data loss)
    const handleBrowserBack = (e: PopStateEvent) => {
      e.preventDefault();
      if (currentStep > 0) {
        setCurrentStep(prev => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('popstate', handleBrowserBack);

    // Clear lock on unmount
    return () => {
      localStorage.removeItem('onboarding.lock');
      window.removeEventListener('popstate', handleBrowserBack);
    };
  }, [currentStep]);

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

    // Force selection validation for multi-select steps
    if (currentStep === 1) {
      // Q1: Emotional State (multi-select, at least one required)
      if (formData.emotionalState.length === 0) {
        newErrors.emotionalState = "Please make a selection to continue";
      }
    }

    if (currentStep === 2) {
      // Q3: Motivation (single select, required)
      if (!formData.motivation) {
        newErrors.motivation = "Please make a selection to continue";
      }
    }

    if (currentStep === 3) {
      // Q4: Acquisition Source (single select, required)
      if (!formData.acquisitionSource) {
        newErrors.acquisitionSource = "Please make a selection to continue";
      }
    }

    if (currentStep === 4) {
      // Q2: Financial Context - Check savings radio group constraint
      const savingsOptions = [
        "I've been growing my savings this year",
        "I've been dipping into my savings this year",
        "Prefer not to answer"
      ];
      const selectedSavings = formData.financialContext.filter(opt => savingsOptions.includes(opt));
      
      // Check if "Prefer not to answer" is selected with other options
      if (formData.financialContext.includes("Prefer not to answer") && formData.financialContext.length > 1) {
        newErrors.financialContext = "Did you mean to select 'Prefer not to answer'? Please unselect other options.";
      }
      // Only show savings error if 2 or more savings options are selected (not if none)
      else if (selectedSavings.length >= 2) {
        newErrors.financialContext = "Please select only one of growing savings, dipping into savings or prefer not to answer";
      }
      // At least one option required
      else if (formData.financialContext.length === 0) {
        newErrors.financialContext = "Please make a selection to continue";
      }
    }

    if (currentStep === 5) {
      // Q5: AI Insights (multi-select, at least one required)
      if (formData.insightPreferences.length === 0) {
        newErrors.insightPreferences = "Please make a selection to continue";
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
      // Use the correct token key (ci.session.token, not just 'token')
      const token = localStorage.getItem('ci.session.token') || localStorage.getItem('token');
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
      // Clear ALL session data (current and legacy keys)
      localStorage.removeItem('ci.session.token');
      localStorage.removeItem('ci.session.user');
      localStorage.removeItem('token'); // Legacy cleanup
      localStorage.removeItem('user');  // Legacy cleanup
      window.location.href = '/';
    } else if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      setErrors({});
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async (retryCount = 0) => {
    const MAX_RETRIES = 2;
    
    try {
      // Use the correct token key (ci.session.token, not just 'token')
      const token = localStorage.getItem('ci.session.token') || localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      // Check if token is expired (basic check - decode JWT payload)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          throw new Error('Your session has expired. Please log in again.');
        }
      } catch (e) {
        console.warn('[Onboarding] Could not validate token expiry:', e);
        // Continue anyway - server will validate
      }
      
      // Add completion metadata
      const submissionData = {
        ...formData,
        lastStep: 6, // Completed all steps (step 6 is the final profile step)
        completedAt: new Date().toISOString()
      };
      
      console.log('[Onboarding] Submitting data (attempt ' + (retryCount + 1) + '):', submissionData);
      
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
      
      // Clear onboarding lock
      localStorage.removeItem('onboarding.lock');
      
      // Redirect to home (which will show dashboard for authenticated users)
      window.location.href = '/';
    } catch (error: any) {
      console.error('Error saving onboarding:', error);
      
      // Retry on network failure
      if (retryCount < MAX_RETRIES && (error.message.includes('fetch') || error.message.includes('network'))) {
        console.log(`[Onboarding] Retrying submission (${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(() => handleSubmit(retryCount + 1), 1000 * (retryCount + 1)); // Exponential backoff
      } else {
        alert(`Failed to save your responses. ${error.message || 'Please try again.'}\n\nYour progress has been saved. You can try submitting again.`);
      }
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

      {errors.emotionalState && (
        <p className="text-red-500 text-sm">{errors.emotionalState}</p>
      )}
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
          "I have accounts with multiple institutions",
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
        <p className="text-red-500 text-sm">{errors.financialContext}</p>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          What brings you here today?
        </h2>
        <p className="text-sm text-gray-500 italic mt-1">(Select the one that best describes you)</p>
      </div>

      <div className="space-y-0">
        {[
          "Just exploring",
          "Get organized (see where my money goes, combine accounts)",
          "Improve my finances (spend smarter, save more, get back on track)",
          "Plan ahead (for a goal, trip, event or the next year)",
          "Optimize my finances",
          "Something else"
        ].map(option => {
          // Split option text to style brackets differently
          const parts = option.match(/^(.+?)\s*\((.+?)\)\s*$/);
          if (parts) {
            const mainText = parts[1].trim();
            const bracketText = parts[2].trim();
            return (
              <label key={option} className="flex items-center p-3 hover:bg-gray-50 cursor-pointer transition-colors rounded-lg">
                <input
                  type="radio"
                  name="motivation"
                  checked={formData.motivation === option}
                  onChange={() => setFormData({ ...formData, motivation: option, motivationOther: '' })}
                  className="mr-3 h-5 w-5 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-700">
                  {mainText} <span className="text-gray-400 italic">({bracketText})</span>
                </span>
              </label>
            );
          }
          return (
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
          );
        })}
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

      {errors.motivation && (
        <p className="text-red-500 text-sm">{errors.motivation}</p>
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

      {errors.acquisitionSource && (
        <p className="text-red-500 text-sm">{errors.acquisitionSource}</p>
      )}
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          We're working on building smart insights; would any of these interest you?
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

      {errors.insightPreferences && (
        <p className="text-red-500 text-sm">{errors.insightPreferences}</p>
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
