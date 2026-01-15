'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { invalidatePatternCache } from '@/lib/categorization-engine';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CheckboxDropdown from '@/components/CheckboxDropdown';

type TabName = 'monitoring' | 'inbox' | 'categories' | 'insights' | 'analytics';
type MonitoringSubTab = 'accounts' | 'health';

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
  const [activeTab, setActiveTab] = useState<TabName>('monitoring');
  const [monitoringSubTab, setMonitoringSubTab] = useState<MonitoringSubTab>('accounts');
  const [viewType, setViewType] = useState<'keywords' | 'merchants' | 'recategorization'>('keywords');
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'cohort-analysis' | 'customer-data' | 'vanity-metrics'>('cohort-analysis');
  const [keywords, setKeywords] = useState<GroupedData>({});
  const [merchants, setMerchants] = useState<GroupedData>({});
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  
  // State for Accounts tab
  const [users, setUsers] = useState<any[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  
  // State for Recategorization Log tab
  const [recategorizations, setRecategorizations] = useState<any[]>([]);
  const [recatLoading, setRecatLoading] = useState(false);
  const [reviewed, setReviewed] = useState<{[key: number]: boolean}>({});
  
  // State for Customer Data tab
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [customerDataLoading, setCustomerDataLoading] = useState(false);
  
  // State for App Health tab
  const [healthData, setHealthData] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  
  // State for Analytics Dashboard (Cohort Analysis & Vanity Metrics)
  const [cohortData, setCohortData] = useState<any>(null);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [vanityData, setVanityData] = useState<any>(null);
  const [vanityLoading, setVanityLoading] = useState(false);
  const [intentCategories, setIntentCategories] = useState<string[]>([]);
  const [intentCategoriesLoading, setIntentCategoriesLoading] = useState(false);
  const [cohortFilters, setCohortFilters] = useState({
    totalAccounts: true,
    validatedEmails: false,
    intentCategories: [] as string[],
  });
  const [vanityFilters, setVanityFilters] = useState({
    totalAccounts: true,
    validatedEmails: false,
    intentCategories: [] as string[],
  });
  const [engagementChartData, setEngagementChartData] = useState<any>(null);
  const [engagementChartLoading, setEngagementChartLoading] = useState(false);
  const [chartFilters, setChartFilters] = useState({
    cohorts: [] as string[],
    intentCategories: [] as string[],
    dataCoverage: [] as string[],
    userIds: [] as number[],
  });

  // Fetch customer data function (used by Refresh button and initial load)
  const fetchCustomerData = async () => {
    setCustomerDataLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/customer-data', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setCustomerData(data.customerData || []);
    } catch (error) {
      console.error('Error fetching customer data:', error);
    } finally {
      setCustomerDataLoading(false);
    }
  };

  // Fetch cohort analysis data
  const fetchCohortAnalysis = async () => {
    setCohortLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        totalAccounts: cohortFilters.totalAccounts.toString(),
        validatedEmails: cohortFilters.validatedEmails.toString(),
        intentCategories: cohortFilters.intentCategories.join(','),
      });
      const response = await fetch(`/api/admin/cohort-analysis?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setCohortData(data);
      }
    } catch (error) {
      console.error('Error fetching cohort analysis:', error);
    } finally {
      setCohortLoading(false);
    }
  };

  // Fetch vanity metrics data
  const fetchVanityMetrics = async () => {
    setVanityLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        totalAccounts: vanityFilters.totalAccounts.toString(),
        validatedEmails: vanityFilters.validatedEmails.toString(),
        intentCategories: vanityFilters.intentCategories.join(','),
      });
      const response = await fetch(`/api/admin/vanity-metrics?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setVanityData(data);
      }
    } catch (error) {
      console.error('Error fetching vanity metrics:', error);
    } finally {
      setVanityLoading(false);
    }
  };

  // Fetch engagement chart data
  const fetchEngagementChart = async () => {
    setEngagementChartLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const params = new URLSearchParams({
        cohorts: chartFilters.cohorts.join(','),
        intentCategories: chartFilters.intentCategories.join(','),
        dataCoverage: chartFilters.dataCoverage.join(','),
        userIds: chartFilters.userIds.join(','),
      });
      const response = await fetch(`/api/admin/engagement-chart?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setEngagementChartData(data);
      }
    } catch (error) {
      console.error('Error fetching engagement chart:', error);
    } finally {
      setEngagementChartLoading(false);
    }
  };

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

  // Fetch users when Accounts tab is active
  // Fetch users function (used by Accounts tab and block button)
  const fetchUsers = async () => {
    setAccountsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'monitoring' && monitoringSubTab === 'accounts' && authenticated) {
      fetchUsers();
    }
  }, [activeTab, monitoringSubTab, authenticated]);

  // Fetch recategorizations when Recategorization Log tab is active
  useEffect(() => {
    if (activeTab === 'categories' && viewType === 'recategorization' && authenticated) {
      const fetchRecategorizations = async () => {
        setRecatLoading(true);
        try {
          const token = localStorage.getItem('admin_token');
          const response = await fetch('/api/admin/recategorizations', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await response.json();
          setRecategorizations(data.recategorizations || []);
        } catch (error) {
          console.error('Error fetching recategorizations:', error);
        } finally {
          setRecatLoading(false);
        }
      };
      fetchRecategorizations();
    }
  }, [activeTab, viewType, authenticated]);

  // Fetch customer data when Analytics → Customer Data tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && analyticsSubTab === 'customer-data' && authenticated) {
      fetchCustomerData();
    }
  }, [activeTab, analyticsSubTab, authenticated]);

  // Fetch intent categories
  const fetchIntentCategories = async () => {
    setIntentCategoriesLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/intent-categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setIntentCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching intent categories:', error);
    } finally {
      setIntentCategoriesLoading(false);
    }
  };

  // Fetch cohort analysis when Analytics → Cohort Analysis tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && analyticsSubTab === 'cohort-analysis' && authenticated) {
      fetchIntentCategories();
      fetchCohortAnalysis();
      fetchEngagementChart();
    }
  }, [activeTab, analyticsSubTab, authenticated, cohortFilters, chartFilters]);

  // Fetch vanity metrics when Analytics → Vanity Metrics tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && analyticsSubTab === 'vanity-metrics' && authenticated) {
      fetchIntentCategories();
      fetchVanityMetrics();
    }
  }, [activeTab, analyticsSubTab, authenticated, vanityFilters]);

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
    return (
      <div className="space-y-6">
        {/* Auto-Categorization Logic Explanation */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-900 mb-3">Logic of the current auto-categorisation engine (in priority order):</p>
          <ol className="space-y-2 text-sm text-gray-700">
            <li>
              <span className="font-semibold text-gray-900">1. User history</span> – First check if the user has previously recategorised a similar item
            </li>
            <li>
              <span className="font-semibold text-gray-900">2. Merchant check</span> – A category if the merchant list below (or any of the alternative spellings) show up in the description with or without spaces.
            </li>
            <li>
              <span className="font-semibold text-gray-900">3. Keyword search (first match)</span> – We search by category priority: Housing → Bills → Subscriptions → Food → Travel → Health → Transport → Education → Personal → Shopping → Work. The first matching keyword wins.
            </li>
          </ol>
          <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-blue-200">
            Manage keywords and merchants below. All changes immediately affect categorization for future uploads. Matching is case-insensitive and space-insensitive.
          </p>
        </div>

        {/* Three Sub-Tabs Side by Side */}
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
          <button
            onClick={() => setViewType('recategorization')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              viewType === 'recategorization'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            🔄 Recategorization Log
          </button>
        </div>

        {/* Conditional Content: Recategorization Log or Patterns Table */}
        {viewType === 'recategorization' ? (
          renderRecategorizationLog()
        ) : (
          renderKeywordsMerchantsContent()
        )}
      </div>
    );
  };

  // Render Keywords/Merchants Content (separated for type safety)
  const renderKeywordsMerchantsContent = () => {
    const currentData = viewType === 'keywords' ? keywords : merchants;
    
    // Flatten all items into a single array with category
    const allItems = Object.entries(currentData).flatMap(([category, items]) =>
      items.map(item => ({ ...item, category }))
    );
    
    // Get unique values for filters
    const allCategories = Array.from(new Set(allItems.map(item => item.category))).sort();
    const allLabels = Array.from(new Set(allItems.map(item => item.label).filter(Boolean))).sort();
    
    // Apply filters
    const filteredItems = allItems.filter((item: any) => {
      const searchLower = searchTerm.toLowerCase();
      const keyword = viewType === 'keywords' 
        ? item.keyword 
        : item.merchant_pattern;
      
      // Search filter (with null checks)
      const matchesSearch = (keyword?.toLowerCase() || '').includes(searchLower) ||
        (item.label?.toLowerCase() || '').includes(searchLower) ||
        (item.category?.toLowerCase() || '').includes(searchLower);
      
      // Category filter
      const matchesCategory = selectedCategories.length === 0 || 
        selectedCategories.includes(item.category);
      
      // Label filter
      const matchesLabel = selectedLabels.length === 0 || 
        selectedLabels.includes(item.label);
      
      return matchesSearch && matchesCategory && matchesLabel;
    });
    
    const clearFilters = () => {
      setSearchTerm('');
      setSelectedCategories([]);
      setSelectedLabels([]);
    };
    
    const hasActiveFilters = searchTerm !== '' || selectedCategories.length > 0 || selectedLabels.length > 0;

    return (
      <div className="space-y-6">
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
                {stats.byCategory.length > 0 ? Math.round(stats.total / stats.byCategory.length) : 0}
              </div>
              <div className="text-sm text-orange-700">Avg per Category</div>
            </div>
          </div>
        )}

        {/* Search & Filter (only for Keywords/Merchants tabs) */}
        {viewType !== 'recategorization' && (
          <div className="flex gap-4 items-center">
            <input
              type="text"
              placeholder={`Search ${viewType}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
              >
                Clear Filters
              </button>
            )}
            
            {selectedItems.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap font-medium"
              >
                Delete Selected ({selectedItems.length})
              </button>
            )}
            
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap font-medium"
            >
              + Add {viewType === 'keywords' ? 'Keyword' : 'Merchant'}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            ⚠️ {error}
          </div>
        )}

        {/* Patterns Table */}
        {renderPatternsTable(allItems, filteredItems, allCategories, allLabels, hasActiveFilters)}
      </div>
    );
  };

  // Render Recategorization Log
  const renderRecategorizationLog = () => {
    const handleReviewToggle = (id: number) => {
      setReviewed(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return recatLoading ? (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
      </div>
    ) : (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Frequency</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Last Used</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Reviewed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {recategorizations.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{item.description_pattern}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.user_email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">{item.corrected_category}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{item.corrected_label}</td>
                <td className="px-6 py-4 text-center text-sm text-gray-600">{item.frequency}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {item.last_used ? new Date(item.last_used).toLocaleDateString() : '-'}
                </td>
                <td className="px-6 py-4 text-center">
                  <input
                    type="checkbox"
                    checked={reviewed[item.id] || false}
                    onChange={() => handleReviewToggle(item.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {recategorizations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No recategorizations found
          </div>
        )}
      </div>
    );
  };

  // Render Patterns Table (existing Keywords/Merchants UI)
  const renderPatternsTable = (allItems: any[], filteredItems: any[], allCategories: string[], allLabels: string[], hasActiveFilters: boolean) => {
    return (
      <>
        {/* Data Display */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading data...</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-600">No {viewType} found matching your search.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left whitespace-nowrap w-12">
                        <input
                          type="checkbox"
                          checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(filteredItems.map((item: any) => item.id));
                            } else {
                              setSelectedItems([]);
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        {viewType === 'keywords' ? 'Keyword' : 'Merchant Pattern'}
                      </th>
                      {viewType === 'merchants' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          Alternate Patterns
                        </th>
                      )}
                      <ColumnFilterHeader
                        label="Category"
                        options={allCategories}
                        selected={selectedCategories}
                        onChange={setSelectedCategories}
                      />
                      <ColumnFilterHeader
                        label="Label"
                        options={allLabels}
                        selected={selectedLabels}
                        onChange={setSelectedLabels}
                      />
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                        {editingItemId ? 'Save' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredItems.map((item: any) => {
                      const isEditing = editingItemId === item.id;
                      const itemKey = viewType === 'keywords' ? item.keyword : item.merchant_pattern;
                      
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4 text-sm">
                            <input
                              type="checkbox"
                              checked={selectedItems.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItems([...selectedItems, item.id]);
                                } else {
                                  setSelectedItems(selectedItems.filter(id => id !== item.id));
                                }
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td 
                            className="px-6 py-4 text-sm font-medium text-gray-900 cursor-pointer"
                            onDoubleClick={() => startEditing(item, 'keyword')}
                          >
                            {isEditing && editingField === 'keyword' ? (
                              <input
                                type="text"
                                value={editFormData.keyword || itemKey}
                                onChange={(e) => setEditFormData({ ...editFormData, keyword: e.target.value.toUpperCase() })}
                                className="w-full px-2 py-1 border border-blue-500 rounded"
                                autoFocus
                              />
                            ) : (
                              itemKey
                            )}
                          </td>
                          {viewType === 'merchants' && (
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {item.alternate_patterns && item.alternate_patterns.length > 0 
                                ? item.alternate_patterns.join(', ') 
                                : '-'}
                            </td>
                          )}
                          <td 
                            className="px-6 py-4 text-sm text-gray-600 cursor-pointer"
                            onDoubleClick={() => startEditing(item, 'category')}
                          >
                            {isEditing && editingField === 'category' ? (
                              <select
                                value={editFormData.category || item.category}
                                onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                                className="w-full px-2 py-1 border border-blue-500 rounded"
                                autoFocus
                              >
                                {allCategories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">{item.category}</span>
                            )}
                          </td>
                          <td 
                            className="px-6 py-4 text-sm text-gray-600 cursor-pointer"
                            onDoubleClick={() => startEditing(item, 'label')}
                          >
                            {isEditing && editingField === 'label' ? (
                              <input
                                type="text"
                                value={editFormData.label || item.label || ''}
                                onChange={(e) => setEditFormData({ ...editFormData, label: e.target.value })}
                                className="w-full px-2 py-1 border border-blue-500 rounded"
                                autoFocus
                              />
                            ) : (
                              item.label || '-'
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-right">
                            <div className="flex justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveEdit(item)}
                                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors text-xs font-medium"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </>
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

  // Render Accounts Tab
  const renderAccountsTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Unique Users</h2>
          <p className="text-gray-600 mt-1">View all user registrations and account status</p>
        </div>

        {accountsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Login Attempts</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validated Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user, index) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{users.length - index}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{user.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.login_attempts || 0}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.status === 'Active Account' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email_validated ? 'True' : 'False'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={async () => {
                          const userId = user.id || user.user_id;
                          const currentStatus = user.is_active !== undefined ? user.is_active : true;
                          const newStatus = !currentStatus;
                          try {
                            const token = localStorage.getItem('admin_token');
                            if (!token) {
                              alert('Not authenticated. Please log in again.');
                              return;
                            }
                            const response = await fetch('/api/admin/users/block', {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                userId: userId,
                                isActive: newStatus,
                              }),
                            });
                            const data = await response.json();
                            if (response.ok) {
                              // Refresh users list
                              fetchUsers();
                            } else {
                              alert(`Failed to ${newStatus ? 'enable' : 'block'} user: ${data.error || 'Unknown error'}`);
                            }
                          } catch (error: any) {
                            console.error('Error blocking user:', error);
                            alert(`Error updating user status: ${error.message || 'Unknown error'}`);
                          }
                        }}
                        className={`px-3 py-1 rounded text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        } transition-colors`}
                      >
                        {user.is_active ? 'Access Enabled' : 'Blocked'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No users registered yet
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render Analytics Tab
  const renderAnalyticsTab = () => {
    const renderPlaceholder = (title: string) => (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600">Coming soon...</p>
      </div>
    );

    return (
      <div className="space-y-6">
        {/* Sub-tabs */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            onClick={() => setAnalyticsSubTab('cohort-analysis')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              analyticsSubTab === 'cohort-analysis'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Cohort Analysis
          </button>
          <button
            onClick={() => setAnalyticsSubTab('customer-data')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              analyticsSubTab === 'customer-data'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👥 Customer Data
          </button>
          <button
            onClick={() => setAnalyticsSubTab('vanity-metrics')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              analyticsSubTab === 'vanity-metrics'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📈 Vanity Metrics
          </button>
        </div>

        {/* Content */}
        {analyticsSubTab === 'cohort-analysis' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Filters</h3>
              <div className="flex flex-wrap gap-4 items-end">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={cohortFilters.totalAccounts}
                    onChange={(e) => setCohortFilters({ ...cohortFilters, totalAccounts: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Total Accounts</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={cohortFilters.validatedEmails}
                    onChange={(e) => setCohortFilters({ ...cohortFilters, validatedEmails: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Validated Emails</span>
                </label>
                <div className="min-w-[200px]">
                  <CheckboxDropdown
                    label="Intent Categories"
                    options={intentCategoriesLoading ? [] : intentCategories}
                    selected={cohortFilters.intentCategories}
                    onChange={(selected) => setCohortFilters({ ...cohortFilters, intentCategories: selected })}
                    placeholder={intentCategoriesLoading ? 'Loading...' : 'Select intent categories...'}
                    disabled={intentCategoriesLoading}
                  />
                </div>
                <button
                  onClick={fetchCohortAnalysis}
                  disabled={cohortLoading}
                  className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                >
                  {cohortLoading ? 'Loading...' : 'Refresh Data'}
                </button>
              </div>
            </div>

            {/* Cohort Analysis - Activation Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Activation - Number Completed Onboarding Steps</h3>
              </div>
              {cohortLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading cohort analysis...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <th key={week} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                            {week}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Count Starting Onboarding</td>
                        {Array.from({ length: 12 }, () => (
                          <td key={Math.random()} className="px-4 py-3 text-sm text-gray-600">0</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop Off: Emotional Calibration</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep1 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop Off: Financial Context</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep2 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop Off: Motivation</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep3 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop Off: Acquisition Source</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep4 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop Off: Insight Preferences</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep5 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop Off: Account Profile</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep7 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Count Completed Onboarding</td>
                        {Array.from({ length: 12 }, () => (
                          <td key={Math.random()} className="px-4 py-3 text-sm text-gray-600">0</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Avg Time to Onboard (days)</td>
                        {Array.from({ length: 12 }, () => (
                          <td key={Math.random()} className="px-4 py-3 text-sm text-gray-600">-</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Cohort Analysis - Engagement Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Engagement - Activities Completed by Signup Week</h3>
              </div>
              {cohortLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <th key={week} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                            {week}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {/* Onboarding and Data Coverage Section */}
                      <tr className="bg-gray-50">
                        <td colSpan={((cohortData?.weeks?.length || 12) + 1)} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
                          Onboarding and Data Coverage
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Onboarding Completed</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.onboardingCompleted || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Uploaded First Statement</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.uploadedFirstStatement || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Uploaded Two Statements</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.uploadedTwoStatements || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Uploaded Three+ Statements</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.uploadedThreePlusStatements || 0}
                          </td>
                        ))}
                      </tr>
                      {/* Time to Achieve Section */}
                      <tr className="bg-gray-50">
                        <td colSpan={((cohortData?.weeks?.length || 12) + 1)} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
                          Time to Achieve (days, excluding users who haven't completed)
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Time to Onboard</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.avgTimeToOnboardDays || '-'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Time to First Upload</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.avgTimeToFirstUploadDays || '-'}
                          </td>
                        ))}
                      </tr>
                      {/* Engagement Signals Section */}
                      <tr className="bg-gray-50">
                        <td colSpan={((cohortData?.weeks?.length || 12) + 1)} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
                          Engagement Signals
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Avg Transactions per User (of those who uploaded)</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.avgTransactionsPerUser || '-'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Users with Transactions</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.usersWithTransactions || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-400 italic">Logged in 2+ unique days</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-400 italic">
                            Requires user_events table
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-400 italic">Avg days logged in per month (2+ days)</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-400 italic">
                            Requires user_events table
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-400 italic">Logged in 2+ unique months</td>
                        {(cohortData?.weeks || Array.from({ length: 12 }, (_, i) => {
                          const now = new Date();
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weekStart = new Date(currentWeekStart);
                          weekStart.setDate(currentWeekStart.getDate() - ((11 - i) * 7));
                          return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                        })).map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-400 italic">
                            Requires user_events table
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Engagement Chart - Number of Days Logged In */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Engagement - Number of Days Logged In</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Y-axis: Total unique days logged in per week | X-axis: Week from signup (12 weeks)
                </p>
              </div>
              
              {/* Chart Filters */}
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <CheckboxDropdown
                    label="Cohorts"
                    options={cohortData?.weeks || []}
                    selected={chartFilters.cohorts}
                    onChange={(selected) => setChartFilters({ ...chartFilters, cohorts: selected })}
                    placeholder="Select cohorts..."
                  />
                  <CheckboxDropdown
                    label="Intent"
                    options={intentCategoriesLoading ? [] : intentCategories}
                    selected={chartFilters.intentCategories}
                    onChange={(selected) => setChartFilters({ ...chartFilters, intentCategories: selected })}
                    placeholder={intentCategoriesLoading ? 'Loading...' : 'Select intent...'}
                    disabled={intentCategoriesLoading}
                  />
                  <CheckboxDropdown
                    label="Data Coverage"
                    options={['1 upload', '2 uploads', '3+ uploads']}
                    selected={chartFilters.dataCoverage}
                    onChange={(selected) => setChartFilters({ ...chartFilters, dataCoverage: selected })}
                    placeholder="Select data coverage..."
                  />
                  <div className="flex items-end">
                    <button
                      onClick={fetchEngagementChart}
                      disabled={engagementChartLoading}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                    >
                      {engagementChartLoading ? 'Loading...' : 'Refresh Chart'}
                    </button>
                  </div>
                </div>
              </div>

              {engagementChartLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading engagement chart...</p>
                </div>
              ) : engagementChartData?.userLines && engagementChartData.userLines.length > 0 ? (
                <div className="p-6">
                  {!engagementChartData.hasUserEvents && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        ⚠️ <strong>Note:</strong> user_events table not found. Chart shows placeholder data (all zeros). 
                        Login tracking data will appear once user_events table is created and login events are logged.
                      </p>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height={500}>
                    <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="week" 
                        label={{ value: 'Week from Signup', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis 
                        label={{ value: 'Unique Login Days', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
                                <p className="font-semibold">Week {data.week}</p>
                                <p className="text-sm">User ID: {data.userId}</p>
                                <p className="text-sm">Cohort: {data.cohortWeek}</p>
                                <p className="text-sm">Intent: {data.intentType}</p>
                                <p className="text-sm">Data Coverage: {data.dataCoverage}</p>
                                <p className="text-sm font-medium">Login Days: {data.loginDays}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend />
                      {engagementChartData.userLines.map((userLine: any, idx: number) => {
                        // Transform weeks data for chart
                        const chartData = userLine.weeks.map((w: any) => ({
                          week: w.week,
                          loginDays: w.loginDays,
                          userId: userLine.userId,
                          cohortWeek: userLine.cohortWeek,
                          intentType: userLine.intentType,
                          dataCoverage: userLine.dataCoverage,
                        }));
                        
                        const color = `hsl(${(idx * 137.5) % 360}, 70%, 50%)`;
                        return (
                          <Line
                            key={userLine.userId}
                            type="monotone"
                            dataKey="loginDays"
                            data={chartData}
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            name={`User ${userLine.userId}`}
                            connectNulls
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No engagement chart data available. Click "Refresh Chart" to load.
                  {!engagementChartData?.hasUserEvents && (
                    <p className="text-sm text-gray-400 mt-2">
                      Note: Requires user_events table for login tracking data.
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>
        )}
        {analyticsSubTab === 'vanity-metrics' && (
          <div className="space-y-6">
            {/* Vanity Metrics Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Vanity Metrics</h3>
                <div className="flex gap-2 items-end">
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={vanityFilters.totalAccounts}
                      onChange={(e) => setVanityFilters({ ...vanityFilters, totalAccounts: e.target.checked })}
                      className="mr-2"
                    />
                    Total Accounts
                  </label>
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={vanityFilters.validatedEmails}
                      onChange={(e) => setVanityFilters({ ...vanityFilters, validatedEmails: e.target.checked })}
                      className="mr-2"
                    />
                    Validated Emails
                  </label>
                  <div className="min-w-[200px]">
                    <CheckboxDropdown
                      label="Intent Categories"
                      options={intentCategoriesLoading ? [] : intentCategories}
                      selected={vanityFilters.intentCategories}
                      onChange={(selected) => setVanityFilters({ ...vanityFilters, intentCategories: selected })}
                      placeholder={intentCategoriesLoading ? 'Loading...' : 'Select intent categories...'}
                      disabled={intentCategoriesLoading}
                    />
                  </div>
                  <button
                    onClick={fetchVanityMetrics}
                    disabled={vanityLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                  >
                    {vanityLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>
              {vanityLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading vanity metrics...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                        {vanityData?.weeks?.map((week: string) => (
                          <th key={week} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                            {week}
                          </th>
                        )) || (() => {
                          // Generate weeks from November to now as fallback
                          const now = new Date();
                          const novemberStart = new Date(now.getFullYear(), 10, 1); // Month 10 = November
                          const firstMonday = new Date(novemberStart);
                          const dayOfWeek = novemberStart.getDay();
                          if (dayOfWeek === 0) {
                            firstMonday.setDate(novemberStart.getDate() + 1);
                          } else if (dayOfWeek !== 1) {
                            firstMonday.setDate(novemberStart.getDate() + (8 - dayOfWeek));
                          }
                          firstMonday.setHours(0, 0, 0, 0);
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weeksDiff = Math.ceil((currentWeekStart.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
                          const numWeeks = Math.max(1, weeksDiff + 1);
                          return Array.from({ length: numWeeks }, (_, i) => {
                            const weekStart = new Date(firstMonday);
                            weekStart.setDate(firstMonday.getDate() + (i * 7));
                            return `w/c ${weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
                          }).map((week: string) => (
                            <th key={week} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                              {week}
                            </th>
                          ));
                        })()}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Total Users</td>
                        {vanityData?.weeks?.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {vanityData.metrics?.[week]?.totalUsers || 0}
                          </td>
                        )) || (() => {
                          const now = new Date();
                          const novemberStart = new Date(now.getFullYear(), 10, 1);
                          const firstMonday = new Date(novemberStart);
                          const dayOfWeek = novemberStart.getDay();
                          if (dayOfWeek === 0) {
                            firstMonday.setDate(novemberStart.getDate() + 1);
                          } else if (dayOfWeek !== 1) {
                            firstMonday.setDate(novemberStart.getDate() + (8 - dayOfWeek));
                          }
                          firstMonday.setHours(0, 0, 0, 0);
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weeksDiff = Math.ceil((currentWeekStart.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
                          const numWeeks = Math.max(1, weeksDiff + 1);
                          return Array.from({ length: numWeeks }, () => (
                            <td key={Math.random()} className="px-4 py-3 text-sm text-gray-600">0</td>
                          ));
                        })()}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Weekly Active Users</td>
                        {vanityData?.weeks?.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {vanityData.metrics?.[week]?.weeklyActiveUsers || 0}
                          </td>
                        )) || (() => {
                          const now = new Date();
                          const novemberStart = new Date(now.getFullYear(), 10, 1);
                          const firstMonday = new Date(novemberStart);
                          const dayOfWeek = novemberStart.getDay();
                          if (dayOfWeek === 0) {
                            firstMonday.setDate(novemberStart.getDate() + 1);
                          } else if (dayOfWeek !== 1) {
                            firstMonday.setDate(novemberStart.getDate() + (8 - dayOfWeek));
                          }
                          firstMonday.setHours(0, 0, 0, 0);
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weeksDiff = Math.ceil((currentWeekStart.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
                          const numWeeks = Math.max(1, weeksDiff + 1);
                          return Array.from({ length: numWeeks }, () => (
                            <td key={Math.random()} className="px-4 py-3 text-sm text-gray-600">0</td>
                          ));
                        })()}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">New Users per Week</td>
                        {vanityData?.weeks?.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {vanityData.metrics?.[week]?.newUsers || 0}
                          </td>
                        )) || (() => {
                          const now = new Date();
                          const novemberStart = new Date(now.getFullYear(), 10, 1);
                          const firstMonday = new Date(novemberStart);
                          const dayOfWeek = novemberStart.getDay();
                          if (dayOfWeek === 0) {
                            firstMonday.setDate(novemberStart.getDate() + 1);
                          } else if (dayOfWeek !== 1) {
                            firstMonday.setDate(novemberStart.getDate() + (8 - dayOfWeek));
                          }
                          firstMonday.setHours(0, 0, 0, 0);
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weeksDiff = Math.ceil((currentWeekStart.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
                          const numWeeks = Math.max(1, weeksDiff + 1);
                          return Array.from({ length: numWeeks }, () => (
                            <td key={Math.random()} className="px-4 py-3 text-sm text-gray-600">0</td>
                          ));
                        })()}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Total Transactions Uploaded</td>
                        {vanityData?.weeks?.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {vanityData.metrics?.[week]?.totalTransactionsUploaded || 0}
                          </td>
                        )) || (() => {
                          const now = new Date();
                          const novemberStart = new Date(now.getFullYear(), 10, 1);
                          const firstMonday = new Date(novemberStart);
                          const dayOfWeek = novemberStart.getDay();
                          if (dayOfWeek === 0) {
                            firstMonday.setDate(novemberStart.getDate() + 1);
                          } else if (dayOfWeek !== 1) {
                            firstMonday.setDate(novemberStart.getDate() + (8 - dayOfWeek));
                          }
                          firstMonday.setHours(0, 0, 0, 0);
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weeksDiff = Math.ceil((currentWeekStart.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
                          const numWeeks = Math.max(1, weeksDiff + 1);
                          return Array.from({ length: numWeeks }, () => (
                            <td key={Math.random()} className="px-4 py-3 text-sm text-gray-600">0</td>
                          ));
                        })()}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Total Unique Banks Uploaded</td>
                        {vanityData?.weeks?.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {vanityData.metrics?.[week]?.totalUniqueBanksUploaded || 0}
                          </td>
                        )) || (() => {
                          const now = new Date();
                          const novemberStart = new Date(now.getFullYear(), 10, 1);
                          const firstMonday = new Date(novemberStart);
                          const dayOfWeek = novemberStart.getDay();
                          if (dayOfWeek === 0) {
                            firstMonday.setDate(novemberStart.getDate() + 1);
                          } else if (dayOfWeek !== 1) {
                            firstMonday.setDate(novemberStart.getDate() + (8 - dayOfWeek));
                          }
                          firstMonday.setHours(0, 0, 0, 0);
                          const currentWeekStart = new Date(now);
                          currentWeekStart.setDate(now.getDate() - now.getDay());
                          currentWeekStart.setHours(0, 0, 0, 0);
                          const weeksDiff = Math.ceil((currentWeekStart.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
                          const numWeeks = Math.max(1, weeksDiff + 1);
                          return Array.from({ length: numWeeks }, () => (
                            <td key={Math.random()} className="px-4 py-3 text-sm text-gray-600">0</td>
                          ));
                        })()}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        
        
        {analyticsSubTab === 'customer-data' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Customer Data</h2>
                <p className="text-gray-600 mt-1">All user onboarding responses and profile information</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Export to Excel (CSV format)
                    const headers = ['Email', 'First Name', 'Last Name', 'Province', 'Emotional State', 'Financial Context', 'Motivation', 'Acquisition', 'Insights Wanted', 'Account Created', 'Onboarding Completed', 'Onboarding Status'];
                    const rows = customerData.map((user: any) => [
                      user.email || '',
                      user.first_name || '',
                      user.last_name || '',
                      user.province_region || '',
                      (user.emotional_state || []).join('; '),
                      (user.financial_context || []).join('; '),
                      user.motivation || '',
                      user.acquisition_source || '',
                      (user.insight_preferences || []).join('; '),
                      user.created_at ? new Date(user.created_at).toLocaleString() : '',
                      user.completed_at ? new Date(user.completed_at).toLocaleString() : '',
                      user.completed_at ? 'Completed' : user.last_step ? `Dropped after Step ${user.last_step}` : 'Not started',
                    ]);
                    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = `customer-data-${new Date().toISOString().split('T')[0]}.csv`;
                    link.click();
                  }}
                  disabled={customerData.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </button>
                <button
                  onClick={fetchCustomerData}
                  disabled={customerDataLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <svg className={`w-4 h-4 ${customerDataLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Data
                </button>
              </div>
            </div>

            {customerDataLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading customer data...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Province</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Emotional State</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Financial Context</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivation</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acquisition</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insights Wanted</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Insight Suggestions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email Validated</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Is Active</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Onboarding Completed</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Onboarding Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {customerData.map((user) => (
                      <tr key={user.user_id || user.id || user.email} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">{user.user_id || user.id || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.first_name || <span className="text-gray-400 italic">null</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.last_name || <span className="text-gray-400 italic">null</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.province_region || <span className="text-gray-400 italic">null</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                          {user.emotional_state && user.emotional_state.length > 0
                            ? <div className="text-xs">{user.emotional_state.join(', ')}</div>
                            : <span className="text-gray-400 italic">null</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                          {user.financial_context && user.financial_context.length > 0
                            ? <div className="text-xs">{user.financial_context.join(', ')}</div>
                            : <span className="text-gray-400 italic">null</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                          {user.motivation || <span className="text-gray-400 italic">null</span>}
                          {user.motivation_other && <div className="text-xs text-gray-500 mt-1">({user.motivation_other})</div>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.acquisition_source || <span className="text-gray-400 italic">null</span>}
                          {user.acquisition_other && <div className="text-xs text-gray-500 mt-1">({user.acquisition_other})</div>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                          {user.insight_preferences && user.insight_preferences.length > 0
                            ? <div className="text-xs">{user.insight_preferences.join(', ')}</div>
                            : <span className="text-gray-400 italic">null</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                          {user.insight_other || <span className="text-gray-400 italic">null</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.email_validated ? <span className="text-green-600 font-medium">True</span> : <span className="text-gray-400">False</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.is_active !== false ? <span className="text-green-600 font-medium">True</span> : <span className="text-red-600 font-medium">False</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.created_at 
                            ? new Date(user.created_at).toLocaleString()
                            : <span className="text-gray-400 italic">null</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.completed_at 
                            ? new Date(user.completed_at).toLocaleString()
                            : <span className="text-gray-400 italic">null</span>}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.completed_at 
                            ? <span className="text-green-600 font-medium">Completed</span>
                            : user.last_step 
                            ? (
                              <div>
                                <span className="text-orange-600 font-medium">Dropped after Step {user.last_step}</span>
                                {user.updated_at && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {new Date(user.updated_at).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            )
                            : <span className="text-gray-400 italic">Not started</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {customerData.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No customer data available yet
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Fetch health check data
  const fetchHealthData = async () => {
    setHealthLoading(true);
    try {
      const response = await fetch('/api/admin/health');
      const data = await response.json();
      setHealthData(data);
    } catch (error) {
      console.error('Error fetching health data:', error);
      setHealthData({ error: 'Failed to fetch health data' });
    } finally {
      setHealthLoading(false);
    }
  };

  // Render App Health Tab
  const renderAppHealth = () => {

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'pass':
          return '✅';
        case 'fail':
          return '❌';
        case 'warning':
          return '⚠️';
        default:
          return '❓';
      }
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pass':
          return 'bg-green-50 border-green-200 text-green-800';
        case 'fail':
          return 'bg-red-50 border-red-200 text-red-800';
        case 'warning':
          return 'bg-yellow-50 border-yellow-200 text-yellow-800';
        default:
          return 'bg-gray-50 border-gray-200 text-gray-800';
      }
    };

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">🏥 App Health</h2>
              <p className="text-gray-600">
                Comprehensive health checks for application and database infrastructure.
              </p>
            </div>
            <button
              onClick={fetchHealthData}
              disabled={healthLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {healthLoading ? 'Checking...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Overall Status */}
        {healthData && (
          <div className={`rounded-lg border-2 p-6 ${
            (healthData.status === 'pass' || (healthData.success && !healthData.compliance?.summary?.fail && !healthData.operational?.summary?.fail && !healthData.infrastructure?.summary?.fail)) ? 'bg-green-50 border-green-300' :
            (healthData.status === 'fail' || healthData.compliance?.summary?.fail > 0 || healthData.operational?.summary?.fail > 0 || healthData.infrastructure?.summary?.fail > 0) ? 'bg-red-50 border-red-300' :
            'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">
                  Overall Status: {(healthData.status === 'pass' || (healthData.success && !healthData.compliance?.summary?.fail && !healthData.operational?.summary?.fail && !healthData.infrastructure?.summary?.fail)) ? '✅ Healthy' : 
                                   (healthData.status === 'fail' || healthData.compliance?.summary?.fail > 0 || healthData.operational?.summary?.fail > 0 || healthData.infrastructure?.summary?.fail > 0) ? '❌ Unhealthy' : 
                                   '⚠️ Warning'}
                </h3>
                {healthData.summary && (
                  <p className="text-sm">
                    {healthData.summary.passed || healthData.summary.pass || 0} passed, {healthData.summary.warnings || healthData.summary.warning || 0} warnings, {healthData.summary.failed || healthData.summary.fail || 0} failed
                  </p>
                )}
              </div>
              {healthData.timestamp && (
                <div className="text-sm text-gray-500">
                  Last checked: {new Date(healthData.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Health Checks */}
        {healthLoading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Running health checks...</p>
          </div>
        )}

        {healthData && (healthData.checks || healthData.infrastructure || healthData.operational || healthData.compliance) && (() => {
          // Organize checks into sections
          const infrastructureChecks = [
            'Environment Variables',
            'Database Connection',
            'Database Performance',
            'Schema Tables',
            'Database Extensions',
            'Database Disk Space',
          ];
          
          const appHealthChecks = [
            'Data Migration',
            'Data Integrity',
            'Password Security',
          ];
          
          const pipedaChecks = [
            'PII Isolation',
            'Account Deletion Endpoint',
            'Data Export Endpoint',
            '30-Day Data Retention',
            'User Tokenization',
            'Data Residency (Law 25)',
          ];

          const infrastructure = healthData.checks.filter((c: any) => 
            infrastructureChecks.includes(c.name)
          );
          const appHealth = healthData.checks.filter((c: any) => 
            appHealthChecks.includes(c.name)
          );
          const pipeda = healthData.checks.filter((c: any) => 
            pipedaChecks.includes(c.name)
          );

          // PIPEDA requirements that don't need automated checks (use from API if available, otherwise use defaults)
          const pipedaNoCheck = implementedRequirements.length > 0 ? implementedRequirements : [
            {
              name: 'Password Strength Validation',
              status: 'pass',
              description: 'Client and server-side password validation enforced',
              note: 'Implemented in registration endpoint and Login component',
            },
            {
              name: 'Rate Limiting',
              status: 'pass',
              description: 'Rate limiting on authentication endpoints',
              note: 'Implemented in /api/auth/login and /api/auth/register',
            },
            {
              name: 'CSRF Protection',
              status: 'pass',
              description: 'CSRF protection via origin verification',
              note: 'Implemented in lib/csrf.ts',
            },
            {
              name: 'Bcrypt Password Hashing',
              status: 'pass',
              description: 'Passwords hashed with bcrypt (not SHA-256)',
              note: 'Implemented in lib/auth.ts',
            },
          ];

          // PIPEDA requirements that need documentation/process (use from API if available, otherwise use defaults)
          const pipedaDocumentation = documentationRequirements.length > 0 ? documentationRequirements : [
            {
              name: 'Data Residency - Database Migration (Law 25)',
              status: 'warning',
              description: 'Database must be hosted in Canada (Toronto) for Law 25 compliance with Quebec residents',
              note: 'Current database is in US (Washington, D.C.). Must migrate to Canada (Toronto). See MIGRATE_TO_CANADA.md for step-by-step guide. Migration time: 2-3 hours, no code changes needed.',
              action: 'Migration required - See MIGRATE_TO_CANADA.md',
            },
            {
              name: 'Privacy Policy',
              status: 'warning',
              description: 'Privacy policy document required',
              note: 'Create privacy policy document and link from app. Must include data residency disclosure (database in US currently, will be in Canada after migration).',
              action: 'Documentation needed',
            },
            {
              name: 'Terms of Service',
              status: 'warning',
              description: 'Terms of service document required',
              note: 'Create terms of service document',
              action: 'Documentation needed',
            },
            {
              name: 'Data Processing Agreement',
              status: 'warning',
              description: 'DPA for third-party services (e.g., Vercel, Neon)',
              note: 'Review and document data processing agreements with Vercel and Neon. Ensure they meet "equivalent protection" standard for PIPEDA.',
              action: 'Legal review needed',
            },
            {
              name: 'Breach Notification Plan',
              status: 'warning',
              description: 'Incident response plan for data breaches',
              note: 'Document breach notification procedures per Law 25. Must include notification to Quebec authorities for Quebec residents if database breach occurs.',
              action: 'Process documentation needed',
            },
            {
              name: 'Privacy Officer',
              status: 'warning',
              description: 'Designate privacy officer (Law 25 requirement)',
              note: 'Assign privacy officer and publish contact information. Required for organizations handling Quebec resident data.',
              action: 'Organizational setup needed',
            },
          ];

          const renderCheck = (check: any, index: number) => (
            <div
              key={index}
              className={`border-2 rounded-lg p-6 ${getStatusColor(check.status)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{getStatusIcon(check.status)}</span>
                    <h3 className="text-lg font-bold">{check.name}</h3>
                  </div>
                  <p className="text-sm mb-3 opacity-90">{check.description}</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      check.status === 'pass' ? 'bg-green-200 text-green-900' :
                      check.status === 'fail' ? 'bg-red-200 text-red-900' :
                      'bg-yellow-200 text-yellow-900'
                    }`}>
                      {check.message || check.note}
                    </div>
                    {check.responseTimeMs !== undefined && (
                      <span className="text-xs text-gray-500">
                        ({check.responseTimeMs}ms)
                      </span>
                    )}
                  </div>
                  {check.details && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm font-medium hover:underline">
                        View Details
                      </summary>
                      <pre className="mt-2 p-3 bg-black bg-opacity-10 rounded text-xs overflow-x-auto">
                        {JSON.stringify(check.details, null, 2)}
                      </pre>
                    </details>
                  )}
                  {check.action && (
                    <div className="mt-2 text-xs text-gray-600 italic">
                      Action: {check.action}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );

          return (
            <div className="space-y-8">
              {/* Infrastructure Health */}
              <div>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span>🏗️</span> Infrastructure Health
                </h3>
                <div className="grid gap-4">
                  {infrastructure.map((check: any, index: number) => renderCheck(check, index))}
                </div>
              </div>

              {/* App Health / Operational Correctness */}
              <div>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span>⚙️</span> App Health / Operational Correctness
                </h3>
                <div className="grid gap-4">
                  {appHealth.map((check: any, index: number) => renderCheck(check, index))}
                </div>
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Product health metrics (ingestion latency, parsing rates, categorization accuracy) 
                    will be added in future updates.
                  </p>
                </div>
              </div>

              {/* PIPEDA / Law 25 Requirements */}
              <div>
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <span>🔒</span> PIPEDA / Law 25 Compliance
                </h3>
                
                {/* Active Tests/Checks */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-gray-700">Active Tests / Checks</h4>
                  <div className="grid gap-4">
                    {pipeda.map((check: any, index: number) => renderCheck(check, index))}
                  </div>
                </div>

                {/* Requirements (No Checks Needed) */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-gray-700">Implemented Requirements (No Automated Checks)</h4>
                  <div className="grid gap-4">
                    {pipedaNoCheck.map((req: any, index: number) => (
                      <div
                        key={index}
                        className="border-2 rounded-lg p-4 bg-green-50 border-green-200"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">✅</span>
                          <div className="flex-1">
                            <h4 className="font-bold text-green-900 mb-1">{req.name}</h4>
                            <p className="text-sm text-green-800 mb-2">{req.description}</p>
                            <p className="text-xs text-green-700 italic">{req.note}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Requirements (Documentation/Process Needed) */}
                <div>
                  <h4 className="text-lg font-semibold mb-3 text-gray-700">Requirements Needing Documentation / Process</h4>
                  <div className="grid gap-4">
                    {pipedaDocumentation.map((req: any, index: number) => (
                      <div
                        key={index}
                        className="border-2 rounded-lg p-4 bg-yellow-50 border-yellow-200"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">📝</span>
                          <div className="flex-1">
                            <h4 className="font-bold text-yellow-900 mb-1">{req.name}</h4>
                            <p className="text-sm text-yellow-800 mb-2">{req.description}</p>
                            <p className="text-xs text-yellow-700 italic mb-2">{req.note}</p>
                            <div className="text-xs font-medium text-yellow-900">
                              ⚠️ {req.action}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {healthData && healthData.error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
            <h3 className="text-lg font-bold text-red-900 mb-2">❌ Error</h3>
            <p className="text-red-700">{healthData.error}</p>
          </div>
        )}

        {!healthData && !healthLoading && (
          <div className="text-center py-12">
            <p className="text-gray-600">Click "Refresh" to run health checks</p>
          </div>
        )}
      </div>
    );
  };

  // Auto-fetch health data when health tab is active
  useEffect(() => {
    if (activeTab === 'monitoring' && monitoringSubTab === 'health' && !healthData && !healthLoading) {
      fetchHealthData();
    }
  }, [activeTab, monitoringSubTab]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    router.push('/admin/login');
  };
  
  const startEditing = (item: any, field: string) => {
    setEditingItemId(item.id);
    setEditingField(field);
    setEditFormData({
      keyword: viewType === 'keywords' ? item.keyword : item.merchant_pattern,
      category: item.category,
      label: item.label,
      notes: item.notes
    });
  };
  
  const cancelEdit = () => {
    setEditingItemId(null);
    setEditingField(null);
    setEditFormData({});
  };
  
  const saveEdit = async (item: any) => {
    try {
      const token = localStorage.getItem('admin_token');
      const endpoint = viewType === 'keywords' ? 'keywords' : 'merchants';
      
      const payload = viewType === 'keywords' 
        ? {
            keyword: editFormData.keyword,
            category: editFormData.category,
            label: editFormData.label,
            notes: editFormData.notes
          }
        : {
            merchant_pattern: editFormData.keyword,
            alternate_patterns: [],  // Inline editing doesn't support alternate patterns (use modal for that)
            category: editFormData.category,
            label: editFormData.label,
            notes: editFormData.notes
          };
      
      const response = await fetch(`/api/admin/${endpoint}/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error('Failed to save');
      
      // Invalidate categorization cache so changes take effect immediately
      invalidatePatternCache();
      
      // Clear editing state and refresh
      cancelEdit();
      await fetchData();
    } catch (error: any) {
      alert(`Error saving: ${error.message}`);
    }
  };
  
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('admin_token');
      const endpoint = viewType === 'keywords' ? 'keywords' : 'merchants';
      const response = await fetch(`/api/admin/${endpoint}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to delete');
      
      // Invalidate categorization cache so changes take effect immediately
      invalidatePatternCache();
      
      // Refresh data
      await fetchData();
    } catch (error: any) {
      alert(`Error deleting item: ${error.message}`);
    }
  };
  
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedItems.length} items? This action cannot be undone.`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('admin_token');
      const endpoint = viewType === 'keywords' ? 'keywords' : 'merchants';
      
      // Delete all selected items in parallel
      await Promise.all(
        selectedItems.map(id =>
          fetch(`/api/admin/${endpoint}/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          })
        )
      );
      
      // Invalidate categorization cache so changes take effect immediately
      invalidatePatternCache();
      
      // Clear selection and refresh data
      setSelectedItems([]);
      await fetchData();
    } catch (error: any) {
      alert(`Error deleting items: ${error.message}`);
    }
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
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'categories'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🏷️ Category Engine
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'insights'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🔍 Insights Engine
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
              onClick={() => setActiveTab('monitoring')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'monitoring'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 App Monitoring
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            {/* Monitoring Sub-tabs */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                onClick={() => setMonitoringSubTab('accounts')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  monitoringSubTab === 'accounts'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                👥 Accounts
              </button>
              <button
                onClick={() => setMonitoringSubTab('health')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  monitoringSubTab === 'health'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                💚 App Health
              </button>
            </div>
            {/* Monitoring Content */}
            {monitoringSubTab === 'accounts' && renderAccountsTab()}
            {monitoringSubTab === 'health' && renderAppHealth()}
          </div>
        )}
        {activeTab === 'inbox' && renderPlaceholderTab('Inbox', 'Manage bug reports, feature requests, and user feedback', '📥')}
        {activeTab === 'categories' && renderCategoriesTab()}
        {activeTab === 'insights' && renderPlaceholderTab('Insights Engine', 'Automated spending insights and personalized recommendations', '🔍')}
        {activeTab === 'analytics' && renderAnalyticsTab()}
      </div>
      
      {/* Add Modal - only for keywords and merchants */}
      {showAddModal && viewType !== 'recategorization' && (
        <AddEditModal
          viewType={viewType as 'keywords' | 'merchants'}
          item={null}
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// Add/Edit Modal Component
function AddEditModal({ 
  viewType, 
  item, 
  onClose, 
  onSave 
}: { 
  viewType: 'keywords' | 'merchants';
  item: any | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    keyword: item?.keyword || item?.merchant_pattern || '',
    category: item?.category || 'Food',
    label: item?.label || '',
    alternatePatterns: item?.alternate_patterns?.join(', ') || '', // Comma-separated string
    notes: item?.notes || ''
  });
  const [saving, setSaving] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const token = localStorage.getItem('admin_token');
      const endpoint = viewType === 'keywords' ? 'keywords' : 'merchants';
      const method = item ? 'PUT' : 'POST';
      const url = item 
        ? `/api/admin/${endpoint}/${item.id}` 
        : `/api/admin/${endpoint}`;
      
      const payload = viewType === 'keywords' 
        ? {
            keyword: formData.keyword,
            category: formData.category,
            label: formData.label
          }
        : {
            merchant_pattern: formData.keyword,
            alternate_patterns: formData.alternatePatterns
              .split(',')
              .map(p => p.trim().toUpperCase())
              .filter(p => p.length > 0),
            category: formData.category,
            label: formData.label
          };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }
      
      // Invalidate categorization cache so changes take effect immediately
      invalidatePatternCache();
      
      onSave();
    } catch (error: any) {
      alert(`Error saving: ${error.message}`);
      setSaving(false);
    }
  };
  
  const categories = [
    'Food', 'Bills', 'Housing', 'Transport', 'Travel', 'Health', 
    'Education', 'Personal', 'Shopping', 'Work', 'Subscriptions'
  ];
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {item ? 'Edit' : 'Add'} {viewType === 'keywords' ? 'Keyword' : 'Merchant'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {viewType === 'keywords' ? 'Keyword' : 'Merchant Pattern'}
              </label>
              <input
                type="text"
                required
                value={formData.keyword}
                onChange={(e) => setFormData({ ...formData, keyword: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder={viewType === 'keywords' ? 'e.g. COFFEE' : 'e.g. STARBUCKS'}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label (optional)</label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Coffee"
              />
            </div>
            
            {viewType === 'merchants' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Alternate Patterns (optional)
                  <span className="text-gray-500 text-xs ml-2">Comma-separated variations</span>
                </label>
                <input
                  type="text"
                  value={formData.alternatePatterns}
                  onChange={(e) => setFormData({ ...formData, alternatePatterns: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. TIMHORT, TIM HORT, HORTONS"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Example: For "TIM HORTONS", add variations like "TIMHORT, TIM HORT, HORTONS"
                </p>
              </div>
            )}
            
            {viewType === 'keywords' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Any additional notes..."
                />
              </div>
            )}
            
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : (item ? 'Update' : 'Add')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Column Filter Header Component
function ColumnFilterHeader({
  label,
  options,
  selected,
  onChange
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLTableHeaderCellElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(v => v !== option));
    } else {
      onChange([...selected, option]);
    }
  };
  
  const selectAll = () => onChange([]);
  
  return (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 hover:text-gray-700 transition-colors"
      >
        {label}
        <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        {selected.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded-full">
            {selected.length}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
          <div className="p-2 border-b border-gray-200">
            <button
              onClick={selectAll}
              className="w-full text-left px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              Select All
            </button>
          </div>
          <div className="p-2 space-y-1">
            {options.map(option => (
              <label
                key={option}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </th>
  );
}



