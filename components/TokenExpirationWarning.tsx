'use client';

import { useState, useEffect } from 'react';
import { shouldShowExpirationWarning, getTimeUntilExpiration, refreshToken } from '@/lib/api-client';

interface TokenExpirationWarningProps {
  token: string | null;
  onRefresh?: (newToken: string) => void;
}

export default function TokenExpirationWarning({ token, onRefresh }: TokenExpirationWarningProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!token) {
      setShowWarning(false);
      return;
    }

    const checkExpiration = () => {
      const shouldShow = shouldShowExpirationWarning(token);
      setShowWarning(shouldShow);
      
      if (shouldShow) {
        const timeLeft = getTimeUntilExpiration(token);
        setTimeRemaining(timeLeft);
      }
    };

    // Check immediately
    checkExpiration();

    // Check every 10 seconds
    const interval = setInterval(checkExpiration, 10000);

    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (showWarning && timeRemaining !== null) {
      // Update time remaining every second
      const interval = setInterval(() => {
        const newTime = getTimeUntilExpiration(token);
        setTimeRemaining(newTime);
        
        if (newTime === null || newTime <= 0) {
          setShowWarning(false);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [showWarning, timeRemaining, token]);

  const handleRefresh = async () => {
    if (!token || isRefreshing) return;

    setIsRefreshing(true);
    try {
      const newToken = await refreshToken(token);
      if (newToken) {
        setShowWarning(false);
        if (onRefresh) {
          onRefresh(newToken);
        }
      } else {
        // Refresh failed, will be handled by apiFetch
        setShowWarning(false);
      }
    } catch (error) {
      console.error('[TokenWarning] Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!showWarning || timeRemaining === null || timeRemaining <= 0) {
    return null;
  }

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return (
    <div className="fixed top-4 right-4 z-50 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-lg max-w-md">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Your session is about to expire
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              Your session will expire in {minutes}m {seconds}s. 
              Click "Refresh Session" to stay logged in.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 text-sm font-medium text-yellow-800 bg-yellow-100 rounded hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Session'}
            </button>
            <button
              onClick={() => setShowWarning(false)}
              className="px-3 py-1.5 text-sm font-medium text-yellow-800 hover:text-yellow-900"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

