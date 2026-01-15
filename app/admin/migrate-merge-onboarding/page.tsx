'use client';

import { useState, useEffect } from 'react';

export default function MigrateMergeOnboarding() {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [migrations, setMigrations] = useState<string[]>([]);
  const [migrationStatus, setMigrationStatus] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const checkStatus = async () => {
    setCheckingStatus(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setCheckingStatus(false);
        return;
      }

      const response = await fetch('/api/admin/migrate-merge-onboarding', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (response.ok) {
        setMigrationStatus(data);
      }
    } catch (error) {
      console.error('Error checking migration status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const runMigration = async () => {
    if (!confirm('Are you sure you want to run this migration? This will merge onboarding_responses data into the users table. This operation is safe and can be run multiple times.')) {
      return;
    }

    setStatus('running');
    setMessage('Running migration...');
    
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setStatus('error');
        setMessage('Not authenticated. Please login as admin first.');
        return;
      }

      const response = await fetch('/api/admin/migrate-merge-onboarding', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message || 'Migration completed successfully');
        setMigrations(data.migrations || []);
        // Refresh status after migration
        setTimeout(() => checkStatus(), 1000);
      } else {
        setStatus('error');
        setMessage(data.error || data.details || 'Migration failed');
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Merge Onboarding into Users Migration
          </h1>
          
          <p className="text-gray-600 mb-6">
            This migration merges non-PII onboarding data from <code className="bg-gray-100 px-2 py-1 rounded">onboarding_responses</code> into the <code className="bg-gray-100 px-2 py-1 rounded">users</code> table.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">What this migration does:</h3>
            <ul className="list-disc list-inside text-blue-800 space-y-1 text-sm">
              <li>Adds onboarding columns to <code className="bg-blue-100 px-1 rounded">users</code> table</li>
              <li>Adds <code className="bg-blue-100 px-1 rounded">is_active</code> and <code className="bg-blue-100 px-1 rounded">email_validated</code> columns</li>
              <li>Creates indexes for filtering/analytics</li>
              <li>Migrates data from <code className="bg-blue-100 px-1 rounded">onboarding_responses</code> to <code className="bg-blue-100 px-1 rounded">users</code></li>
              <li>PII remains isolated in <code className="bg-blue-100 px-1 rounded">l0_pii_users</code> table</li>
            </ul>
          </div>

          {/* Migration Status */}
          {migrationStatus && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Migration Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Migration Completed:</span>
                  <span className={`font-semibold ${migrationStatus.migrationCompleted ? 'text-green-600' : 'text-orange-600'}`}>
                    {migrationStatus.migrationCompleted ? '✅ Yes' : '❌ No'}
                  </span>
                </div>
                {migrationStatus.dataMigration && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-sm text-gray-600 mb-2">Data Migration:</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Migrated Users:</span>
                        <span className="font-medium">{migrationStatus.dataMigration.migratedCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total with Onboarding:</span>
                        <span className="font-medium">{migrationStatus.dataMigration.totalWithOnboarding}</span>
                      </div>
                      {migrationStatus.dataMigration.totalWithOnboarding > 0 && (
                        <div className="flex justify-between">
                          <span>Percentage:</span>
                          <span className="font-medium">{migrationStatus.dataMigration.percentageMigrated}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {migrationStatus.dataMigration?.unmigratedUsers && migrationStatus.dataMigration.unmigratedUsers.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-orange-200">
                    <p className="text-sm font-medium text-orange-700 mb-2">
                      ⚠️ Found {migrationStatus.dataMigration.unmigratedUsers.length} user(s) that may need migration:
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto text-xs text-gray-600">
                      {migrationStatus.dataMigration.unmigratedUsers.map((user: any, idx: number) => (
                        <div key={idx}>
                          User {user.id} ({user.email}): Has onboarding data but not migrated
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      💡 Tip: Re-running migration will attempt to migrate these users.
                    </p>
                  </div>
                )}
                <button
                  onClick={checkStatus}
                  disabled={checkingStatus}
                  className="mt-3 text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                >
                  {checkingStatus ? 'Refreshing...' : '🔄 Refresh Status'}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={runMigration}
            disabled={status === 'running' || migrationStatus?.migrationCompleted}
            className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
              status === 'running' || migrationStatus?.migrationCompleted
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {status === 'running' ? 'Running Migration...' : 
             migrationStatus?.migrationCompleted ? 'Migration Already Completed' :
             'Run Migration'}
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
              <strong>Note:</strong> This migration is safe to run multiple times. It uses <code className="bg-yellow-100 px-1 rounded">IF NOT EXISTS</code> and <code className="bg-yellow-100 px-1 rounded">DISTINCT ON</code> to prevent duplicates. The code is schema-adaptive and works both before and after migration.
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

