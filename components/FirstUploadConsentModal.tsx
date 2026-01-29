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
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin,
        },
        body: JSON.stringify({
          consentType: 'first_upload',
          choice: 'agreed',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to log first upload consent:', response.status, errorData);
        // Still proceed even if logging fails
      } else {
        console.log('First upload consent logged successfully');
      }
      
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Before You Upload</h2>
        
        <div className="space-y-4 text-gray-700 mb-6">
          <p>
            By uploading a PDF statement, you confirm you have the right to do so and authorize us to process it to generate categories and insights. We only store your financial transaction data. We never store your account numbers or similar information.
          </p>
          <p>
            You may review, correct, or delete your data at any time on the transactions tab. Categorization is for information only. Please verify important figures before making decisions. We do not, and cannot, guarantee 100% accuracy, but we'll do our best. Outputs are provided for informational purposes only.
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

