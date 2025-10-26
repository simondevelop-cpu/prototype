'use client';

import { useState } from 'react';

export default function MigrateOnboardingSchema() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [migrations, setMigrations] = useState<string[]>([]);

  const runMigration = async () => {
    setStatus('running');
    setMessage('Running migration...');
    
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setStatus('error');
        setMessage('Not authenticated. Please login as admin first.');
        return;
      }

      const response = await fetch('/api/admin/migrate-onboarding-schema', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message);
        setMigrations(data.migrations || []);
      } else {
        setStatus('error');
        setMessage(data.error || 'Migration failed');
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Onboarding Schema Migration
          </h1>
          
          <p className="text-gray-600 mb-6">
            This will add missing columns to the <code className="bg-gray-100 px-2 py-1 rounded">onboarding_responses</code> table:
          </p>

          <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
            <li><code className="bg-gray-100 px-2 py-1 rounded">last_step</code> - Track which step user completed</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">completed_at</code> - Timestamp of completion</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">acquisition_other</code> - Free text for "Other" acquisition source</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">updated_at</code> - Last update timestamp</li>
          </ul>

          <button
            onClick={runMigration}
            disabled={status === 'running'}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
              status === 'running'
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {status === 'running' ? 'Running Migration...' : 'Run Migration'}
          </button>

          {message && (
            <div className={`mt-6 p-4 rounded-lg ${
              status === 'success' ? 'bg-green-50 border border-green-200' :
              status === 'error' ? 'bg-red-50 border border-red-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <p className={`font-semibold ${
                status === 'success' ? 'text-green-800' :
                status === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {message}
              </p>

              {migrations.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {migrations.map((migration, index) => (
                    <li key={index} className="text-green-700 flex items-center">
                      <span className="mr-2">✅</span>
                      {migration}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This migration is safe to run multiple times. It will only add columns that don't already exist.
            </p>
          </div>

          <div className="mt-6">
            <a
              href="/admin"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Admin Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

