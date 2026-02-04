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
  const [consentAccepted, setConsentAccepted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister && !consentAccepted) {
        setError('You must accept the Terms and Conditions and Privacy Policy to create an account.');
        setLoading(false);
        return;
      }

      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister
        ? { email, password, name, consentAccepted: true }
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
          <div className="inline-flex items-center justify-center w-20 h-20 mb-4">
            <img src="/Humminbird_logo_blue_rounded.png" alt="Hummingbird Finance" className="w-20 h-20 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Hummingbird Finance</h1>
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
            <div className={`mb-4 p-3 border rounded-lg text-sm ${
              error.includes('beta access') || error.includes('pre-approved')
                ? 'bg-red-50 border-red-300 text-red-800 font-medium'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
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
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              {isRegister && (
                <div className="mt-2 text-xs">
                  <p className="font-medium text-gray-700 mb-2">Password requirements:</p>
                  <ul className="space-y-1">
                    {(() => {
                      const requirements = [
                        { label: 'At least 8 characters long', check: password.length >= 8 },
                        { label: 'At least one uppercase letter (A-Z)', check: /[A-Z]/.test(password) },
                        { label: 'At least one lowercase letter (a-z)', check: /[a-z]/.test(password) },
                        { label: 'At least one number (0-9)', check: /[0-9]/.test(password) },
                        { label: 'At least one special character (!@#$%^&*()_+-=[]{}|;:,.&lt;&gt;?)', check: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password) },
                      ];
                      return requirements.map((req, idx) => (
                        <li key={idx} className={`flex items-center gap-2 ${req.check ? 'text-green-600' : 'text-gray-600'}`}>
                          <span className={req.check ? 'text-green-500' : 'text-gray-400'}>
                            {req.check ? '✓' : '○'}
                          </span>
                          <span>{req.label}</span>
                        </li>
                      ));
                    })()}
                  </ul>
                </div>
              )}
            </div>

            {isRegister && (
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  required
                />
                <label htmlFor="consent" className="text-sm text-gray-700">
                  I confirm that I am 18 years of age or older. I consent to the collection and use of my data as described in the{' '}
                  <a href="/privacy-policy" target="_blank" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </a>
                  {' '}and agree to the{' '}
                  <a href="/terms-and-conditions" target="_blank" className="text-blue-600 hover:underline">
                    Terms and Conditions
                  </a>
                  . I understand that my data will be protected with encryption and access controls, and I will be notified of any security incidents. I can withdraw my consent at any time by deleting my account in Account Settings.
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isRegister && !consentAccepted)}
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

