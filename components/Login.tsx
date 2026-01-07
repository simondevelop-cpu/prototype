'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { validatePasswordStrength } from '@/lib/password-validation';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister
        ? { email, password, name }
        : { email, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const errorLines: string[] = [];
        if (data?.error) errorLines.push(String(data.error));
        if (data?.message) errorLines.push(String(data.message));
        if (Array.isArray(data?.details) && data.details.length > 0) {
          errorLines.push(...data.details.map((d: any) => String(d)));
        }
        const errorMessage = errorLines.length > 0 ? errorLines.join('\n') : 'Authentication failed';
        
        // If trying to register with existing email, switch to Sign In mode
        if (isRegister && errorMessage.toLowerCase().includes('already registered')) {
          setIsRegister(false);
          setError('This account already exists. Please sign in below to continue.');
          setLoading(false);
          return;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Store token and user data (standardized keys)
      localStorage.setItem('ci.session.token', data.token);
      localStorage.setItem('ci.session.user', JSON.stringify(data.user));
      
      // If registering, always go to onboarding
      if (isRegister) {
        router.push('/onboarding');
      } else {
        // If logging in, check if they need to complete onboarding
        const statusResponse = await fetch('/api/onboarding/status', {
          headers: {
            'Authorization': `Bearer ${data.token}`
          }
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.needsOnboarding) {
            // User hasn't completed onboarding, redirect there
            console.log('[Login] User needs onboarding, redirecting...');
            router.push('/onboarding');
            return;
          }
        }
        
        // User has completed onboarding, proceed to dashboard
        onLogin(data.token, data.user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setEmail('demo@canadianinsights.ca');
    setPassword('northstar-demo');
    setIsRegister(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-4">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Canadian Insights</h1>
          <p className="text-gray-600 mt-2">Made for Canadians, by Canadians</p>
        </div>

        {/* Auth Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                !isRegister
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                isRegister
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required={isRegister}
                  placeholder="John"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (isRegister) {
                    const res = validatePasswordStrength(e.target.value);
                    setPasswordErrors(res.valid ? [] : res.errors);
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              {isRegister && (
                <div className="mt-2 text-xs text-gray-600">
                  <p className="font-medium">Password requirements:</p>
                  <ul className="list-disc ml-5">
                    <li>At least 8 characters long</li>
                    <li>At least one uppercase letter (A-Z)</li>
                    <li>At least one lowercase letter (a-z)</li>
                    <li>At least one number (0-9)</li>
                    <li>At least one special character (!@#$%^&*()_+-=[]{}|;:,.&lt;&gt;?)</li>
                  </ul>
                  {password && passwordErrors.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                      <p className="font-medium mb-1">Please fix:</p>
                      <ul className="list-disc ml-5">
                        {passwordErrors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Loading...' : (isRegister ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          {!isRegister && (
            <>
              <div className="mt-4 text-center text-sm text-gray-500">
                <span>or</span>
              </div>
              <button
                onClick={handleDemoLogin}
                className="w-full mt-4 bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Try Demo Account
              </button>
              <p className="mt-3 text-xs text-center text-gray-500">
                Explore with pre-populated data
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

