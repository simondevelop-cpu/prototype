'use client';

import { useState, useEffect } from 'react';

interface CookieBannerProps {
  token: string;
  userId: number;
}

export default function CookieBanner({ token, userId }: CookieBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has already made a cookie choice
    const cookieChoice = localStorage.getItem('cookie_consent');
    if (!cookieChoice) {
      setIsVisible(true);
    } else {
      setChoice(cookieChoice);
    }
  }, []);

  const handleAcceptAll = async () => {
    // Log consent event FIRST (before hiding banner)
    try {
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin, // Add Origin header for CSRF check
        },
        body: JSON.stringify({
          consentType: 'cookie_banner',
          choice: 'accept_all',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to log cookie consent:', response.status, errorData);
        // Don't hide banner if logging failed
        return;
      } else {
        console.log('Cookie consent logged successfully');
      }
    } catch (error) {
      console.error('Failed to log cookie consent:', error);
      // Don't hide banner if logging failed
      return;
    }
    
    // Only update UI if logging succeeded
    localStorage.setItem('cookie_consent', 'accept_all');
    setChoice('accept_all');
    setIsVisible(false);
  };

  const handleEssentialOnly = async () => {
    // Log consent event FIRST (before hiding banner)
    try {
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin, // Add Origin header for CSRF check
        },
        body: JSON.stringify({
          consentType: 'cookie_banner',
          choice: 'essential_only',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to log cookie consent:', response.status, errorData);
        // Don't hide banner if logging failed
        return;
      } else {
        console.log('Cookie consent logged successfully');
      }
    } catch (error) {
      console.error('Failed to log cookie consent:', error);
      // Don't hide banner if logging failed
      return;
    }
    
    // Only update UI if logging succeeded
    localStorage.setItem('cookie_consent', 'essential_only');
    setChoice('essential_only');
    setIsVisible(false);
  };

  if (!isVisible || choice) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 p-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-700">
            We use cookies to improve your experience. Non-essential cookies help us understand how you use the app. 
            You can accept all cookies, use essential cookies only, or manage your preferences in Account Settings.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleEssentialOnly}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Essential cookies only
          </button>
          <button
            onClick={handleAcceptAll}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Accept all cookies
          </button>
        </div>
      </div>
    </div>
  );
}

