'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Personal details state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  
  // Account options state
  const [essentialAnalytics, setEssentialAnalytics] = useState(true);
  const [functional, setFunctional] = useState(true);
  const [targetingMarketing, setTargetingMarketing] = useState(false);
  const [cookiesEssential, setCookiesEssential] = useState(true);
  const [cookiesNonEssential, setCookiesNonEssential] = useState(true);
  const [language, setLanguage] = useState('english');
  const [saving, setSaving] = useState(false);

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
    setDisplayName(parsedUser.name || '');
    setEmail(parsedUser.email || '');
    setLoading(false);
  }, [router]);

  const handlePersonalDetailsSave = async () => {
    if (!token || !userId) return;
    
    setSavingPersonal(true);
    setPersonalError(null);
    
    try {
      const response = await fetch('/api/account/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin,
        },
        body: JSON.stringify({
          displayName: displayName.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setPersonalError(errorData.error || 'Failed to update personal details');
        return;
      }
      
      const data = await response.json();
      
      // Update localStorage with new user data
      localStorage.setItem('ci.session.user', JSON.stringify(data.user));
      
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
    
    setSaving(true);
    
    try {
      // Update local state
      switch (setting) {
        case 'essential_analytics':
          setEssentialAnalytics(value as boolean);
          break;
        case 'functional':
          setFunctional(value as boolean);
          break;
        case 'targeting_marketing':
          setTargetingMarketing(value as boolean);
          break;
        case 'cookies_essential':
          setCookiesEssential(value as boolean);
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
        case 'essential_analytics':
          setEssentialAnalytics(!(value as boolean));
          break;
        case 'functional':
          setFunctional(!(value as boolean));
          break;
        case 'targeting_marketing':
          setTargetingMarketing(!(value as boolean));
          break;
        case 'cookies_essential':
          setCookiesEssential(!(value as boolean));
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
    if (!confirm('Are you sure you want to delete your account? This action is irreversible.')) {
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
      }
    } catch (error) {
      console.error('Failed to delete account:', error);
      alert('Failed to delete account. Please try again.');
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
            Update your name and email address. These details are used to personalize your experience.
          </p>
          
          {personalError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {personalError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
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
                      // Reset to original values
                      const storedUser = localStorage.getItem('ci.session.user');
                      if (storedUser) {
                        const parsedUser = JSON.parse(storedUser);
                        setDisplayName(parsedUser.name || '');
                        setEmail(parsedUser.email || '');
                      }
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

        {/* Panel 2: Account Options */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Account Options</h2>
          <p className="text-sm text-gray-600 mb-6">
            Manage your data collection preferences, cookies, and language settings. You can review our{' '}
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
            {/* Essential, Performance and Analytics */}
            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Essential, Performance and Analytics</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      essentialAnalytics 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {essentialAnalytics ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    We require essential data collection including performance and analytics, in order to operate the Service. 
                    You may remove consent at any time, however doing so would remove your access to the Service.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={essentialAnalytics}
                    onChange={(e) => handleSettingChange('essential_analytics', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Functional */}
            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Functional</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      functional 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {functional ? 'Enabled' : 'Disabled'}
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
                    checked={functional}
                    onChange={(e) => handleSettingChange('functional', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Targeting and Marketing */}
            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Targeting and Marketing</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      targetingMarketing 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {targetingMarketing ? 'Enabled' : 'Disabled'}
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
                    checked={targetingMarketing}
                    onChange={(e) => handleSettingChange('targeting_marketing', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Cookies - Essential */}
            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Cookies - Essential</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      cookiesEssential 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {cookiesEssential ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Essential cookies are required to provide core functionality such as authentication, security, and session 
                    management. You may remove consent at any time, however doing so would remove your access to the Service.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={cookiesEssential}
                    onChange={(e) => handleSettingChange('cookies_essential', e.target.checked)}
                    disabled={saving}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            {/* Cookies - Non-essential */}
            <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">Cookies - Non-essential</h3>
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

            {/* Language */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Language</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Choose your preferred language for the application interface.
                  </p>
                  <select
                    value={language}
                    onChange={(e) => handleSettingChange('language', e.target.value)}
                    disabled={true}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-100 cursor-not-allowed"
                  >
                    <option value="english">English</option>
                    <option value="french">Français (Coming Soon)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">French language support coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: Account Deletion - Separate Danger Zone */}
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
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                Delete My Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
