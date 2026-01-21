'use client';

import { useState } from 'react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSubmitSuccess?: () => void;
}

export default function FeedbackModal({ isOpen, onClose, token, onSubmitSuccess }: FeedbackModalProps) {
  const [usefulness, setUsefulness] = useState<number | null>(null);
  const [trust, setTrust] = useState<number | null>(null);
  const [problems, setProblems] = useState('');
  const [learnMore, setLearnMore] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (usefulness === null || trust === null) {
      setError('Please answer all required questions');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          usefulness,
          trust,
          problems: problems.trim() || undefined,
          learnMore: learnMore.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to submit feedback');
      }

      // Reset form
      setUsefulness(null);
      setTrust(null);
      setProblems('');
      setLearnMore('');
      
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }
      
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const LikertScale = ({ 
    label, 
    value, 
    onChange,
    options
  }: { 
    label: string; 
    value: number | null; 
    onChange: (value: number) => void;
    options: string[];
  }) => {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-start gap-2">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                value === num
                  ? 'bg-blue-50 border-blue-500 shadow-md'
                  : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              <div className={`text-sm text-center font-medium ${value === num ? 'text-blue-700' : 'text-gray-700'}`}>
                {options[num - 1]}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Feedback</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={submitting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <LikertScale
            label="Is the App helpful to understand your spending? *"
            value={usefulness}
            onChange={setUsefulness}
            options={['Very unhelpful', 'Somewhat unhelpful', 'Neutral', 'Somewhat helpful', 'Very helpful']}
          />

          <LikertScale
            label="Do you trust the App? *"
            value={trust}
            onChange={setTrust}
            options={['Not at all', 'Not really', 'Neutral', 'Somewhat', 'Yes']}
          />

          <div>
            <label htmlFor="problems" className="block text-sm font-medium text-gray-700 mb-2">
              Have you been experiencing any problems, bugs or have any complaints with the App? Please let us know and we'll try to fix it.
            </label>
            <textarea
              id="problems"
              value={problems}
              onChange={(e) => setProblems(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Let us know about any issues..."
            />
          </div>

          <div>
            <label htmlFor="learnMore" className="block text-sm font-medium text-gray-700 mb-2">
              What else would you like to learn? What is the most useful visual or data point from the past 6 months of your spending?
            </label>
            <textarea
              id="learnMore"
              value={learnMore}
              onChange={(e) => setLearnMore(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Share your thoughts..."
            />
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
              type="submit"
              disabled={submitting || usefulness === null || trust === null}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

