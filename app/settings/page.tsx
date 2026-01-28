'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SettingsProps {
  token: string;
  userId: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Settings state
  const [essentialAnalytics, setEssentialAnalytics] = useState(true);
  const [functional, setFunctional] = useState(true);
  const [targetingMarketing, setTargetingMarketing] = useState(false);
  const [cookiesEssential, setCookiesEssential] = useState(true);
  const [cookiesNonEssential, setCookiesNonEssential] = useState(true);
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
    setLoading(false);
  }, [router]);

  const handleSettingChange = async (setting: string, value: boolean) => {
    if (!token || !userId) return;
    
    setSaving(true);
    
    try {
      // Update local state
      switch (setting) {
        case 'essential_analytics':
          setEssentialAnalytics(value);
          break;
        case 'functional':
          setFunctional(value);
          break;
        case 'targeting_marketing':
          setTargetingMarketing(value);
          break;
        case 'cookies_essential':
          setCookiesEssential(value);
          break;
        case 'cookies_non_essential':
          setCookiesNonEssential(value);
          break;
      }
      
      // Log consent event
      await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          consentType: 'settings_update',
          setting,
          value,
        }),
      });
    } catch (error) {
      console.error('Failed to update setting:', error);
      // Revert state on error
      switch (setting) {
        case 'essential_analytics':
          setEssentialAnalytics(!value);
          break;
        case 'functional':
          setFunctional(!value);
          break;
        case 'targeting_marketing':
          setTargetingMarketing(!value);
          break;
        case 'cookies_essential':
          setCookiesEssential(!value);
          break;
        case 'cookies_non_essential':
          setCookiesNonEssential(!value);
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
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Account Settings</h1>
          
          <div className="space-y-8">
            {/* Essential, Performance and Analytics */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Essential, Performance and Analytics</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    We require essential data collection including performance and analytics, in order to operate the Service. 
                    You may remove consent at any time, however doing so would remove your access to the Service.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
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
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Functional</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Functional data helps improve how the Service works for you (for example, remembering your categorisation 
                    preferences or improving reliability). You may turn this off at any time. Doing so may limit certain features 
                    or reduce the overall quality of your experience.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
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
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Targeting and Marketing</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    We do not require targeting or marketing data to operate the Service. You can opt out at any time without 
                    affecting your account or core functionality.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
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
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Cookies - Essential</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Essential cookies are required to provide core functionality such as authentication, security, and session 
                    management. You may remove consent at any time, however doing so would remove your access to the Service.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
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
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Cookies - Non-essential</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Non-essential data is used only for optional features, analytics, or improvements. You may withdraw consent 
                    at any time without losing access to the core Service.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
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

            {/* Account Deletion */}
            <div className="border-b border-gray-200 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Account Deletion</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    You can delete your account at any time from your account settings. This will permanently remove your personal 
                    data from our systems, subject only to limited legal or regulatory retention requirements. Account deletion is irreversible.
                  </p>
                </div>
                <button
                  onClick={handleDeleteAccount}
                  className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>

            {/* Language - Coming Soon */}
            <div className="pb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Language</h3>
                  <p className="text-sm text-gray-600 mt-1">Coming soon</p>
                </div>
                <button
                  disabled
                  className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-md cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

