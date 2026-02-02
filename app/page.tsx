'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import Login from '@/components/Login';
import { apiFetch } from '@/lib/api-client';

export default function Home() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      // Check for existing session
      const storedToken = localStorage.getItem('ci.session.token');
      const storedUser = localStorage.getItem('ci.session.user');
      const lastActivityKey = 'ci.session.lastActivity';
      const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
      
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
          setLoading(false);
          return;
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
    
    // Set up inactivity monitoring - check every minute
    const inactivityCheckInterval = setInterval(() => {
      const lastActivityKey = 'ci.session.lastActivity';
      const lastActivity = localStorage.getItem(lastActivityKey);
      const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
      
      if (lastActivity && token) {
        const lastActivityTime = parseInt(lastActivity, 10);
        const timeSinceActivity = Date.now() - lastActivityTime;
        
        if (timeSinceActivity > INACTIVITY_TIMEOUT_MS) {
          // Force logout after 30 minutes of inactivity
          console.log('[Home] Auto-logout due to inactivity');
          handleLogout();
          clearInterval(inactivityCheckInterval);
        }
      }
    }, 60 * 1000); // Check every minute
    
    return () => clearInterval(inactivityCheckInterval);
  }, [router, token]);

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

  return <Dashboard user={user} token={token} onLogout={handleLogout} />;
}

