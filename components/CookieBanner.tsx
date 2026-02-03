'use client';

import { useState, useEffect } from 'react';

interface CookieBannerProps {
  token: string;
  userId: number;
}

export default function CookieBanner({ token, userId }: CookieBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check database for existing consent timestamp
    const checkConsent = async () => {
      try {
        const response = await fetch('/api/consent/check?type=cookie_banner', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.hasConsent) {
            // User has already given consent, don't show banner
            setChoice(data.choice || 'accept_all');
            setIsVisible(false);
          } else {
            // No consent recorded, show banner
            setIsVisible(true);
          }
        } else {
          // On error, show banner to be safe
          console.error('Failed to check cookie consent:', response.status);
          setIsVisible(true);
        }
      } catch (error) {
        console.error('Error checking cookie consent:', error);
        // On error, show banner to be safe
        setIsVisible(true);
      } finally {
        setChecking(false);
      }
    };

    checkConsent();
  }, [token]);

  const handleAcceptAll = async () => {
    // Hide banner immediately for better UX
    setIsVisible(false);
    setChoice('accept_all');
    localStorage.setItem('cookie_consent', 'accept_all');
    
    // Log consent event (fire and forget - don't block UI)
    try {
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin,
        },
        body: JSON.stringify({
          consentType: 'cookie_banner',
          choice: 'accept_all',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to log cookie consent:', response.status, errorData);
      }
    } catch (error) {
      console.error('Failed to log cookie consent:', error);
    }
  };

  const handleEssentialOnly = async () => {
    // Hide banner immediately for better UX
    setIsVisible(false);
    setChoice('essential_only');
    localStorage.setItem('cookie_consent', 'essential_only');
    
    // Log consent event (fire and forget - don't block UI)
    try {
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin,
        },
        body: JSON.stringify({
          consentType: 'cookie_banner',
          choice: 'essential_only',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to log cookie consent:', response.status, errorData);
      }
    } catch (error) {
      console.error('Failed to log cookie consent:', error);
    }
  };

  // Don't show banner while checking or if consent already given
  if (checking || !isVisible || choice) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 p-4">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-gray-700">
            We use non-essential cookies only with your consent to improve the experience. You can accept all cookies, use essential cookies only, or manage your preferences at any time.
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

