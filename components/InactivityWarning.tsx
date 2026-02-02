'use client';

import { useEffect, useState } from 'react';

interface InactivityWarningProps {
  onContinue: () => void;
  onTimeout: () => void;
  timeRemaining: number; // in seconds
}

export default function InactivityWarning({ onContinue, onTimeout, timeRemaining }: InactivityWarningProps) {
  const [countdown, setCountdown] = useState(timeRemaining);

  useEffect(() => {
    setCountdown(timeRemaining);
  }, [timeRemaining]);

  useEffect(() => {
    if (countdown <= 0) {
      onTimeout();
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [countdown, onTimeout]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Session Timeout Warning</h2>
        <p className="text-gray-600 mb-4">
          You've been inactive for 5 minutes. Your session will expire in{' '}
          <span className="font-bold text-red-600">{countdown}</span> seconds.
        </p>
        <p className="text-gray-600 mb-6">
          Click "Continue" to keep your session active.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onContinue}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

