'use client';

import { useState } from 'react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  time: string;
  token: string;
}

export default function BookingModal({ isOpen, onClose, date, time, token }: BookingModalProps) {
  const [preferredMethod, setPreferredMethod] = useState<'teams' | 'google-meet' | 'phone' | ''>('');
  const [shareScreen, setShareScreen] = useState<boolean | null>(null);
  const [recordConversation, setRecordConversation] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!preferredMethod) {
      setError('Please select a preferred method');
      return;
    }

    if ((preferredMethod === 'teams' || preferredMethod === 'google-meet') && (shareScreen === null || recordConversation === null)) {
      setError('Please answer all questions');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin,
        },
        body: JSON.stringify({
          bookingDate: date,
          bookingTime: time.includes(':') ? time : `${time}:00`, // Ensure HH:MM format
          preferredMethod,
          shareScreen: preferredMethod === 'phone' ? null : shareScreen,
          recordConversation: preferredMethod === 'phone' ? null : recordConversation,
          notes: notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to book appointment');
      }

      // Reset form
      setPreferredMethod('');
      setShareScreen(null);
      setRecordConversation(null);
      setNotes('');
      
      // Close modal
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to book appointment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Book a 20-minute chat</h2>
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(date)} at {time}
              </p>
            </div>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred method *
            </label>
            <select
              value={preferredMethod}
              onChange={(e) => {
                const method = e.target.value as 'teams' | 'google-meet' | 'phone' | '';
                setPreferredMethod(method);
                if (method === 'phone') {
                  setShareScreen(null);
                  setRecordConversation(null);
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              required
            >
              <option value="">Select a method...</option>
              <option value="teams">Microsoft Teams</option>
              <option value="google-meet">Google Meet</option>
              <option value="phone">Phone call</option>
            </select>
          </div>

          {(preferredMethod === 'teams' || preferredMethod === 'google-meet') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Are you ok to share screen? *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="shareScreen"
                      value="yes"
                      checked={shareScreen === true}
                      onChange={() => setShareScreen(true)}
                      className="mr-2"
                      required
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="shareScreen"
                      value="no"
                      checked={shareScreen === false}
                      onChange={() => setShareScreen(false)}
                      className="mr-2"
                      required
                    />
                    No
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Are you ok if we record the conversation? *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="recordConversation"
                      value="yes"
                      checked={recordConversation === true}
                      onChange={() => setRecordConversation(true)}
                      className="mr-2"
                      required
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="recordConversation"
                      value="no"
                      checked={recordConversation === false}
                      onChange={() => setRecordConversation(false)}
                      className="mr-2"
                      required
                    />
                    No
                  </label>
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Is there anything in particular you want help? Let us know if we should bring someone from a specific team.
            </label>
            {(() => {
              const wordCount = notes.trim().split(/\s+/).filter(Boolean).length;
              const maxWords = 200;
              return (
                <>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      // Enforce 200 word limit - prevent typing beyond limit
                      const words = newValue.trim().split(/\s+/).filter(Boolean);
                      if (words.length <= maxWords) {
                        setNotes(newValue);
                      }
                    }}
                    rows={4}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none ${
                      wordCount >= maxWords ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Optional: Share any specific topics, questions, or team members..."
                  />
                  {wordCount >= maxWords && (
                    <p className="text-sm text-red-600 mt-1">200 word maximum</p>
                  )}
                </>
              );
            })()}
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
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Requesting...' : 'Request a meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

