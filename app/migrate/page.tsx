'use client';

import { useState } from 'react';

export default function MigratePage() {
  const [output, setOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkSchema = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/migrate-schema');
      const data = await res.json();
      setOutput({
        type: 'info',
        title: 'Current Schema Status',
        data,
      });
    } catch (error: any) {
      setOutput({
        type: 'error',
        title: 'Failed to check schema',
        data: error.message,
      });
    }
    setLoading(false);
  };

  const runMigration = async () => {
    if (!confirm('Are you sure you want to run the migration? This will modify your database schema.')) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/migrate-schema', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        setOutput({
          type: 'success',
          title: 'Migration completed successfully!',
          data,
        });
      } else {
        setOutput({
          type: 'error',
          title: 'Migration failed',
          data,
        });
      }
    } catch (error: any) {
      setOutput({
        type: 'error',
        title: 'Migration request failed',
        data: error.message,
      });
    }
    setLoading(false);
  };

  const verifyMigration = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/migrate-schema');
      const data = await res.json();
      
      const needsMigration = data.needs_migration;
      const allGood = 
        !needsMigration.keywords_has_score &&
        !needsMigration.keywords_has_language &&
        !needsMigration.merchants_has_score &&
        needsMigration.merchants_has_alternate_patterns;
      
      if (allGood) {
        setOutput({
          type: 'success',
          title: '✅ Migration verified! Schema is up to date.',
          data: {
            keywords: 'No score/language columns ✓',
            merchants: 'Has alternate_patterns, no score ✓'
          },
        });
      } else {
        setOutput({
          type: 'error',
          title: 'Migration incomplete or not run yet',
          data: data.needs_migration,
        });
      }
    } catch (error: any) {
      setOutput({
        type: 'error',
        title: 'Verification failed',
        data: error.message,
      });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🔧 Database Schema Migration
          </h1>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="font-semibold text-blue-900 mb-2">What this does:</p>
            <ul className="list-disc list-inside text-blue-800 space-y-1">
              <li>Removes <code className="bg-blue-100 px-1 rounded">score</code> and <code className="bg-blue-100 px-1 rounded">language</code> from admin_keywords</li>
              <li>Removes <code className="bg-blue-100 px-1 rounded">score</code> from admin_merchants</li>
              <li>Adds <code className="bg-blue-100 px-1 rounded">alternate_patterns TEXT[]</code> to admin_merchants</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={checkSchema}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              1️⃣ Check Current Schema
            </button>
            
            <button
              onClick={runMigration}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              2️⃣ Run Migration
            </button>
            
            <button
              onClick={verifyMigration}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
            >
              3️⃣ Verify Migration
            </button>
          </div>

          {loading && (
            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-gray-700">Processing...</span>
              </div>
            </div>
          )}

          {output && !loading && (
            <div className={`rounded-lg p-4 ${
              output.type === 'success' ? 'bg-green-50 border border-green-200' :
              output.type === 'error' ? 'bg-red-50 border border-red-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <p className={`font-semibold mb-3 ${
                output.type === 'success' ? 'text-green-900' :
                output.type === 'error' ? 'text-red-900' :
                'text-blue-900'
              }`}>
                {output.title}
              </p>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto text-sm">
                {JSON.stringify(output.data, null, 2)}
              </pre>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>After migration:</strong> Upload a bank statement and check the browser console. 
              You should see: <code className="bg-gray-100 px-1 rounded text-xs">✓ MERCHANT MATCH! "FIDO" → Bills/Phone</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

