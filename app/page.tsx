'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import Login from '@/components/Login';
import InactivityWarning from '@/components/InactivityWarning';
import { apiFetch } from '@/lib/api-client';

export default function Home() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(20);

  useEffect(() => {
    const checkSession = async () => {
      // Check for existing session
      const storedToken = localStorage.getItem('ci.session.token');
      const storedUser = localStorage.getItem('ci.session.user');
      const lastActivityKey = 'ci.session.lastActivity';
      const INACTIVITY_WARNING_MS = 5 * 60 * 1000; // 5 minutes - show warning
      const INACTIVITY_TIMEOUT_MS = INACTIVITY_WARNING_MS + 20 * 1000; // 5 min 20 sec - force logout
      
      // Check for inactivity timeout
      const lastActivity = localStorage.getItem(lastActivityKey);
      if (lastActivity) {
        const lastActivityTime = parseInt(lastActivity, 10);
        const timeSinceActivity = Date.now() - lastActivityTime;
        
        if (timeSinceActivity > INACTIVITY_TIMEOUT_MS) {
          // Session expired due to inactivity
          console.log('[Home] Session expired due to inactivity');
          localStorage.removeItem('ci.session.token');
          localStorage.removeItem('ci.session.user');
          localStorage.removeItem(lastActivityKey);
          setToken(null);
          setUser(null);
          setShowInactivityWarning(false);
          setLoading(false);
          return;
        } else if (timeSinceActivity > INACTIVITY_WARNING_MS) {
          // Show warning if inactive for 5+ minutes
          const remainingTime = Math.ceil((INACTIVITY_TIMEOUT_MS - timeSinceActivity) / 1000);
          setWarningCountdown(Math.max(0, remainingTime));
          setShowInactivityWarning(true);
        }
      }
      
      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        
        // Update last activity time
        localStorage.setItem(lastActivityKey, Date.now().toString());
        
        // Check if user needs to complete onboarding
        try {
          const statusResponse = await apiFetch('/api/onboarding/status', {
            method: 'GET',
          }, () => {
            // On unauthorized, clear session and show login
            localStorage.removeItem('ci.session.token');
            localStorage.removeItem('ci.session.user');
            localStorage.removeItem(lastActivityKey);
            setToken(null);
            setUser(null);
          });
          
          if (statusResponse.data) {
            if (statusResponse.data.needsOnboarding) {
              console.log('[Home] User needs onboarding, redirecting...');
              router.push('/onboarding');
              return;
            }
          }
        } catch (error) {
          console.error('[Home] Error checking onboarding status:', error);
        }
        
        setToken(storedToken);
        setUser(parsedUser);
      }
      setLoading(false);
    };
    
    checkSession();
    
    // Set up inactivity monitoring - check every 10 seconds for more responsive warnings
    const inactivityCheckInterval = setInterval(() => {
      const lastActivityKey = 'ci.session.lastActivity';
      const lastActivity = localStorage.getItem(lastActivityKey);
      const INACTIVITY_WARNING_MS = 5 * 60 * 1000; // 5 minutes
      const INACTIVITY_TIMEOUT_MS = INACTIVITY_WARNING_MS + 20 * 1000; // 5 min 20 sec
      
      if (lastActivity && token) {
        const lastActivityTime = parseInt(lastActivity, 10);
        const timeSinceActivity = Date.now() - lastActivityTime;
        
        if (timeSinceActivity > INACTIVITY_TIMEOUT_MS) {
          // Force logout after 5 minutes 20 seconds of inactivity
          console.log('[Home] Auto-logout due to inactivity');
          handleLogout();
          clearInterval(inactivityCheckInterval);
        } else if (timeSinceActivity > INACTIVITY_WARNING_MS) {
          // Show warning if inactive for 5+ minutes
          const remainingTime = Math.ceil((INACTIVITY_TIMEOUT_MS - timeSinceActivity) / 1000);
          setWarningCountdown(Math.max(0, remainingTime));
          setShowInactivityWarning(true);
        } else {
          setShowInactivityWarning(false);
        }
      }
    }, 10 * 1000); // Check every 10 seconds
    
    return () => clearInterval(inactivityCheckInterval);
  }, [router, token]);
  
  const handleContinueSession = () => {
    // Update last activity time to reset the timer
    localStorage.setItem('ci.session.lastActivity', Date.now().toString());
    setShowInactivityWarning(false);
  };
  
  const handleInactivityTimeout = () => {
    handleLogout();
  };

  const handleLogin = (token: string, user: any) => {
    setToken(token);
    setUser(user);
    localStorage.setItem('ci.session.token', token);
    localStorage.setItem('ci.session.user', JSON.stringify(user));
    // Set last activity time on login
    localStorage.setItem('ci.session.lastActivity', Date.now().toString());
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    // Clear all possible token keys (current and legacy)
    localStorage.removeItem('ci.session.token');
    localStorage.removeItem('ci.session.user');
    localStorage.removeItem('ci.session.lastActivity');
    localStorage.removeItem('token'); // Legacy cleanup
    localStorage.removeItem('user');  // Legacy cleanup
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!token || !user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      {showInactivityWarning && (
        <InactivityWarning
          onContinue={handleContinueSession}
          onTimeout={handleInactivityTimeout}
          timeRemaining={warningCountdown}
        />
      )}
      <Dashboard user={user} token={token} onLogout={handleLogout} />
    </>
  );
}

