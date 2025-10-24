'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

type TabName = 'inbox' | 'categories' | 'insights' | 'analytics' | 'accounts';

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
  const [activeTab, setActiveTab] = useState<TabName>('inbox');
  const [viewType, setViewType] = useState<'keywords' | 'merchants' | 'recategorization'>('keywords');
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
  useEffect(() => {
    if (activeTab === 'accounts' && authenticated) {
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
      fetchUsers();
    }
  }, [activeTab, authenticated]);

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
            Manage keywords and merchants below. All changes immediately affect categorization for future uploads.
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
      
      // Search filter
      const matchesSearch = keyword.toLowerCase().includes(searchLower) ||
        item.label?.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower);
      
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
          <h2 className="text-2xl font-bold text-gray-900">Registered Accounts</h2>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validated Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user, index) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
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
              onClick={() => setActiveTab('accounts')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'accounts'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              👥 Accounts
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'inbox' && renderPlaceholderTab('Inbox', 'Manage bug reports, feature requests, and user feedback', '📥')}
        {activeTab === 'categories' && renderCategoriesTab()}
        {activeTab === 'insights' && renderPlaceholderTab('Insights Engine', 'Automated spending insights and personalized recommendations', '🔍')}
        {activeTab === 'analytics' && renderPlaceholderTab('Analytics', 'View categorization performance, user activity, and system metrics', '📊')}
        {activeTab === 'accounts' && renderAccountsTab()}
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


