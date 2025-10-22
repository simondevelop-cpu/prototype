'use client';

import { useState, useEffect } from 'react';
import Dashboard from '@/components/Dashboard';
import Login from '@/components/Login';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedToken = localStorage.getItem('ci.session.token');
    const storedUser = localStorage.getItem('ci.session.user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

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

