'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type TabName = 'categories' | 'analytics' | 'inbox' | 'approved-accounts';

interface Keyword {
  id: number;
  keyword: string;
  category: string;
  label: string;
  score: number;
  language: 'en' | 'fr' | 'both';
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface Merchant {
  id: number;
  merchant_pattern: string;
  category: string;
  label: string;
  score: number;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface GroupedData {
  [category: string]: (Keyword | Merchant)[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>('categories');
  const [viewType, setViewType] = useState<'keywords' | 'merchants'>('keywords');
  const [keywords, setKeywords] = useState<GroupedData>({});
  const [merchants, setMerchants] = useState<GroupedData>({});
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_token');
      
      if (!token) {
        router.push('/admin/login');
        return;
      }

      try {
        const response = await fetch('/api/admin/auth', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error('Invalid token');
        }

        setAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
      } finally {
        setChecking(false);
      }
    };

    checkAuth();
  }, [router]);

  // Fetch data when viewType changes
  useEffect(() => {
    if (activeTab === 'categories' && authenticated) {
      fetchData();
    }
  }, [viewType, activeTab, authenticated]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/view-keywords?type=${viewType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const data = await response.json();
      
      // Handle database not initialized case
      if (data.error === 'Database tables not initialized') {
        setError('Database tables not yet initialized. They will be created automatically when you run the server locally or on first deployment.');
        setKeywords({});
        setMerchants({});
        setStats({ total: 0, byCategory: [] });
        return;
      }
      
      if (viewType === 'keywords') {
        setKeywords(data.grouped);
      } else {
        setMerchants(data.grouped);
      }
      setStats(data.stats);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Render Categories Tab
  const renderCategoriesTab = () => {
    const currentData = viewType === 'keywords' ? keywords : merchants;
    const categories = Object.keys(currentData).sort();
    
    // Filter data based on search and category
    const filteredCategories = selectedCategory === 'all' 
      ? categories 
      : categories.filter(cat => cat === selectedCategory);
    
    const filteredData = filteredCategories.reduce((acc: GroupedData, cat: string) => {
      const items = currentData[cat].filter((item: any) => {
        const searchLower = searchTerm.toLowerCase();
        const keyword = viewType === 'keywords' 
          ? (item as Keyword).keyword 
          : (item as Merchant).merchant_pattern;
        return keyword.toLowerCase().includes(searchLower);
      });
      if (items.length > 0) {
        acc[cat] = items;
      }
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Categorization Patterns</h2>
            <p className="text-gray-600 mt-1">Manage keywords and merchant patterns for auto-categorization</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {/* View Type Toggle */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            onClick={() => setViewType('keywords')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              viewType === 'keywords'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🔤 Keywords
          </button>
          <button
            onClick={() => setViewType('merchants')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              viewType === 'merchants'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🏪 Merchants
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
              <div className="text-sm text-blue-700">Total {viewType === 'keywords' ? 'Keywords' : 'Merchants'}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-900">{stats.byCategory.length}</div>
              <div className="text-sm text-green-700">Categories</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-900">
                {stats.byCategory.reduce((max: number, cat: any) => Math.max(max, cat.count), 0)}
              </div>
              <div className="text-sm text-purple-700">Largest Category</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-900">
                {Math.round(stats.total / stats.byCategory.length)}
              </div>
              <div className="text-sm text-orange-700">Avg per Category</div>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        <div className="flex gap-4">
          <input
            type="text"
            placeholder={`Search ${viewType}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({currentData[cat].length})
              </option>
            ))}
          </select>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            ⚠️ {error}
          </div>
        )}

        {/* Data Display */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading data...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.keys(filteredData).length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-600">No {viewType} found matching your search.</p>
              </div>
            ) : (
              Object.entries(filteredData).map(([category, items]) => (
                <div key={category} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {category} <span className="text-gray-500 text-sm font-normal">({items.length})</span>
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            {viewType === 'keywords' ? 'Keyword' : 'Merchant Pattern'}
                          </th>
                          {viewType === 'keywords' && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Language</th>
                          )}
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {items.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              {viewType === 'keywords' ? item.keyword : item.merchant_pattern}
                            </td>
                            {viewType === 'keywords' && (
                              <td className="px-6 py-4 text-sm text-gray-600">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  item.language === 'en' ? 'bg-blue-100 text-blue-700' :
                                  item.language === 'fr' ? 'bg-purple-100 text-purple-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {item.language.toUpperCase()}
                                </span>
                              </td>
                            )}
                            <td className="px-6 py-4 text-sm text-gray-600">{item.label}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              <span className="font-semibold">{item.score}</span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{item.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  // Render placeholder tabs
  const renderPlaceholderTab = (title: string, description: string, icon: string) => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-gray-600 mt-1">{description}</p>
      </div>
      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Coming Soon</h3>
        <p className="text-gray-500">This feature is under development and will be available tomorrow.</p>
      </div>
    </div>
  );

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };

  // Show loading state while checking authentication
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Manage categorization, analytics, and user accounts</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                System Active
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'categories'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🏷️ Categories
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'analytics'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 Analytics
            </button>
            <button
              onClick={() => setActiveTab('inbox')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'inbox'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📥 Inbox
            </button>
            <button
              onClick={() => setActiveTab('approved-accounts')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'approved-accounts'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ✅ Approved Accounts
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'categories' && renderCategoriesTab()}
        {activeTab === 'analytics' && renderPlaceholderTab('Analytics', 'View categorization performance, user activity, and system metrics', '📊')}
        {activeTab === 'inbox' && renderPlaceholderTab('Inbox', 'Manage bug reports, feature requests, and user feedback', '📥')}
        {activeTab === 'approved-accounts' && renderPlaceholderTab('Approved Accounts', 'Manage beta testers and approved user accounts', '✅')}
      </div>
    </div>
  );
}

