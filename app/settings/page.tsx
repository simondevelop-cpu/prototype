'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CANADIAN_PROVINCES = [
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador',
  'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island',
  'Quebec', 'Saskatchewan', 'Yukon'
];

export default function SettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Personal details state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [provinceRegion, setProvinceRegion] = useState('');
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  
  // Data consent state
  const [requiredData, setRequiredData] = useState(true); // Combined essential analytics + essential cookies
  const [functionalData, setFunctionalData] = useState(true);
  const [marketingData, setMarketingData] = useState(false);
  const [cookiesNonEssential, setCookiesNonEssential] = useState(true);
  const [saving, setSaving] = useState(false);

  // Language state
  const [language, setLanguage] = useState('english');

  // Delete account confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Required data uncheck confirmation
  const [showRequiredDataConfirm, setShowRequiredDataConfirm] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('ci.session.token');
    const storedUser = localStorage.getItem('ci.session.user');
    
    if (!storedToken || !storedUser) {
      router.push('/');
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    setToken(storedToken);
    setUserId(parsedUser.id);
    
    // Fetch personal data from API
    fetchPersonalData(storedToken);
  }, [router]);

  const fetchPersonalData = async (authToken: string) => {
    try {
      const response = await fetch('/api/account/personal-data', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const personal = data.personalData || {};
        setDisplayName(personal.displayName || '');
        setEmail(personal.email || '');
        setFirstName(personal.firstName || '');
        setLastName(personal.lastName || '');
        setDateOfBirth(personal.dateOfBirth || '');
        setRecoveryPhone(personal.recoveryPhone || '');
        setProvinceRegion(personal.provinceRegion || '');
      }
    } catch (error) {
      console.error('Failed to fetch personal data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalDetailsSave = async () => {
    if (!token || !userId) return;
    
    setSavingPersonal(true);
    setPersonalError(null);
    
    try {
      const response = await fetch('/api/account/personal-data', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin,
        },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          email: email.trim() || undefined,
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          dateOfBirth: dateOfBirth || undefined,
          recoveryPhone: recoveryPhone.trim() || undefined,
          provinceRegion: provinceRegion || undefined,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setPersonalError(errorData.error || 'Failed to update personal details');
        return;
      }
      
      const data = await response.json();
      
      // Update localStorage with new user data
      const storedUser = localStorage.getItem('ci.session.user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        parsedUser.name = data.personalData.displayName;
        parsedUser.email = data.personalData.email;
        localStorage.setItem('ci.session.user', JSON.stringify(parsedUser));
      }
      
      setEditingPersonal(false);
    } catch (error) {
      console.error('Failed to update personal details:', error);
      setPersonalError('Failed to update personal details. Please try again.');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSettingChange = async (setting: string, value: boolean | string) => {
    if (!token || !userId) return;
    
    // Special handling for required_data - if unchecking, show confirmation
    if (setting === 'required_data' && !(value as boolean) && requiredData) {
      setShowRequiredDataConfirm(true);
      return; // Don't proceed until confirmed
    }
    
    setSaving(true);
    
    try {
      // Update local state
      switch (setting) {
        case 'required_data':
          setRequiredData(value as boolean);
          setShowRequiredDataConfirm(false); // Clear confirmation state
          break;
        case 'functional_data':
          setFunctionalData(value as boolean);
          break;
        case 'marketing_data':
          setMarketingData(value as boolean);
          break;
        case 'cookies_non_essential':
          setCookiesNonEssential(value as boolean);
          break;
        case 'language':
          setLanguage(value as string);
          break;
      }
      
      // Log consent event (only for boolean settings, not language)
      if (typeof value === 'boolean') {
        const response = await fetch('/api/consent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Origin': window.location.origin,
          },
          body: JSON.stringify({
            consentType: 'settings_update',
            setting,
            value,
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to update setting:', response.status, errorData);
          throw new Error('Failed to update setting');
        } else {
          console.log(`Setting ${setting} updated to ${value}`);
        }
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
      // Revert state on error
      switch (setting) {
        case 'required_data':
          setRequiredData(!(value as boolean));
          break;
        case 'functional_data':
          setFunctionalData(!(value as boolean));
          break;
        case 'marketing_data':
          setMarketingData(!(value as boolean));
          break;
        case 'cookies_non_essential':
          setCookiesNonEssential(!(value as boolean));
          break;
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    
    if (!confirm('Are you absolutely sure? This action is irreversible and will permanently delete your account and all associated data.')) {
      setShowDeleteConfirm(false);
      return;
    }
    
    if (!token) return;
    
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        localStorage.removeItem('ci.session.token');
        localStorage.removeItem('ci.session.user');
        router.push('/');
      } else {
        alert('Failed to delete account. Please try again.');
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account. Please try again.');
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <Link 
            href="/"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Panel 1: Personal Details */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Personal Details</h2>
          <p className="text-sm text-gray-600 mb-6">
            Update your personal information. These details are used to personalize your experience and for account recovery.
          </p>
          
          {personalError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {personalError}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name
                </label>
                {editingPersonal ? (
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John"
                  />
                ) : (
                  <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                    {firstName || 'Not set'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                {editingPersonal ? (
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Doe"
                  />
                ) : (
                  <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                    {lastName || 'Not set'}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              {editingPersonal ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your name"
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                  {displayName || 'Not set'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              {editingPersonal ? (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your.email@example.com"
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                  {email}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth
              </label>
              {editingPersonal ? (
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                  {dateOfBirth || 'Not set'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Province/Region
              </label>
              {editingPersonal ? (
                <select
                  value={provinceRegion}
                  onChange={(e) => setProvinceRegion(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select your province</option>
                  {CANADIAN_PROVINCES.map(province => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                  <option value="International / Outside of Canada">International / Outside of Canada</option>
                </select>
              ) : (
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                  {provinceRegion || 'Not set'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recovery Phone Number (Optional)
              </label>
              {editingPersonal ? (
                <input
                  type="tel"
                  value={recoveryPhone}
                  onChange={(e) => setRecoveryPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1 (555) 123-4567"
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                  {recoveryPhone || 'Not set'}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              {editingPersonal ? (
                <>
                  <button
                    onClick={handlePersonalDetailsSave}
                    disabled={savingPersonal}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {savingPersonal ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPersonal(false);
                      setPersonalError(null);
                      // Reset to original values by fetching again
                      if (token) fetchPersonalData(token);
                    }}
                    disabled={savingPersonal}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditingPersonal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Panel 2: Data Consent */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Data Consent</h2>
          <p className="text-sm text-gray-600 mb-6">
            Manage your data collection preferences and cookies. You can review our{' '}
            <Link href="/privacy-policy" target="_blank" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            {' '}and{' '}
            <Link href="/terms-and-conditions" target="_blank" className="text-blue-600 hover:underline">
              Terms and Conditions
            </Link>
            {' '}for more information.
          </p>

          <div className="space-y-6">
            {/* Required Data (Essential Analytics + Essential Cookies combined) */}
            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Required Data</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      requiredData 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {requiredData ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    We require essential data collection including performance and analytics, as well as essential cookies for 
                    authentication, security, and session management, in order to operate the Service. You may remove consent 
                    at any time, however doing so would remove your access to the Service.
                  </p>
                  {showRequiredDataConfirm && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm font-medium text-red-900 mb-3">
                        Are you sure you want to disable Required Data? This will remove your access to the Service.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setShowRequiredDataConfirm(false);
                            handleSettingChange('required_data', false);
                          }}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors text-sm"
                        >
                          Yes, Disable Required Data
                        </button>
                        <button
                          onClick={() => setShowRequiredDataConfirm(false)}
                          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={requiredData}
                    onChange={(e) => handleSettingChange('required_data', e.target.checked)}
                    disabled={saving || showRequiredDataConfirm}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Non-essential Data */}
            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Non-essential Data</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      functionalData 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {functionalData ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Functional data helps improve how the Service works for you (for example, remembering your categorisation 
                    preferences or improving reliability). You may turn this off at any time. Doing so may limit certain features 
                    or reduce the overall quality of your experience.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={functionalData}
                    onChange={(e) => handleSettingChange('functional_data', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Marketing Data */}
            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Marketing Data</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      marketingData 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {marketingData ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    We do not require targeting or marketing data to operate the Service. You can opt out at any time without 
                    affecting your account or core functionality.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={marketingData}
                    onChange={(e) => handleSettingChange('marketing_data', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Non-essential Cookies */}
            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Non-essential Cookies</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      cookiesNonEssential 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {cookiesNonEssential ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Non-essential data is used only for optional features, analytics, or improvements. You may withdraw consent 
                    at any time without losing access to the core Service.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={cookiesNonEssential}
                    onChange={(e) => handleSettingChange('cookies_non_essential', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: Language */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Language</h2>
          <p className="text-sm text-gray-600 mb-4">
            Choose your preferred language for the application interface.
          </p>
          <select
            value={language}
            onChange={(e) => handleSettingChange('language', e.target.value)}
            disabled={true}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100 cursor-not-allowed max-w-xs"
          >
            <option value="english">English</option>
            <option value="french">Français (Coming Soon)</option>
          </select>
          <p className="text-xs text-gray-500 mt-2">French language support coming soon</p>
        </div>

        {/* Panel 4: Account Deletion - Separate Danger Zone */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-red-900 mb-2">Delete Account</h2>
              <p className="text-sm text-red-800 mb-4">
                You can delete your account at any time. This will permanently remove your personal data from our systems, 
                subject only to limited legal or regulatory retention requirements. Account deletion is irreversible.
              </p>
              {!showDeleteConfirm ? (
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Delete My Account
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-red-900">
                    Are you sure you want to delete your account? This action cannot be undone.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                    >
                      Yes, Delete My Account
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
