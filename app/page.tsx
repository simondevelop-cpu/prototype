'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from '@/components/Dashboard';
import Login from '@/components/Login';

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
      
      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        
        // Check if user needs to complete onboarding
        try {
          const statusResponse = await fetch('/api/onboarding/status', {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            if (statusData.needsOnboarding) {
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
  }, [router]);

  const handleLogin = (token: string, user: any) => {
    setToken(token);
    setUser(user);
    localStorage.setItem('ci.session.token', token);
    localStorage.setItem('ci.session.user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('ci.session.token');
    localStorage.removeItem('ci.session.user');
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

