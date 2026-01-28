'use client';

import { useState } from 'react';

interface FirstUploadConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgree: () => void;
  token: string;
}

export default function FirstUploadConsentModal({ isOpen, onClose, onAgree, token }: FirstUploadConsentModalProps) {
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAgree = async () => {
    setSubmitting(true);
    
    try {
      // Log consent event
      await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          consentType: 'first_upload',
          choice: 'agreed',
        }),
      });
      
      // Mark as consented in localStorage
      localStorage.setItem('first_upload_consent', 'true');
      
      onAgree();
    } catch (error) {
      console.error('Failed to log consent:', error);
      // Still proceed even if logging fails
      localStorage.setItem('first_upload_consent', 'true');
      onAgree();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Before You Upload</h2>
        
        <div className="space-y-4 text-gray-700 mb-6">
          <p>
            By uploading a PDF statement, you confirm that you have the right to authorize us to process this information 
            for categorization and insights.
          </p>
          <p>
            You can review, correct, or delete your data at any time in Account Settings. The categorization we provide 
            is for informational purposes only. Please verify all figures and do not rely solely on our outputs for financial decisions.
          </p>
          <p className="font-medium">
            We do not guarantee the accuracy of our categorization, and all outputs are for informational purposes only.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAgree}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Processing...' : 'I understand and agree'}
          </button>
        </div>
      </div>
    </div>
  );
}

