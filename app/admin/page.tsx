'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { invalidatePatternCache } from '@/lib/categorization-engine';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import CheckboxDropdown from '@/components/CheckboxDropdown';
import { formatUserId, formatTransactionId, formatEventId } from '@/lib/id-formatter';

type TabName = 'monitoring' | 'inbox' | 'categories' | 'analytics' | 'migration';
type MonitoringSubTab = 'accounts' | 'health' | 'privacy-policy' | 'admin-logins';
type InboxSubTab = 'chat-scheduler' | 'feedback' | 'whats-coming-survey';

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
  const [monitoringSubTab, setMonitoringSubTab] = useState<MonitoringSubTab>('health');
  const [viewType, setViewType] = useState<'keywords' | 'merchants' | 'recategorization'>('keywords');
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'cohort-analysis' | 'customer-data' | 'events-data' | 'editing-events-data' | 'vanity-metrics' | 'data-details' | 'download'>('cohort-analysis');
  const [inboxSubTab, setInboxSubTab] = useState<InboxSubTab>('feedback');
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
  
  // State for Events Data tab
  const [eventsData, setEventsData] = useState<any[]>([]);
  const [eventsDataLoading, setEventsDataLoading] = useState(false);
  
  // State for Editing Events Data tab
  const [editingEventsData, setEditingEventsData] = useState<any[]>([]);
  const [editingEventsDataLoading, setEditingEventsDataLoading] = useState(false);
  
  // State for User Feedback tab
  const [userFeedback, setUserFeedback] = useState<any[]>([]);
  const [userFeedbackLoading, setUserFeedbackLoading] = useState(false);
  
  // State for What's Coming Survey tab
  const [surveyResponses, setSurveyResponses] = useState<any[]>([]);
  const [surveyResponsesLoading, setSurveyResponsesLoading] = useState(false);
  
  // State for App Health tab
  const [healthData, setHealthData] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  
  // State for Privacy Policy Check tab
  const [privacyCheckData, setPrivacyCheckData] = useState<any>(null);
  const [privacyCheckLoading, setPrivacyCheckLoading] = useState(false);
  
  // State for Admin Logins tab
  const [adminLogins, setAdminLogins] = useState<any[]>([]);
  const [adminLoginsLoading, setAdminLoginsLoading] = useState(false);
  
  // State for Migration tab
  const [migrationTests, setMigrationTests] = useState<any[]>([]);
  const [migrationTestsLoading, setMigrationTestsLoading] = useState(false);
  const [migrationResults, setMigrationResults] = useState<any>(null);
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [dropVerification, setDropVerification] = useState<any>(null);
  const [dropVerificationLoading, setDropVerificationLoading] = useState(false);
  const [investigationData, setInvestigationData] = useState<any>(null);
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [emptyTablesVerification, setEmptyTablesVerification] = useState<any>(null);
  const [emptyTablesLoading, setEmptyTablesLoading] = useState(false);
  const [emptyTablesDropping, setEmptyTablesDropping] = useState(false);
  const [singleSourceTests, setSingleSourceTests] = useState<any>(null);
  const [singleSourceTestsLoading, setSingleSourceTestsLoading] = useState(false);
  
  // State for Chat Scheduler
  const [availableSlots, setAvailableSlots] = useState<Set<string>>(new Set());
  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  
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
    selectedCohorts: [] as string[], // Empty array means all cohorts selected by default
    dataCoverage: [] as string[],
  });
  const [engagementChartData, setEngagementChartData] = useState<any>(null);
  const [engagementChartLoading, setEngagementChartLoading] = useState(false);
  const [chartFilters, setChartFilters] = useState({
    totalAccounts: true,
    validatedEmails: false,
    intentCategories: [] as string[],
    cohorts: [] as string[],
    dataCoverage: [] as string[],
    userIds: [] as number[],
  });
  const [vanityFilters, setVanityFilters] = useState({
    totalAccounts: true,
    validatedEmails: false,
    intentCategories: [] as string[],
    cohorts: [] as string[],
    dataCoverage: [] as string[],
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
      
      if (!response.ok) {
        console.error('[Customer Data] API error:', data);
        if (data.migrationRequired) {
          alert(`Migration required: ${data.message || 'Please run the migration first.'}`);
        } else {
          alert(`Error fetching customer data: ${data.error || 'Unknown error'}`);
        }
        setCustomerData([]);
        return;
      }
      
      setCustomerData(data.customerData || []);
    } catch (error) {
      console.error('Error fetching customer data:', error);
      setCustomerData([]);
    } finally {
      setCustomerDataLoading(false);
    }
  };

  // Fetch events data function
  const fetchEventsData = async () => {
    setEventsDataLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/events-data', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setEventsData(data.eventsData || []);
    } catch (error) {
      console.error('Error fetching events data:', error);
    } finally {
      setEventsDataLoading(false);
    }
  };

  // Fetch editing events data function
  const fetchEditingEventsData = async () => {
    setEditingEventsDataLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/editing-events', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setEditingEventsData(data.editingEvents || []);
    } catch (error) {
      console.error('Error fetching editing events data:', error);
    } finally {
      setEditingEventsDataLoading(false);
    }
  };

  // Fetch user feedback function
  const fetchUserFeedback = async () => {
    setUserFeedbackLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/user-feedback', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUserFeedback(data.feedback || []);
    } catch (error) {
      console.error('Error fetching user feedback:', error);
      setUserFeedback([]);
    } finally {
      setUserFeedbackLoading(false);
    }
  };

  // Fetch bookings function
  const fetchBookings = async () => {
    setBookingsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const response = await fetch('/api/admin/bookings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBookings(data.bookings || []);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setBookingsLoading(false);
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
        intentCategories: cohortFilters.intentCategories.join('|'),
        cohorts: cohortFilters.selectedCohorts.join(','),
        dataCoverage: cohortFilters.dataCoverage.join(','),
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
      // Build URLSearchParams manually to ensure pipe delimiter is preserved
      // URLSearchParams constructor might encode | as %7C, but that's fine - it will be decoded on the server
      const params = new URLSearchParams();
      params.set('totalAccounts', vanityFilters.totalAccounts.toString());
      params.set('validatedEmails', vanityFilters.validatedEmails.toString());
      // Use pipe delimiter to avoid splitting on commas within intent category values
      if (vanityFilters.intentCategories.length > 0) {
        params.set('intentCategories', vanityFilters.intentCategories.join('|'));
      }
      if (vanityFilters.cohorts.length > 0) {
        params.set('cohorts', vanityFilters.cohorts.join(','));
      }
      if (vanityFilters.dataCoverage.length > 0) {
        params.set('dataCoverage', vanityFilters.dataCoverage.join(','));
      }
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
        totalAccounts: chartFilters.totalAccounts.toString(),
        validatedEmails: chartFilters.validatedEmails.toString(),
        cohorts: chartFilters.cohorts.join(','),
        intentCategories: chartFilters.intentCategories.join('|'),
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

  // Fetch admin logins
  const fetchAdminLogins = async () => {
    setAdminLoginsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/logins', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setAdminLogins(data.logins || []);
    } catch (error) {
      console.error('Error fetching admin logins:', error);
      setAdminLogins([]);
    } finally {
      setAdminLoginsLoading(false);
    }
  };

  // Fetch users when Accounts tab is active
  // Fetch users function (used by Accounts tab and block button)
  const fetchUsers = async () => {
    setAccountsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      
      // Log when admin opens Accounts tab
      try {
        await fetch('/api/admin/log-action', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'tab_access',
            tab: 'accounts',
          }),
        });
      } catch (logError) {
        // Don't fail if logging fails
        console.error('Failed to log tab access:', logError);
      }
      
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

  // Fetch events data when Events Data tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && analyticsSubTab === 'events-data' && authenticated) {
      fetchEventsData();
    }
  }, [activeTab, analyticsSubTab, authenticated]);

  // Fetch editing events data when Editing Events Data tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && analyticsSubTab === 'editing-events-data' && authenticated) {
      fetchEditingEventsData();
    }
  }, [activeTab, analyticsSubTab, authenticated]);

  const fetchSurveyResponses = async () => {
    setSurveyResponsesLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/survey-responses', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSurveyResponses(data.responses || []);
    } catch (error) {
      console.error('Error fetching survey responses:', error);
      setSurveyResponses([]);
    } finally {
      setSurveyResponsesLoading(false);
    }
  };

  // Fetch data when Inbox sub-tabs are active
  useEffect(() => {
    if (activeTab === 'inbox' && inboxSubTab === 'feedback' && authenticated) {
      fetchUserFeedback();
    }
    if (activeTab === 'inbox' && inboxSubTab === 'chat-scheduler' && authenticated) {
      fetchBookings();
      fetchAvailableSlots();
    }
    if (activeTab === 'inbox' && inboxSubTab === 'whats-coming-survey' && authenticated) {
      fetchSurveyResponses();
    }
    if (activeTab === 'migration' && authenticated) {
      fetchMigrationTests();
      fetchDropVerification();
      fetchInvestigation();
      fetchEmptyTablesVerification();
      fetchSingleSourceTests();
    }
  }, [activeTab, inboxSubTab, authenticated]);

  // Fetch available slots from database
  const fetchAvailableSlots = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        console.log('No admin token found');
        return;
      }

      const response = await fetch('/api/admin/available-slots', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Fetched available slots:', data.availableSlots?.length || 0, 'slots');
        setAvailableSlots(new Set(data.availableSlots || []));
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch available slots:', response.status, errorData);
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
    }
  };

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
    }
  }, [activeTab, analyticsSubTab, authenticated]);
  
  // Fetch vanity metrics when filters change (but only if on vanity metrics tab)
  useEffect(() => {
    if (activeTab === 'analytics' && analyticsSubTab === 'vanity-metrics' && authenticated) {
      fetchVanityMetrics();
    }
  }, [vanityFilters, activeTab, analyticsSubTab, authenticated]);

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
            🔄 Recategorization log
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
      (items as any[]).map(item => ({ ...item, category }))
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
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Previous Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New Category</th>
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
                  {item.original_category ? (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">{item.original_category}</span>
                  ) : (
                    <span className="text-gray-400 italic">-</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">{item.corrected_category}</span>
                </td>
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

  // Render Chat Scheduler
  const renderChatScheduler = () => {
    // Generate 4 weeks of dates starting from today
    const generateWeeks = () => {
      const weeks = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let week = 0; week < 4; week++) {
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + (week * 7));
        // Start from Monday
        const dayOfWeek = weekStart.getDay();
        const diff = weekStart.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        weekStart.setDate(diff);
        
        const weekDays = [];
        for (let day = 0; day < 7; day++) {
          const date = new Date(weekStart);
          date.setDate(weekStart.getDate() + day);
          weekDays.push(new Date(date));
        }
        weeks.push(weekDays);
      }
      return weeks;
    };

    // Generate hourly time slots from 9am to 5pm (3 meetings per hour)
    const generateTimeSlots = () => {
      const slots = [];
      for (let hour = 9; hour < 18; hour++) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        slots.push(timeStr);
      }
      return slots;
    };

    const weeks = generateWeeks();
    const timeSlots = generateTimeSlots();
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const toggleSlot = async (date: Date, time: string) => {
      // Use local date to avoid timezone issues
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const slotDate = `${year}-${month}-${day}`;
      const slotKey = `${slotDate}_${time}`;
      const isCurrentlyAvailable = availableSlots.has(slotKey);
      const newAvailability = !isCurrentlyAvailable;

      console.log('Toggling slot:', { slotDate, slotTime: time, slotKey, isCurrentlyAvailable, newAvailability });

      // Optimistically update UI
      setAvailableSlots(prev => {
        const newSet = new Set(prev);
        if (newAvailability) {
          newSet.add(slotKey);
        } else {
          newSet.delete(slotKey);
        }
        return newSet;
      });

      // Save to database
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        const response = await fetch('/api/admin/available-slots', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            slotDate: slotDate,
            slotTime: time,
            isAvailable: newAvailability,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Failed to save slot availability:', response.status, errorData);
          // Revert on error
          setAvailableSlots(prev => {
            const revertedSet = new Set(prev);
            if (isCurrentlyAvailable) {
              revertedSet.add(slotKey);
            } else {
              revertedSet.delete(slotKey);
            }
            return revertedSet;
          });
        } else {
          console.log('Slot availability saved successfully, refreshing...');
          // Refresh slots from database to ensure consistency
          await fetchAvailableSlots();
        }
      } catch (error) {
        console.error('Error saving slot availability:', error);
        // Revert on error
        setAvailableSlots(prev => {
          const revertedSet = new Set(prev);
          if (isCurrentlyAvailable) {
            revertedSet.add(slotKey);
          } else {
            revertedSet.delete(slotKey);
          }
          return revertedSet;
        });
      }
    };

    const isSlotAvailable = (date: Date, time: string) => {
      // Use local date to match toggleSlot format
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const slotDate = `${year}-${month}-${day}`;
      const slotKey = `${slotDate}_${time}`;
      return availableSlots.has(slotKey);
    };

    const formatDate = (date: Date) => {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Chat scheduler</h2>
          <p className="text-gray-600 mt-1">Manage available hourly slots for user bookings (Office hours: 9am - 6pm, 3 meetings per hour)</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto p-6">
            <table className="w-full border-collapse">
              <colgroup>
                <col style={{ width: '60px' }} />
                <col style={{ width: '35px' }} />
                <col style={{ width: '35px' }} />
                <col style={{ width: '35px' }} />
                <col style={{ width: '35px' }} />
                <col style={{ width: '35px' }} />
                <col style={{ width: '35px' }} />
                <col style={{ width: '35px' }} />
              </colgroup>
              {weeks.map((week, weekIndex) => (
                <tbody key={weekIndex} className={weekIndex > 0 ? 'mt-8' : ''}>
                  <tr>
                    <td colSpan={8} className="pb-4 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Week {weekIndex + 1}: {formatDate(week[0])} - {formatDate(week[6])}
                      </h3>
                    </td>
                  </tr>
                  <tr>
                    <td className="font-medium text-xs text-gray-700 p-1"></td>
                    {week.map((date, dayIndex) => (
                      <td key={dayIndex} className="text-center p-1">
                        <div className="font-medium text-xs text-gray-700">{dayNames[dayIndex]}</div>
                        <div className="text-xs text-gray-500">{formatDate(date)}</div>
                      </td>
                    ))}
                  </tr>
                  {timeSlots.map((time) => (
                    <tr key={time}>
                      <td className="text-xs text-gray-600 p-1 font-medium align-middle">{time}</td>
                      {week.map((date, dayIndex) => {
                        const available = isSlotAvailable(date, time);
                        const isPast = date < new Date() || (date.toDateString() === new Date().toDateString() && time < new Date().toTimeString().slice(0, 5));
                        return (
                          <td key={dayIndex} className="p-0.5">
                            <button
                              onClick={() => !isPast && toggleSlot(date, time)}
                              disabled={isPast}
                              className={`w-full h-8 text-xs rounded border transition-colors ${
                                isPast
                                  ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
                                  : available
                                  ? 'bg-green-100 border-green-500 hover:bg-green-200'
                                  : 'bg-white border-gray-300 hover:bg-gray-50'
                              }`}
                              title={isPast ? 'Past date/time' : available ? 'Click to mark unavailable' : 'Click to mark available'}
                            >
                              {available ? '✓' : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>

        {/* Bookings List */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mt-6">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Bookings</h3>
            <button
              onClick={fetchBookings}
              disabled={bookingsLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${bookingsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {bookingsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>No bookings yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preferences</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Booked</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.map((booking: any) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(booking.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}<br />
                        <span className="text-gray-500">{booking.time}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div>
                          <div className="font-medium">{booking.displayName || booking.userEmail}</div>
                          <div className="text-xs text-gray-500">{booking.userEmail}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {booking.preferredMethod === 'teams' ? 'Microsoft Teams' : 
                         booking.preferredMethod === 'google-meet' ? 'Google Meet' : 'Phone call'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {booking.preferredMethod !== 'phone' ? (
                          <div className="text-xs">
                            <div>Share screen: {booking.shareScreen ? 'Yes' : 'No'}</div>
                            <div>Record: {booking.recordConversation ? 'Yes' : 'No'}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                        {booking.notes ? (
                          <div className="break-words whitespace-normal" title={booking.notes}>{booking.notes}</div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={booking.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            try {
                              const token = localStorage.getItem('admin_token');
                              const response = await fetch('/api/admin/bookings/update-status', {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  bookingId: booking.id,
                                  status: newStatus,
                                }),
                              });
                              if (response.ok) {
                                fetchBookings();
                              } else {
                                const errorData = await response.json().catch(() => ({}));
                                alert(errorData.error || 'Failed to update status');
                              }
                            } catch (error) {
                              console.error('Error updating status:', error);
                              alert('Failed to update status');
                            }
                          }}
                          className={`px-2 py-1 rounded text-xs font-medium border ${
                            booking.status === 'confirmed' ? 'bg-green-100 text-green-800 border-green-300' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-300' :
                            booking.status === 'completed' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                            booking.status === 'requested' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                            'bg-gray-100 text-gray-800 border-gray-300'
                          }`}
                        >
                          <option value="requested">Requested</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Accounts Tab
  const renderAccountsTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Unique users</h2>
          <p className="text-gray-600 mt-1">View all user registrations and account status</p>
        </div>

        {accountsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Creation Consent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cookie Consent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Upload Consent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user, index) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{users.length - index}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">{formatUserId(user.id)}</td>
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
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.account_creation_consent_at
                        ? new Date(user.account_creation_consent_at).toLocaleString()
                        : <span className="text-gray-400 italic">No record</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.cookie_consent_at
                        ? (
                            <div>
                              <div className="font-medium">
                                {user.cookie_consent_choice === 'accept_all'
                                  ? 'Accept all cookies'
                                  : user.cookie_consent_choice === 'essential_only'
                                  ? 'Essential cookies only'
                                  : user.cookie_consent_choice || 'Unknown'}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(user.cookie_consent_at).toLocaleString()}
                              </div>
                            </div>
                          )
                        : <span className="text-gray-400 italic">No record</span>}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {user.first_upload_consent_at
                        ? typeof user.first_upload_consent_at === 'string' && user.first_upload_consent_at.includes('pre-logging')
                          ? <span className="text-gray-500 italic">{user.first_upload_consent_at}</span>
                          : new Date(user.first_upload_consent_at).toLocaleString()
                        : <span className="text-gray-400 italic">No record</span>}
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
                          (user.is_active !== undefined ? user.is_active : true)
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        } transition-colors`}
                      >
                        {(user.is_active !== undefined ? user.is_active : true) ? 'Access Enabled' : 'Blocked'}
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

  // Render Migration Tab
  const renderMigrationTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Database Migration</h2>
          <p className="text-gray-600 mb-6">
            Run the comprehensive table consolidation migration and verify table drops.
          </p>

          {/* Pre-Migration Tests */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Pre-Migration Tests</h3>
              <button
                onClick={fetchMigrationTests}
                disabled={migrationTestsLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {migrationTestsLoading ? 'Loading...' : 'Run Tests'}
              </button>
            </div>
            
            {migrationTests.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {migrationTests.map((test, index) => (
                      <tr key={index}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{test.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{test.description}</td>
                        <td className="px-6 py-4 text-sm">
                          {test.passed ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Pass
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              ✗ Fail
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {test.actualValue !== null && test.actualValue !== undefined ? String(test.actualValue) : '-'}
                          {test.error && <span className="text-red-600 ml-2">({test.error})</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Run Migration */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Run Migration</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Execute the comprehensive table consolidation migration script.
                </p>
              </div>
              <button
                onClick={runMigration}
                disabled={migrationRunning}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-semibold"
              >
                {migrationRunning ? 'Running...' : 'Run Migration'}
              </button>
            </div>

            {migrationResults && (
              <div className={`border rounded-lg p-4 ${migrationResults.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">
                    Migration Results
                  </h4>
                  <span className={`text-sm font-medium ${migrationResults.success ? 'text-green-800' : 'text-yellow-800'}`}>
                    {migrationResults.successful} / {migrationResults.executed} statements successful
                  </span>
                </div>
                {migrationResults.errors > 0 && (
                  <p className="text-sm text-yellow-800 mb-2">
                    {migrationResults.errors} error(s) occurred. Check details below.
                  </p>
                )}
                {migrationResults.error && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-800 font-medium">Error:</p>
                    <p className="text-sm text-red-700">{migrationResults.error}</p>
                    {migrationResults.details && (
                      <p className="text-xs text-red-600 mt-1">{migrationResults.details}</p>
                    )}
                  </div>
                )}
                {migrationResults.message && (
                  <p className="text-sm text-green-800">{migrationResults.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Investigation */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Investigation</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Investigate unmigrated transactions and table dependencies.
                </p>
              </div>
              <button
                onClick={fetchInvestigation}
                disabled={investigationLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {investigationLoading ? 'Loading...' : 'Investigate'}
              </button>
            </div>

            {investigationData && (
              <div className="space-y-4">
                {investigationData.unmigratedTransactions && investigationData.unmigratedTransactions.length > 0 && (
                  <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-yellow-900">
                        Unmigrated Transactions ({investigationData.unmigratedTransactions.length})
                      </h4>
                      <button
                        onClick={fixUnmigratedTransactions}
                        disabled={fixingUnmigrated}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 font-semibold"
                      >
                        {fixingUnmigrated ? 'Fixing...' : 'Fix Unmigrated'}
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left font-medium text-yellow-900">ID</th>
                            <th className="text-left font-medium text-yellow-900">User</th>
                            <th className="text-left font-medium text-yellow-900">Date</th>
                            <th className="text-left font-medium text-yellow-900">Description</th>
                            <th className="text-left font-medium text-yellow-900">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-yellow-200">
                          {investigationData.unmigratedTransactions.slice(0, 10).map((tx: any, idx: number) => (
                            <tr key={idx}>
                              <td className="py-2 text-yellow-800">{tx.id}</td>
                              <td className="py-2 text-yellow-800">{tx.email || tx.user_id}</td>
                              <td className="py-2 text-yellow-800">{tx.date}</td>
                              <td className="py-2 text-yellow-800">{tx.description?.substring(0, 30)}...</td>
                              <td className="py-2 text-yellow-800">{tx.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {investigationData.viewsUsingTransactions && investigationData.viewsUsingTransactions.length > 0 && (
                  <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                    <h4 className="font-semibold text-orange-900 mb-2">
                      Views Using Transactions Table
                    </h4>
                    <ul className="list-disc list-inside text-sm text-orange-800">
                      {investigationData.viewsUsingTransactions.map((view: any, idx: number) => (
                        <li key={idx} className="font-mono">{view.viewname}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {investigationData.emptyTablesAnalysis && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Empty Tables Analysis</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left font-medium text-gray-700">Table</th>
                            <th className="text-left font-medium text-gray-700">Row Count</th>
                            <th className="text-left font-medium text-gray-700">Foreign Keys</th>
                            <th className="text-left font-medium text-gray-700">Referenced By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {investigationData.emptyTablesAnalysis.map((table: any, idx: number) => (
                            <tr key={idx}>
                              <td className="py-2 font-mono text-gray-900">{table.tableName}</td>
                              <td className="py-2 text-gray-600">{table.rowCount || 0}</td>
                              <td className="py-2 text-gray-600">{table.foreignKeysFrom?.length || 0}</td>
                              <td className="py-2 text-gray-600">{table.referencedBy || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drop Verification */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Table Drop Verification</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Verify if empty/unused tables can be safely dropped.
                </p>
              </div>
              <button
                onClick={fetchDropVerification}
                disabled={dropVerificationLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {dropVerificationLoading ? 'Loading...' : 'Verify Drops'}
              </button>
            </div>

            {dropVerification && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className={`p-4 ${dropVerification.allSafeToDrop ? 'bg-green-50' : 'bg-yellow-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">Drop Verification Summary</h4>
                    <span className={`text-sm font-medium ${dropVerification.allSafeToDrop ? 'text-green-800' : 'text-yellow-800'}`}>
                      {dropVerification.summary.safeToDrop} / {dropVerification.summary.total} tables safe to drop
                    </span>
                  </div>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Safe to Drop</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row Count</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reasons</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dropVerification.tables.map((table: any, index: number) => (
                      <tr key={index}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 font-mono">{table.tableName}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            {table.safeToDrop ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                ✓ Safe
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                ✗ Not Safe
                              </span>
                            )}
                            {table.safeToDrop && (
                              <button
                                onClick={() => dropSafeTables([table.tableName])}
                                className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Drop
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{table.rowCount}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <ul className="list-disc list-inside space-y-1">
                            {table.reasons.map((reason: string, rIndex: number) => (
                              <li key={rIndex}>{reason}</li>
                            ))}
                          </ul>
                          {table.hasForeignKeys && (
                            <div className="mt-2 text-xs text-red-600">
                              <strong>Foreign Keys:</strong>
                              <ul className="list-disc list-inside mt-1">
                                {table.foreignKeyDetails.map((fk: any, fkIndex: number) => (
                                  <li key={fkIndex}>{fk.referencedTable}.{fk.referencedColumn}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {table.hasDependentObjects && table.dependentObjects.length > 0 && (
                            <div className="mt-2 text-xs text-orange-600">
                              <strong>Dependencies:</strong>
                              <ul className="list-disc list-inside mt-1">
                                {table.dependentObjects.map((dep: string, depIndex: number) => (
                                  <li key={depIndex}>{dep}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dropVerification && dropVerification.summary.safeToDrop > 0 && (
                  <div className="p-4 bg-green-50 border-t border-green-200">
                    <button
                      onClick={() => {
                        const safeTables = dropVerification.tables
                          .filter((t: any) => t.safeToDrop)
                          .map((t: any) => t.tableName);
                        dropSafeTables(safeTables);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      Drop All Safe Tables ({dropVerification.summary.safeToDrop})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drop Empty Unused Tables */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Drop Empty Unused Tables</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Drop empty tables that are not needed (l1_support_tickets will be kept).
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchEmptyTablesVerification}
                  disabled={emptyTablesLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {emptyTablesLoading ? 'Loading...' : 'Verify'}
                </button>
                {emptyTablesVerification && emptyTablesVerification.safeToDropCount > 0 && (
                  <button
                    onClick={dropEmptyTables}
                    disabled={emptyTablesDropping}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-semibold"
                  >
                    {emptyTablesDropping ? 'Dropping...' : `Drop ${emptyTablesVerification.safeToDropCount} Tables`}
                  </button>
                )}
              </div>
            </div>

            {emptyTablesVerification && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">Empty Tables Verification</h4>
                    <span className="text-sm font-medium text-gray-700">
                      {emptyTablesVerification.safeToDropCount} / {emptyTablesVerification.totalTables} safe to drop
                    </span>
                  </div>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Table</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row Count</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referenced By</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {emptyTablesVerification.tables.map((table: any, index: number) => (
                      <tr key={index}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 font-mono">{table.tableName}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{table.purpose}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{table.rowCount}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{table.referencedBy}</td>
                        <td className="px-6 py-4 text-sm">
                          {table.keep ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              🔒 Keep
                            </span>
                          ) : table.safeToDrop ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Safe to Drop
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              ✗ Not Safe
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Single Source of Truth Tests */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Single Source of Truth Tests</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Verify that all code uses l1_transaction_facts and no fallbacks exist.
                </p>
              </div>
              <button
                onClick={fetchSingleSourceTests}
                disabled={singleSourceTestsLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {singleSourceTestsLoading ? 'Running...' : 'Run Tests'}
              </button>
            </div>

            {singleSourceTests && (
              <div className="space-y-4">
                <div className={`border rounded-lg p-4 ${
                  singleSourceTests.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">Test Summary</h4>
                    <span className={`text-sm font-medium ${
                      singleSourceTests.success ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {singleSourceTests.summary.passed} / {singleSourceTests.summary.total} tests passed
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-700">✓ Passed: {singleSourceTests.summary.passed}</span>
                    <span className="text-red-700">✗ Failed: {singleSourceTests.summary.failed}</span>
                    <span className="text-yellow-700">⚠ Warnings: {singleSourceTests.summary.warnings}</span>
                    <span className="text-gray-700">⚠ Errors: {singleSourceTests.summary.errors}</span>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Test</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {singleSourceTests.tests.map((test: any, index: number) => (
                        <tr key={index}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{test.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              test.status === 'pass' ? 'bg-green-100 text-green-800' :
                              test.status === 'fail' ? 'bg-red-100 text-red-800' :
                              test.status === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {test.status === 'pass' ? '✓ Pass' : 
                               test.status === 'fail' ? '✗ Fail' : 
                               test.status === 'warn' ? '⚠ Warn' : '⚠ Error'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{test.message}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{test.details || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
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
            📊 Cohort analysis
          </button>
          <button
            onClick={() => setAnalyticsSubTab('customer-data')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              analyticsSubTab === 'customer-data'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            👥 Customer data
          </button>
          <button
            onClick={() => setAnalyticsSubTab('events-data')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              analyticsSubTab === 'events-data'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Events data
          </button>
          <button
            onClick={() => setAnalyticsSubTab('editing-events-data')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              analyticsSubTab === 'editing-events-data'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ✏️ Editing events data
          </button>
          <button
            onClick={() => setAnalyticsSubTab('vanity-metrics')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              analyticsSubTab === 'vanity-metrics'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📈 Vanity metrics
          </button>
          <button
            onClick={() => setAnalyticsSubTab('data-details')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              analyticsSubTab === 'data-details'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📋 Data details
          </button>
          <button
            onClick={() => setAnalyticsSubTab('download')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              analyticsSubTab === 'download'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            ⬇️ Download
          </button>
        </div>

        {/* Content */}
        {analyticsSubTab === 'cohort-analysis' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Filters</h3>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="min-w-[200px]">
                  <CheckboxDropdown
                    label="Account Type"
                    options={['Total Accounts', 'Validated Emails']}
                    selected={[
                      ...(cohortFilters.totalAccounts ? ['Total Accounts'] : []),
                      ...(cohortFilters.validatedEmails ? ['Validated Emails'] : [])
                    ]}
                    onChange={(selected) => setCohortFilters({ 
                      ...cohortFilters, 
                      totalAccounts: selected.includes('Total Accounts'),
                      validatedEmails: selected.includes('Validated Emails')
                    })}
                    placeholder="Select account type..."
                  />
                </div>
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
                <div className="min-w-[200px]">
                  <CheckboxDropdown
                    label="Cohorts"
                    options={cohortData?.weeks || []}
                    selected={cohortFilters.selectedCohorts.length === 0 ? (cohortData?.weeks || []) : cohortFilters.selectedCohorts}
                    onChange={(selected) => setCohortFilters({ ...cohortFilters, selectedCohorts: selected })}
                    placeholder="Select cohorts... (default: all)"
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

            {/* Combined Cohort Analysis Table */}
            {(() => {
              // Get weeks to display - if selectedCohorts is empty, show all weeks
              const allWeeks = cohortData?.weeks || [];
              const displayWeeks = cohortFilters.selectedCohorts.length === 0 
                ? allWeeks 
                : cohortFilters.selectedCohorts.filter((w: string) => allWeeks.includes(w));
              
              return (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Onboarding and engagement KPIs by signup week cohort (each column is a different cohort)</h3>
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
                        {displayWeeks.map((week: string) => (
                          <th key={week} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                            {week}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {/* Engagement Signals Section - MOVED TO TOP */}
                      <tr className="bg-gray-50">
                        <td colSpan={displayWeeks.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
                          Engagement Signals
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Avg transactions per user (of those who uploaded)</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.avgTransactionsPerUser || '-'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Users with transactions</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.usersWithTransactions || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Logged in 2 or more unique days</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.hasUserEventsTable 
                              ? (cohortData?.engagement?.[week]?.loggedInTwoPlusDays || 0)
                              : <span className="text-gray-400 italic">Requires user_events table</span>}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Avg days logged in per month (of those who logged in 2 or more days)</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.hasUserEventsTable 
                              ? (cohortData?.engagement?.[week]?.avgDaysLoggedInPerMonth || '-')
                              : <span className="text-gray-400 italic">Requires user_events table</span>}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Logged in 2 or more unique months</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.hasUserEventsTable 
                              ? (cohortData?.engagement?.[week]?.loggedInTwoPlusMonths || 0)
                              : <span className="text-gray-400 italic">Requires user_events table</span>}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Average number of unique months users have logged in, of those who have logged in more than one unique month</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.hasUserEventsTable 
                              ? (cohortData?.engagement?.[week]?.avgUniqueMonthsLoggedIn || '-')
                              : <span className="text-gray-400 italic">Requires user_events table</span>}
                          </td>
                        ))}
                      </tr>
                      {/* Engagement Section */}
                      <tr className="bg-gray-50">
                        <td colSpan={displayWeeks.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
                          Number of users by activity completed
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Onboarding completed</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.onboardingCompleted || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Uploaded first statement</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.uploadedFirstStatement || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Uploaded two statements</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.uploadedTwoStatements || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Uploaded three+ statements</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.uploadedThreePlusStatements || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Uploaded statements for more than one unique bank</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.uploadedMoreThanOneBank || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Uploaded statements for more than two unique banks</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.uploadedMoreThanTwoBanks || 0}
                          </td>
                        ))}
                      </tr>
                      {/* Time to Achieve Section */}
                      <tr className="bg-gray-50">
                        <td colSpan={displayWeeks.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
                          Time to achieve (of users completing onboarding)
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Average time to onboard (minutes)</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.avgTimeToOnboardMinutes !== null && cohortData?.engagement?.[week]?.avgTimeToOnboardMinutes !== undefined 
                              ? cohortData?.engagement?.[week]?.avgTimeToOnboardMinutes 
                              : '-'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Number of users who uploaded on the first day</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.usersUploadedFirstDay || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Average time to first upload, who uploaded on their first day (minutes)</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.avgTimeToFirstUploadFirstDayMinutes !== null && cohortData?.engagement?.[week]?.avgTimeToFirstUploadFirstDayMinutes !== undefined 
                              ? cohortData?.engagement?.[week]?.avgTimeToFirstUploadFirstDayMinutes 
                              : '-'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Number of users who uploaded after the first day</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.usersUploadedAfterFirstDay || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Average time to first upload, who uploaded after the first day (days)</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.engagement?.[week]?.avgTimeToFirstUploadAfterFirstDayDays !== null && cohortData?.engagement?.[week]?.avgTimeToFirstUploadAfterFirstDayDays !== undefined 
                              ? cohortData?.engagement?.[week]?.avgTimeToFirstUploadAfterFirstDayDays 
                              : '-'}
                          </td>
                        ))}
                      </tr>
                      {/* Activation Section - MOVED TO BOTTOM */}
                      <tr className="bg-gray-50">
                        <td colSpan={displayWeeks.length + 1} className="px-4 py-2 text-xs font-semibold text-gray-700 uppercase">
                          Number of users by onboarding step completed
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Count starting onboarding</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countStartingOnboarding || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop off: emotional calibration</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep1 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop off: financial context</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep2 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop off: motivation</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep3 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop off: acquisition source</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep4 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop off: insight preferences</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep5 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Drop off: account profile</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countDropOffStep7 || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Count completed onboarding</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countCompletedOnboarding || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Started but not completed (no drop-off recorded)</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.countStartedButNotCompleted || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Avg time to onboard (minutes)</td>
                        {displayWeeks.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {cohortData?.activation?.[week]?.avgTimeToOnboardMinutes !== null && cohortData?.activation?.[week]?.avgTimeToOnboardMinutes !== undefined 
                              ? cohortData?.activation?.[week]?.avgTimeToOnboardMinutes 
                              : '-'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
                </div>
              );
            })()}


            {/* Engagement Chart - Number of Days Logged In */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Unique days logged in per week from first day signed up</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Y-axis: Total unique days logged in per week | X-axis: Week from signup (12 weeks)
                </p>
              </div>
              
              {/* Chart Filters */}
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Filters</h3>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="min-w-[200px]">
                    <CheckboxDropdown
                      label="Account Type"
                      options={['Total Accounts', 'Validated Emails']}
                      selected={[
                        ...(chartFilters.totalAccounts ? ['Total Accounts'] : []),
                        ...(chartFilters.validatedEmails ? ['Validated Emails'] : [])
                      ]}
                      onChange={(selected) => setChartFilters({ 
                        ...chartFilters, 
                        totalAccounts: selected.includes('Total Accounts'),
                        validatedEmails: selected.includes('Validated Emails')
                      })}
                      placeholder="Select account type..."
                    />
                  </div>
                  <div className="min-w-[200px]">
                    <CheckboxDropdown
                      label="Intent Categories"
                      options={intentCategoriesLoading ? [] : intentCategories}
                      selected={chartFilters.intentCategories}
                      onChange={(selected) => setChartFilters({ ...chartFilters, intentCategories: selected })}
                      placeholder={intentCategoriesLoading ? 'Loading...' : 'Select intent categories...'}
                      disabled={intentCategoriesLoading}
                    />
                  </div>
                  <div className="min-w-[200px]">
                    <CheckboxDropdown
                      label="Cohorts"
                      options={cohortData?.weeks || []}
                      selected={chartFilters.cohorts.length === 0 ? (cohortData?.weeks || []) : chartFilters.cohorts}
                      onChange={(selected) => setChartFilters({ ...chartFilters, cohorts: selected })}
                      placeholder="Select cohorts... (default: all)"
                    />
                  </div>
                  <div className="min-w-[200px]">
                    <CheckboxDropdown
                      label="Data Coverage"
                      options={['1 upload', '2 uploads', '3+ uploads']}
                      selected={chartFilters.dataCoverage}
                      onChange={(selected) => setChartFilters({ ...chartFilters, dataCoverage: selected })}
                      placeholder="Select data coverage..."
                    />
                  </div>
                  <button
                    onClick={fetchEngagementChart}
                    disabled={engagementChartLoading}
                    className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                  >
                    {engagementChartLoading ? 'Loading...' : 'Refresh Chart'}
                  </button>
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
                    <LineChart 
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      data={(() => {
                        // Create unified data structure - all lines share same x-axis (weeks 0-11)
                        const allWeeks = Array.from({ length: 12 }, (_, i) => i);
                        
                        // Build a map of week -> user data for each user
                        const userDataByWeek = new Map<number, Map<number, number>>();
                        engagementChartData.userLines.forEach((userLine: any) => {
                          const weekMap = new Map<number, number>();
                          userLine.weeks.forEach((w: any) => {
                            weekMap.set(w.week, w.loginDays);
                          });
                          userDataByWeek.set(userLine.userId, weekMap);
                        });
                        
                        // Create unified data array where each entry has week and all user values
                        return allWeeks.map(weekNum => {
                          const dataPoint: any = { week: weekNum };
                          engagementChartData.userLines.forEach((userLine: any) => {
                            const weekMap = userDataByWeek.get(userLine.userId);
                            dataPoint[`user_${userLine.userId}`] = weekMap?.get(weekNum) || 0;
                          });
                          return dataPoint;
                        });
                      })()}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="week"
                        type="number"
                        domain={[0, 11]}
                        ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]}
                      />
                      <YAxis />
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
                        const color = `hsl(${(idx * 137.5) % 360}, 70%, 50%)`;
                        return (
                          <Line
                            key={userLine.userId}
                            type="monotone"
                            dataKey={`user_${userLine.userId}`}
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
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Vanity Metrics</h3>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="min-w-[200px]">
                    <CheckboxDropdown
                      label="Account Type"
                      options={['Total Accounts', 'Validated Emails']}
                      selected={[
                        ...(vanityFilters.totalAccounts ? ['Total Accounts'] : []),
                        ...(vanityFilters.validatedEmails ? ['Validated Emails'] : [])
                      ]}
                      onChange={(selected) => setVanityFilters({ 
                        ...vanityFilters, 
                        totalAccounts: selected.includes('Total Accounts'),
                        validatedEmails: selected.includes('Validated Emails')
                      })}
                      placeholder="Select account type..."
                    />
                  </div>
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
                  <div className="min-w-[200px]">
                    <CheckboxDropdown
                      label="Cohorts"
                      options={cohortData?.weeks || []}
                      selected={vanityFilters.cohorts.length === 0 ? (cohortData?.weeks || []) : vanityFilters.cohorts}
                      onChange={(selected) => setVanityFilters({ ...vanityFilters, cohorts: selected })}
                      placeholder="Select cohorts... (default: all)"
                    />
                  </div>
                  <div className="min-w-[200px]">
                    <CheckboxDropdown
                      label="Data Coverage"
                      options={['1 upload', '2 uploads', '3+ uploads']}
                      selected={vanityFilters.dataCoverage}
                      onChange={(selected) => setVanityFilters({ ...vanityFilters, dataCoverage: selected })}
                      placeholder="Select data coverage..."
                    />
                  </div>
                  <button
                    onClick={fetchVanityMetrics}
                    disabled={vanityLoading}
                    className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm"
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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Total users</td>
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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">New users</td>
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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Weekly active users</td>
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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Monthly active users</td>
                        {vanityData?.weeks?.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {vanityData.metrics?.[week]?.monthlyActiveUsers || 0}
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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Total transactions uploaded</td>
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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">New transactions uploaded</td>
                        {vanityData?.weeks?.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {vanityData.metrics?.[week]?.newTransactionsUploaded || 0}
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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Total transactions recategorised</td>
                        {vanityData?.weeks?.map((week: string) => (
                          <td key={week} className="px-4 py-3 text-sm text-gray-600">
                            {vanityData.metrics?.[week]?.totalTransactionsRecategorised || 0}
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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">Total unique banks uploaded</td>
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
        
        {analyticsSubTab === 'data-details' && (
          <div className="space-y-6">
            {/* Cohort Analysis Tab - Data Details */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Cohort Analysis - Data Details</h2>
                <p className="text-gray-600 mt-1">Documentation of all KPIs, formulas, and data sources used in the Cohort Analysis tab</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KPI / Metric</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formula / Calculation</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {/* Activation Metrics */}
                  <tr className="bg-gray-100">
                    <td colSpan={3} className="px-6 py-3 text-sm font-bold text-gray-900">
                      ACTIVATION METRICS
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users by onboarding step completed - Started onboarding</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) WHERE created_at IS NOT NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (created_at column)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users by onboarding step completed - Drop-off at Step 1</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) FILTER WHERE last_step = 1 AND completed_at IS NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (last_step, completed_at columns)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users by onboarding step completed - Drop-off at Step 2</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) FILTER WHERE last_step = 2 AND completed_at IS NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (last_step, completed_at columns)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users by onboarding step completed - Drop-off at Step 3</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) FILTER WHERE last_step = 3 AND completed_at IS NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (last_step, completed_at columns)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users by onboarding step completed - Drop-off at Step 4</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) FILTER WHERE last_step = 4 AND completed_at IS NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (last_step, completed_at columns)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users by onboarding step completed - Drop-off at Step 5</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) FILTER WHERE last_step = 5 AND completed_at IS NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (last_step, completed_at columns)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users by onboarding step completed - Drop-off at Step 6</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) FILTER WHERE last_step = 6 AND completed_at IS NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (last_step, completed_at columns)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users by onboarding step completed - Drop-off at Step 7</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) FILTER WHERE last_step = 7 AND completed_at IS NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (last_step, completed_at columns)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users by onboarding step completed - Completed onboarding</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) FILTER WHERE completed_at IS NOT NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (completed_at column)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Started but not completed (no drop-off recorded)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">MAX(0, starting - completed - sum of all drop-offs)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (calculated from created_at, completed_at, last_step)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Average time to onboard (minutes)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) FILTER WHERE completed_at IS NOT NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (created_at, completed_at columns)</td>
                  </tr>
                  
                  {/* Engagement Metrics - Onboarding and Data Coverage */}
                  <tr className="bg-gray-100">
                    <td colSpan={3} className="px-6 py-3 text-sm font-bold text-gray-900">
                      ENGAGEMENT METRICS - ONBOARDING AND DATA COVERAGE
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Onboarding completed</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT user_id) FILTER WHERE completed_at IS NOT NULL</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (completed_at column)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Uploaded first statement</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT user_id) FILTER WHERE transaction EXISTS</td>
                    <td className="px-6 py-4 text-sm text-gray-600">transactions table (JOIN with users table)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Uploaded two statements</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT user_id) FILTER WHERE COUNT(DISTINCT upload_session_id) {'>='} 2</td>
                    <td className="px-6 py-4 text-sm text-gray-600">transactions table (upload_session_id column)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Uploaded three or more statements</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT user_id) FILTER WHERE COUNT(DISTINCT upload_session_id) {'>='} 3</td>
                    <td className="px-6 py-4 text-sm text-gray-600">transactions table (upload_session_id column)</td>
                  </tr>
                  
                  {/* Engagement Metrics - Time to Achieve */}
                  <tr className="bg-gray-100">
                    <td colSpan={3} className="px-6 py-3 text-sm font-bold text-gray-900">
                      ENGAGEMENT METRICS - TIME TO ACHIEVE
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users who uploaded on the first day</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT user_id) FILTER WHERE DATE(first_transaction_date) = DATE(created_at)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">transactions table (MIN(created_at) per user) JOIN users table (created_at)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Average time to first upload, who uploaded on their first day (minutes)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">AVG(EXTRACT(EPOCH FROM (first_transaction_date - created_at)) / 60) FILTER WHERE DATE(first_transaction_date) = DATE(created_at)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">transactions table (MIN(created_at) per user) JOIN users table (created_at)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Number of users who uploaded after the first day</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT user_id) FILTER WHERE DATE(first_transaction_date) {'>'} DATE(created_at)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">transactions table (MIN(created_at) per user) JOIN users table (created_at)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Average time to first upload, who uploaded after the first day (days)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">AVG(EXTRACT(EPOCH FROM (first_transaction_date - created_at)) / 86400) FILTER WHERE DATE(first_transaction_date) {'>'} DATE(created_at)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">transactions table (MIN(created_at) per user) JOIN users table (created_at)</td>
                  </tr>
                  
                  {/* Engagement Metrics - Engagement Signals */}
                  <tr className="bg-gray-100">
                    <td colSpan={3} className="px-6 py-3 text-sm font-bold text-gray-900">
                      ENGAGEMENT METRICS - ENGAGEMENT SIGNALS
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Average transactions per user</td>
                    <td className="px-6 py-4 text-sm text-gray-600">AVG(COUNT(*) per user) FILTER WHERE transaction_count {'>'} 0</td>
                    <td className="px-6 py-4 text-sm text-gray-600">transactions table (COUNT(*) grouped by user_id)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Users with transactions</td>
                    <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT user_id) FILTER WHERE transaction_count {'>'} 0</td>
                    <td className="px-6 py-4 text-sm text-gray-600">transactions table (COUNT(*) grouped by user_id)</td>
                  </tr>
                  
                  {/* Bank Statement Source Tracking */}
                  <tr className="bg-gray-100">
                    <td colSpan={3} className="px-6 py-3 text-sm font-bold text-gray-900">
                      BANK STATEMENT SOURCE TRACKING
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Bank Statement Source - Bank</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{`metadata->'bank' FROM user_events WHERE event_type IN ('statement_upload', 'statement_linked')`}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">user_events table (metadata JSONB column, event_type = {'statement_upload'} or {'statement_linked'})</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Bank Statement Source - Account Type</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{`metadata->'accountType' FROM user_events WHERE event_type IN ('statement_upload', 'statement_linked')`}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">user_events table (metadata JSONB column, event_type = {'statement_upload'} or {'statement_linked'})</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Bank Statement Source - Uploaded or Linked</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{`metadata->'source' FROM user_events WHERE event_type IN ('statement_upload', 'statement_linked')`}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">user_events table (metadata JSONB column, event_type = {'statement_upload'} or {'statement_linked'}, source = {'uploaded'} or {'linked'})</td>
                  </tr>
                  
                  {/* Filters */}
                  <tr className="bg-gray-100">
                    <td colSpan={3} className="px-6 py-3 text-sm font-bold text-gray-900">
                      FILTERS
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Account Type - Total Accounts</td>
                    <td className="px-6 py-4 text-sm text-gray-600">No filter applied (includes all accounts)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (all records)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Account Type - Validated Emails</td>
                    <td className="px-6 py-4 text-sm text-gray-600">FILTER WHERE email_validated = true</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (email_validated column)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Intent Categories</td>
                    <td className="px-6 py-4 text-sm text-gray-600">FILTER WHERE motivation = ANY(selected_categories)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (motivation column)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Cohorts (Signup Weeks)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">FILTER WHERE DATE_TRUNC('week', created_at) = selected_week</td>
                    <td className="px-6 py-4 text-sm text-gray-600">users table (created_at column, grouped by week)</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Data Coverage</td>
                    <td className="px-6 py-4 text-sm text-gray-600">FILTER users based on transaction upload counts (1 upload, 2 uploads, 3+ uploads)</td>
                    <td className="px-6 py-4 text-sm text-gray-600">transactions table (upload_session_id column, COUNT DISTINCT per user)</td>
                  </tr>
                </tbody>
                </table>
              </div>
            </div>
            
            {/* Customer Data Tab - Data Details */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Customer Data Tab - Data Details</h2>
                <p className="text-gray-600 mt-1">Documentation of all columns displayed in the Customer Data tab</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column / Data Point</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formula / Calculation</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">User ID</td>
                      <td className="px-6 py-4 text-sm text-gray-600">u.id</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table (id column)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">First Name</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COALESCE(p.first_name, NULL) or o.first_name</td>
                      <td className="px-6 py-4 text-sm text-gray-600">l0_pii_users table (first_name column) OR onboarding_responses table (first_name column) - PII isolated</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Province/Region</td>
                      <td className="px-6 py-4 text-sm text-gray-600">p.province_region or o.province_region</td>
                      <td className="px-6 py-4 text-sm text-gray-600">l0_pii_users table OR onboarding_responses table (province_region column)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Emotional State</td>
                      <td className="px-6 py-4 text-sm text-gray-600">u.emotional_state or o.emotional_state (TEXT[] array)</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table OR onboarding_responses table (emotional_state column, stored as array)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Financial Context</td>
                      <td className="px-6 py-4 text-sm text-gray-600">u.financial_context or o.financial_context (TEXT[] array)</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table OR onboarding_responses table (financial_context column, stored as array)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Motivation</td>
                      <td className="px-6 py-4 text-sm text-gray-600">u.motivation or o.motivation</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table OR onboarding_responses table (motivation column)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Acquisition Source</td>
                      <td className="px-6 py-4 text-sm text-gray-600">u.acquisition_source or o.acquisition_source</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table OR onboarding_responses table (acquisition_source column)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Insight Preferences</td>
                      <td className="px-6 py-4 text-sm text-gray-600">u.insight_preferences or o.insight_preferences (TEXT[] array)</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table OR onboarding_responses table (insight_preferences column, stored as array)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Email Validated</td>
                      <td className="px-6 py-4 text-sm text-gray-600">u.email_validated (defaults to false if column doesn't exist)</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table (email_validated column, BOOLEAN)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Is Active</td>
                      <td className="px-6 py-4 text-sm text-gray-600">u.is_active (defaults to true if column doesn't exist)</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table (is_active column, BOOLEAN)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Account Created</td>
                      <td className="px-6 py-4 text-sm text-gray-600">u.created_at or COALESCE(p.created_at, u.created_at)</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table OR l0_pii_users table (created_at column)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Onboarding Completed</td>
                      <td className="px-6 py-4 text-sm text-gray-600">u.completed_at or o.completed_at</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table OR onboarding_responses table (completed_at column)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Onboarding Status</td>
                      <td className="px-6 py-4 text-sm text-gray-600">Calculated: completed_at ? 'Completed' : last_step ? 'Dropped after Step X' : 'Not started'</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table (calculated from completed_at and last_step columns)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Transaction Count</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT t.id) per user</td>
                      <td className="px-6 py-4 text-sm text-gray-600">transactions table (JOIN with users table, aggregated by user_id)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Upload Session Count</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT upload_session_id) per user</td>
                      <td className="px-6 py-4 text-sm text-gray-600">transactions table (upload_session_id column, aggregated by user_id)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">First Transaction Date</td>
                      <td className="px-6 py-4 text-sm text-gray-600">MIN(created_at) per user</td>
                      <td className="px-6 py-4 text-sm text-gray-600">transactions table (created_at column, aggregated by user_id)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Events Data Tab - Data Details */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Events Data Tab - Data Details</h2>
                <p className="text-gray-600 mt-1">Documentation of all columns displayed in the Events Data tab</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column / Data Point</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formula / Calculation</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Event ID</td>
                      <td className="px-6 py-4 text-sm text-gray-600">e.id</td>
                      <td className="px-6 py-4 text-sm text-gray-600">user_events table (id column)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">User ID</td>
                      <td className="px-6 py-4 text-sm text-gray-600">e.user_id</td>
                      <td className="px-6 py-4 text-sm text-gray-600">user_events table (user_id column, foreign key to users table)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">First Name</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COALESCE(p.first_name, 'Unknown')</td>
                      <td className="px-6 py-4 text-sm text-gray-600">l0_pii_users table (first_name column) - PII isolated, no email or last name shown</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Event Type</td>
                      <td className="px-6 py-4 text-sm text-gray-600">e.event_type</td>
                      <td className="px-6 py-4 text-sm text-gray-600">user_events table (event_type column, e.g., 'login', 'dashboard_view', etc.)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Event Timestamp</td>
                      <td className="px-6 py-4 text-sm text-gray-600">e.event_timestamp (displayed as created_at in UI)</td>
                      <td className="px-6 py-4 text-sm text-gray-600">user_events table (event_timestamp column, TIMESTAMP WITH TIME ZONE)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Metadata</td>
                      <td className="px-6 py-4 text-sm text-gray-600">e.metadata (JSONB object)</td>
                      <td className="px-6 py-4 text-sm text-gray-600">user_events table (metadata column, JSONB - optional additional event data)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Vanity Metrics Tab - Data Details */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Vanity Metrics Tab - Data Details</h2>
                <p className="text-gray-600 mt-1">Documentation of all metrics displayed in the Vanity Metrics tab</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KPI / Metric</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Formula / Calculation</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Total users (cumulative)</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) WHERE created_at {'<='} weekEnd</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table (created_at column, cumulative count up to end of week)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Weekly active users</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT user_id) WHERE event_type = 'login' AND event_timestamp BETWEEN weekStart AND weekEnd</td>
                      <td className="px-6 py-4 text-sm text-gray-600">user_events table (event_type, event_timestamp columns) JOIN users table</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">New users</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) WHERE created_at BETWEEN weekStart AND weekEnd</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table (created_at column, users who signed up during the week)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly active users</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT user_id) WHERE event_type = 'login' AND event_timestamp BETWEEN monthStart AND monthEnd</td>
                      <td className="px-6 py-4 text-sm text-gray-600">user_events table (event_type, event_timestamp columns) JOIN users table, filtered by month containing the week</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">New users per month</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) WHERE created_at BETWEEN monthStart AND monthEnd</td>
                      <td className="px-6 py-4 text-sm text-gray-600">users table (created_at column, users who signed up during the month containing the week)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Total transactions uploaded (cumulative)</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) WHERE created_at {'<='} weekEnd</td>
                      <td className="px-6 py-4 text-sm text-gray-600">transactions table (created_at column, cumulative count up to end of week)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">New transactions uploaded</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) WHERE created_at BETWEEN weekStart AND weekEnd</td>
                      <td className="px-6 py-4 text-sm text-gray-600">transactions table (created_at column, transactions uploaded during the week)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Total transactions recategorised</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(*) WHERE created_at BETWEEN weekStart AND weekEnd</td>
                      <td className="px-6 py-4 text-sm text-gray-600">categorization_learning table (created_at column, transactions recategorized during the week)</td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">Total unique banks uploaded</td>
                      <td className="px-6 py-4 text-sm text-gray-600">COUNT(DISTINCT account) WHERE created_at BETWEEN weekStart AND weekEnd</td>
                      <td className="px-6 py-4 text-sm text-gray-600">transactions table (account column, distinct bank/account names uploaded during the week)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Source Dataset Columns */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Source Dataset Columns</h2>
                <p className="text-gray-600 mt-1">Complete list of all columns/data points available in the customer, events, and transactions source datasets</p>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">users table (Customer Data Source)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (user identifier)</li>
                    <li><strong>email</strong> - TEXT UNIQUE NOT NULL (user email address)</li>
                    <li><strong>password_hash</strong> - TEXT NOT NULL (hashed password for authentication, bcrypt hashed)</li>
                    <li><strong>display_name</strong> - TEXT (user's display name, shown in UI)</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE (when user account was created)</li>
                    <li><strong>completed_at</strong> - TIMESTAMP WITH TIME ZONE (when onboarding was completed, NULL if not completed)</li>
                    <li><strong>last_step</strong> - INTEGER (last onboarding step reached, 0 if not started, 1-7 for steps)</li>
                    <li><strong>motivation</strong> - TEXT (user's primary motivation/intent category from onboarding)</li>
                    <li><strong>motivation_other</strong> - TEXT (free-text field if user selected "Other" for motivation)</li>
                    <li><strong>emotional_state</strong> - TEXT[] (array of emotional states selected during onboarding)</li>
                    <li><strong>financial_context</strong> - TEXT[] (array of financial contexts selected during onboarding)</li>
                    <li><strong>acquisition_source</strong> - TEXT (how user found the product)</li>
                    <li><strong>acquisition_other</strong> - TEXT (free-text field if user selected "Other" for acquisition source)</li>
                    <li><strong>insight_preferences</strong> - TEXT[] (array of insight types user wants to receive)</li>
                    <li><strong>insight_other</strong> - TEXT (free-text field for additional insight preferences)</li>
                    <li><strong>email_validated</strong> - BOOLEAN (whether user's email has been validated)</li>
                    <li><strong>is_active</strong> - BOOLEAN (whether user account is active/not blocked)</li>
                    <li><strong>updated_at</strong> - TIMESTAMP WITH TIME ZONE (last update timestamp)</li>
                    <li><strong>login_attempts</strong> - INTEGER (number of login attempts, used for security)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">transactions table (Transactions Data Source - Legacy)</h3>
                  <p className="text-xs text-gray-500 mb-2 italic">Note: After L0/L1/L2 migration, new transactions are stored in l1_transaction_facts. This table may still contain legacy data.</p>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (transaction identifier)</li>
                    <li><strong>user_id</strong> - INTEGER REFERENCES users(id) ON DELETE CASCADE (foreign key to users table)</li>
                    <li><strong>date</strong> - DATE NOT NULL (transaction date from bank statement)</li>
                    <li><strong>description</strong> - TEXT NOT NULL (full transaction description from statement)</li>
                    <li><strong>merchant</strong> - TEXT (extracted merchant name, first part of description)</li>
                    <li><strong>amount</strong> - DECIMAL(10, 2) NOT NULL (transaction amount, positive for income, negative for expenses)</li>
                    <li><strong>cashflow</strong> - VARCHAR(50) CHECK (cashflow IN ('income', 'expense', 'other')) (type: 'income', 'expense', or 'other')</li>
                    <li><strong>category</strong> - VARCHAR(255) (categorized transaction category, e.g., 'Food', 'Bills')</li>
                    <li><strong>account</strong> - VARCHAR(255) (bank/account name from statement, e.g., 'RBC Chequing')</li>
                    <li><strong>label</strong> - VARCHAR(255) (sub-category label, e.g., 'Groceries', 'Rent')</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when transaction was imported/uploaded)</li>
                    <li><strong>upload_session_id</strong> - TEXT (identifier for the upload session/batch, groups transactions from same PDF upload)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">l1_transaction_facts table (Transactions Data Source - Post-Migration)</h3>
                  <p className="text-xs text-gray-500 mb-2 italic">Note: This table is created during L0/L1/L2 migration. New transactions are written here after migration. Uses tokenized_user_id for privacy.</p>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (transaction identifier)</li>
                    <li><strong>tokenized_user_id</strong> - TEXT NOT NULL REFERENCES l0_user_tokenization(tokenized_id) (tokenized user identifier for privacy)</li>
                    <li><strong>transaction_date</strong> - DATE NOT NULL (transaction date from bank statement)</li>
                    <li><strong>description</strong> - TEXT NOT NULL (full transaction description from statement)</li>
                    <li><strong>merchant</strong> - TEXT (extracted merchant name, first part of description)</li>
                    <li><strong>amount</strong> - DECIMAL(10, 2) NOT NULL (transaction amount, positive for income, negative for expenses)</li>
                    <li><strong>cashflow</strong> - VARCHAR(50) CHECK (cashflow IN ('income', 'expense', 'other')) (type: 'income', 'expense', or 'other')</li>
                    <li><strong>category</strong> - VARCHAR(255) (categorized transaction category, e.g., 'Food', 'Bills')</li>
                    <li><strong>account</strong> - VARCHAR(255) (bank/account name from statement, e.g., 'RBC Chequing')</li>
                    <li><strong>label</strong> - VARCHAR(255) (sub-category label, e.g., 'Groceries', 'Rent')</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when transaction was imported/uploaded)</li>
                    <li><strong>upload_session_id</strong> - TEXT (identifier for the upload session/batch, groups transactions from same PDF upload)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">l0_user_tokenization table (User Tokenization - Post-Migration)</h3>
                  <p className="text-xs text-gray-500 mb-2 italic">Note: This table is created during L0/L1/L2 migration. Maps user_id to tokenized_id for privacy in analytics tables.</p>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (tokenization record identifier)</li>
                    <li><strong>user_id</strong> - INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE (links to users table)</li>
                    <li><strong>tokenized_id</strong> - TEXT UNIQUE NOT NULL (tokenized identifier used in l1_transaction_facts)</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when tokenization was created)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">user_events table (Events Data Source)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (event identifier)</li>
                    <li><strong>user_id</strong> - INTEGER REFERENCES users(id) ON DELETE CASCADE (foreign key to users table)</li>
                    <li><strong>event_type</strong> - TEXT NOT NULL (type of event, e.g., 'login', 'dashboard_view', 'transaction_uploaded')</li>
                    <li><strong>event_timestamp</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when the event occurred)</li>
                    <li><strong>metadata</strong> - JSONB (optional JSON object containing additional event-specific data)</li>
                  </ul>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Additional Tables (Referenced but not displayed in these tabs)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>l0_pii_users table:</strong> Contains PII (Personally Identifiable Information) isolated from main users table - includes first_name, last_name, email, date_of_birth, recovery_phone, province_region</li>
                    <li><strong>onboarding_responses table:</strong> Legacy table containing onboarding data (may exist if migration not yet run) - similar structure to users table fields</li>
                    <li><strong>categorization_learning table:</strong> Stores user corrections to transaction categorization - includes user_id, description_pattern, original_category, corrected_category, corrected_label, frequency, created_at</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Additional Tables (Not referenced in these tabs) */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Additional Tables (Not referenced in these tabs)</h2>
                <p className="text-gray-600 mt-1">Complete list of all additional tables and data points we collect beyond the main source datasets</p>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">l0_pii_users table (PII - Personally Identifiable Information)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (PII record identifier)</li>
                    <li><strong>internal_user_id</strong> - INTEGER UNIQUE NOT NULL REFERENCES users(id) (links to users table, not exposed to analytics)</li>
                    <li><strong>email</strong> - TEXT NOT NULL UNIQUE (user email address - PII)</li>
                    <li><strong>first_name</strong> - TEXT (user's first name - PII)</li>
                    <li><strong>last_name</strong> - TEXT (user's last name - PII)</li>
                    <li><strong>date_of_birth</strong> - DATE (user's date of birth - PII)</li>
                    <li><strong>recovery_phone</strong> - TEXT (user's recovery phone number - PII)</li>
                    <li><strong>province_region</strong> - TEXT (user's province/region - PII)</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE (when PII record was created)</li>
                    <li><strong>updated_at</strong> - TIMESTAMP WITH TIME ZONE (when PII record was last updated)</li>
                    <li><strong>deleted_at</strong> - TIMESTAMP WITH TIME ZONE (soft delete timestamp for PIPEDA compliance - 30 day retention)</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2 italic">Purpose: Isolates PII from main users table for privacy compliance. Data is retained for 30 days after deletion request per PIPEDA requirements.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">categorization_learning table (Machine Learning Data)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (learning record identifier)</li>
                    <li><strong>user_id</strong> - INTEGER REFERENCES users(id) (foreign key to users table)</li>
                    <li><strong>description_pattern</strong> - TEXT (transaction description pattern/merchant name)</li>
                    <li><strong>original_category</strong> - VARCHAR(255) (original auto-categorized category)</li>
                    <li><strong>corrected_category</strong> - VARCHAR(255) (user-corrected category)</li>
                    <li><strong>corrected_label</strong> - VARCHAR(255) (user-corrected sub-category label)</li>
                    <li><strong>frequency</strong> - INTEGER (how many times this correction has been applied)</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE (when correction was first made)</li>
                    <li><strong>updated_at</strong> - TIMESTAMP WITH TIME ZONE (when correction was last used)</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2 italic">Purpose: Stores user corrections to transaction categorization to improve future auto-categorization accuracy.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">onboarding_responses table (Legacy - may exist pre-migration)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (onboarding response identifier)</li>
                    <li><strong>user_id</strong> - INTEGER REFERENCES users(id) (foreign key to users table)</li>
                    <li><strong>motivation</strong> - TEXT (user's primary motivation/intent category)</li>
                    <li><strong>motivation_other</strong> - TEXT (free-text field if user selected "Other" for motivation)</li>
                    <li><strong>emotional_state</strong> - TEXT[] (array of emotional states selected)</li>
                    <li><strong>financial_context</strong> - TEXT[] (array of financial contexts selected)</li>
                    <li><strong>acquisition_source</strong> - TEXT (how user found the product)</li>
                    <li><strong>acquisition_other</strong> - TEXT (free-text field if user selected "Other" for acquisition)</li>
                    <li><strong>insight_preferences</strong> - TEXT[] (array of insight types user wants to receive)</li>
                    <li><strong>insight_other</strong> - TEXT (free-text field for additional insight preferences)</li>
                    <li><strong>last_step</strong> - INTEGER (last onboarding step reached, 0 if not started, 1-7 for steps)</li>
                    <li><strong>completed_at</strong> - TIMESTAMP WITH TIME ZONE (when onboarding was completed, NULL if not completed)</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE (when onboarding response was created)</li>
                    <li><strong>updated_at</strong> - TIMESTAMP WITH TIME ZONE (last update timestamp)</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2 italic">Purpose: Legacy table containing onboarding questionnaire data. After migration, this data is merged into the users table. This table may still exist for backward compatibility.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">user_events table metadata fields (Additional data collected in events)</h3>
                  <p className="text-sm text-gray-600 mb-2">The user_events table's metadata JSONB field contains additional structured data depending on event_type:</p>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>consent events (event_type = 'consent'):</strong>
                      <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                        <li><strong>consentType</strong> - TEXT ('account_creation', 'cookie_banner', 'first_upload', 'account_linking', 'settings_update')</li>
                        <li><strong>choice</strong> - TEXT (user's consent choice, e.g., 'accept_all', 'essential_only', 'agreed')</li>
                        <li><strong>setting</strong> - TEXT (for settings_update events, the setting name that was changed)</li>
                        <li><strong>value</strong> - BOOLEAN (for settings_update events, the new setting value)</li>
                        <li><strong>version</strong> - TEXT (optional, version of consent policy)</li>
                        <li><strong>scope</strong> - TEXT (optional, scope of consent)</li>
                        <li><strong>timestamp</strong> - TEXT (ISO timestamp of when consent was given)</li>
                      </ul>
                    </li>
                    <li><strong>feedback events (event_type = 'feedback'):</strong>
                      <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                        <li><strong>usefulness</strong> - TEXT (Likert scale: 'Very unhelpful', 'Somewhat unhelpful', 'Neutral', 'Somewhat helpful', 'Very helpful')</li>
                        <li><strong>trust</strong> - TEXT (Likert scale: 'Not at all', 'Not really', 'Neutral', 'Somewhat', 'Yes')</li>
                        <li><strong>problems</strong> - TEXT (free text, max 250 words, user complaints/bugs)</li>
                        <li><strong>learnMore</strong> - TEXT (free text, max 250 words, what user wants to learn)</li>
                      </ul>
                    </li>
                    <li><strong>statement_upload events (event_type = 'statement_upload'):</strong>
                      <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                        <li><strong>bank</strong> - TEXT (detected bank name, e.g., 'RBC', 'TD', 'Scotiabank')</li>
                        <li><strong>accountType</strong> - TEXT (detected account type, e.g., 'Credit Card', 'Checking', 'Savings')</li>
                        <li><strong>filename</strong> - TEXT (original PDF filename)</li>
                      </ul>
                    </li>
                    <li><strong>statement_import events (event_type = 'statement_import'):</strong>
                      <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                        <li><strong>bank</strong> - TEXT (bank name from imported statement)</li>
                        <li><strong>accountType</strong> - TEXT (account type from imported statement)</li>
                        <li><strong>transactionCount</strong> - INTEGER (number of transactions imported)</li>
                        <li><strong>upload_session_id</strong> - TEXT (identifier for the upload session)</li>
                      </ul>
                    </li>
                    <li><strong>transaction_edit events (event_type = 'transaction_edit'):</strong>
                      <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                        <li><strong>transactionId</strong> - INTEGER (ID of the transaction that was edited)</li>
                        <li><strong>changes</strong> - JSONB ARRAY (array of change objects, each containing):
                          <ul className="ml-4 mt-1 space-y-1 list-disc list-inside">
                            <li><strong>field</strong> - TEXT (field that was changed, e.g., 'category', 'label', 'amount', 'description', 'date', 'cashflow', 'account')</li>
                            <li><strong>oldValue</strong> - TEXT/INTEGER/DECIMAL (previous value of the field)</li>
                            <li><strong>newValue</strong> - TEXT/INTEGER/DECIMAL (new value of the field)</li>
                          </ul>
                        </li>
                        <li><strong>timestamp</strong> - TEXT (ISO timestamp of when the edit occurred)</li>
                      </ul>
                    </li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2 italic">Purpose: Flexible JSONB metadata field allows storing event-specific data without schema changes. Different event types store different metadata structures.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">chat_bookings table (Chat Booking System)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (booking identifier)</li>
                    <li><strong>user_id</strong> - INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE (foreign key to users table)</li>
                    <li><strong>booking_date</strong> - DATE NOT NULL (date of the booked appointment)</li>
                    <li><strong>booking_time</strong> - TIME NOT NULL (time of the booked appointment, HH:MM:SS format)</li>
                    <li><strong>preferred_method</strong> - TEXT NOT NULL CHECK (preferred_method IN ('teams', 'google-meet', 'phone')) (communication method)</li>
                    <li><strong>share_screen</strong> - BOOLEAN (whether user wants to share screen, for Teams/Google Meet only)</li>
                    <li><strong>record_conversation</strong> - BOOLEAN (whether user wants to record conversation, for Teams/Google Meet only)</li>
                    <li><strong>notes</strong> - TEXT (optional notes from user, max 200 words)</li>
                    <li><strong>status</strong> - TEXT DEFAULT 'requested' CHECK (status IN ('pending', 'requested', 'confirmed', 'cancelled', 'completed')) (booking status)</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when booking was created)</li>
                    <li><strong>updated_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when booking was last updated)</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2 italic">Purpose: Stores user booking requests for 20-minute chat sessions with the team. Status starts as 'requested' and is updated by admin to 'confirmed', 'cancelled', or 'completed'.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">available_slots table (Chat Booking Availability)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (slot identifier)</li>
                    <li><strong>slot_date</strong> - DATE NOT NULL (date of the available slot)</li>
                    <li><strong>slot_time</strong> - TIME NOT NULL (time of the available slot, HH:MM:SS format)</li>
                    <li><strong>is_available</strong> - BOOLEAN DEFAULT TRUE (whether this slot is marked as available by admin)</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when slot was created)</li>
                    <li><strong>updated_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when slot availability was last updated)</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2 italic">Purpose: Admin-managed table for marking which date/time slots are available for booking. Each available hour generates 3 slots (20-minute intervals: :00, :20, :40).</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">survey_responses table (Feature Prioritization Survey)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (survey response identifier)</li>
                    <li><strong>user_id</strong> - INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE (foreign key to users table)</li>
                    <li><strong>q1_data</strong> - JSONB (Q1 responses: feature expectations with "Expect", "Use", "Love" columns)</li>
                    <li><strong>q2_data</strong> - JSONB (Q2 responses: ranked priority list, with data security locked at #1)</li>
                    <li><strong>q3_data</strong> - JSONB (Q3 responses: professional advisor interest selections)</li>
                    <li><strong>q4_data</strong> - TEXT (Q4 response: access level preference, conditional on Q3)</li>
                    <li><strong>q5_data</strong> - TEXT (Q5 response: free text comments, max 200 words)</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when survey was submitted)</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2 italic">Purpose: Stores user responses to the "What's Coming" feature prioritization survey. Used to inform product roadmap decisions.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">admin_keywords table (Categorization Engine - Keywords)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (keyword identifier)</li>
                    <li><strong>keyword</strong> - TEXT NOT NULL (keyword pattern to match in transaction descriptions)</li>
                    <li><strong>category</strong> - TEXT NOT NULL (category to assign when keyword matches)</li>
                    <li><strong>label</strong> - TEXT NOT NULL (sub-category label to assign when keyword matches)</li>
                    <li><strong>is_active</strong> - BOOLEAN DEFAULT TRUE (whether this keyword is currently active)</li>
                    <li><strong>notes</strong> - TEXT (optional admin notes about this keyword)</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when keyword was created)</li>
                    <li><strong>updated_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when keyword was last updated)</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2 italic">Purpose: Generic keywords for auto-categorization (tier 3 priority). Used when user history and merchant matching don't apply. Searched in category priority order (Housing → Bills → Subscriptions → Food → etc.).</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">admin_merchants table (Categorization Engine - Merchants)</h3>
                  <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                    <li><strong>id</strong> - SERIAL PRIMARY KEY (merchant identifier)</li>
                    <li><strong>merchant_pattern</strong> - TEXT NOT NULL UNIQUE (primary merchant name pattern)</li>
                    <li><strong>alternate_patterns</strong> - TEXT[] (array of alternate spellings/variations, e.g., ['TIMHORT', 'TIM HORT', 'HORTONS'])</li>
                    <li><strong>category</strong> - TEXT NOT NULL (category to assign when merchant matches)</li>
                    <li><strong>label</strong> - TEXT NOT NULL (sub-category label to assign when merchant matches)</li>
                    <li><strong>is_active</strong> - BOOLEAN DEFAULT TRUE (whether this merchant is currently active)</li>
                    <li><strong>notes</strong> - TEXT (optional admin notes about this merchant)</li>
                    <li><strong>created_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when merchant was created)</li>
                    <li><strong>updated_at</strong> - TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP (when merchant was last updated)</li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-2 italic">Purpose: Merchant patterns for auto-categorization (tier 2 priority). Supports space-insensitive matching and alternate spellings. 200+ Canadian merchants pre-loaded.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {analyticsSubTab === 'download' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Download</h2>
              <p className="text-gray-600 mt-1">Export raw database data or API documentation</p>
            </div>
            <div className="p-6 space-y-6">
              {/* Export All Raw Data */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Export all raw data</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download all data from every table in the database. Includes API documentation and table of contents as the first sheets. Each table will be a separate sheet in the Excel file.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('admin_token');
                      const response = await fetch('/api/admin/export/all-data', {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      
                      if (!response.ok) {
                        const error = await response.json();
                        alert(`Error: ${error.error || 'Failed to export data'}`);
                        return;
                      }
                      
                      const blob = await response.blob();
                      const link = document.createElement('a');
                      link.href = URL.createObjectURL(blob);
                      link.download = `all-database-data-${new Date().toISOString().split('T')[0]}.xlsx`;
                      link.click();
                    } catch (error) {
                      console.error('Export error:', error);
                      alert('Failed to export data. Please try again.');
                    }
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download all raw data
                </button>
              </div>
              
              {/* Cohort Analysis Export */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Export cohort analysis</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download cohort analysis data and metrics.
                </p>
                <button
                  onClick={() => {
                    alert('Cohort analysis export is not yet programmed. Coming soon!');
                  }}
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download cohort analysis
                </button>
              </div>
              
              {/* Vanity Metrics Export */}
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Export vanity metrics</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download vanity metrics and dashboard analytics.
                </p>
                <button
                  onClick={() => {
                    alert('Vanity metrics export is not yet programmed. Coming soon!');
                  }}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download vanity metrics
                </button>
              </div>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Name</th>
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
                      <tr key={user.user_id || user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">{user.user_id || user.id || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.first_name || <span className="text-gray-400 italic">null</span>}
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
        
        {analyticsSubTab === 'events-data' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Events Data</h2>
                <p className="text-gray-600 mt-1">User events and activity tracking from user_events table</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchEventsData}
                  disabled={eventsDataLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <svg className={`w-4 h-4 ${eventsDataLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Data
                </button>
              </div>
            </div>

            {eventsDataLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading events data...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Data</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metadata</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {eventsData.length > 0 ? (
                      eventsData.map((event) => (
                        <tr key={event.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">{formatEventId(event.id)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">{formatUserId(event.user_id)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {event.first_name || <span className="text-gray-400 italic">null</span>}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                              {event.event_type || 'unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                            {event.event_data ? (
                              <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                                {typeof event.event_data === 'string' 
                                  ? event.event_data 
                                  : JSON.stringify(event.event_data, null, 2)}
                              </pre>
                            ) : (
                              <span className="text-gray-400 italic">null</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                            {event.metadata ? (
                              <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                                {typeof event.metadata === 'string' 
                                  ? event.metadata 
                                  : JSON.stringify(event.metadata, null, 2)}
                              </pre>
                            ) : (
                              <span className="text-gray-400 italic">null</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {event.created_at 
                              ? new Date(event.created_at).toLocaleString()
                              : <span className="text-gray-400 italic">null</span>}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p className="text-lg font-medium mb-2">No events data available</p>
                            <p className="text-sm text-gray-400">
                              Events will appear here once the user_events table is created and events are logged.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        
        {analyticsSubTab === 'editing-events-data' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Editing events data</h2>
                <p className="text-gray-600 mt-1">Transaction editing events - all changes made to transactions</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchEditingEventsData}
                  disabled={editingEventsDataLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <svg className={`w-4 h-4 ${editingEventsDataLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Data
                </button>
              </div>
            </div>

            {editingEventsDataLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading editing events data...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Changes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {editingEventsData.length > 0 ? (
                      editingEventsData.map((event) => {
                        const metadata = typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
                        const changes = metadata?.changes || [];
                        return (
                          <tr key={event.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-600 font-mono">{event.id}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-mono">{event.user_id}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{event.email || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-mono">{metadata?.transactionId || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {changes.length > 0 ? (
                                <div className="space-y-1">
                                  {changes.map((change: any, idx: number) => (
                                    <div key={idx} className="text-xs">
                                      <span className="font-medium">{change.field}:</span>{' '}
                                      <span className="text-red-600 line-through">{String(change.oldValue || '-')}</span>
                                      {' → '}
                                      <span className="text-green-600">{String(change.newValue || '-')}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">No changes</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {event.created_at 
                                ? new Date(event.created_at).toLocaleString()
                                : <span className="text-gray-400 italic">null</span>}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          <div className="flex flex-col items-center">
                            <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <p className="text-lg font-medium mb-2">No editing events available</p>
                            <p className="text-sm text-gray-400">
                              Editing events will appear here once users start editing transactions.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Fetch migration pre-tests
  const fetchMigrationTests = async () => {
    setMigrationTestsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/migration/run', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setMigrationTests(data.tests || []);
      } else {
        alert(`Failed to fetch migration tests: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error fetching migration tests:', error);
      alert(`Error fetching migration tests: ${error.message || 'Unknown error'}`);
    } finally {
      setMigrationTestsLoading(false);
    }
  };

  // Run migration
  const runMigration = async () => {
    if (!confirm('Are you sure you want to run the migration? This will modify the database structure.')) {
      return;
    }
    
    setMigrationRunning(true);
    setMigrationResults(null);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/migration/run', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      setMigrationResults(data);
      if (response.ok && data.success) {
        alert('Migration completed successfully!');
        // Refresh tests
        fetchMigrationTests();
        fetchDropVerification();
      } else {
        alert(`Migration completed with ${data.errors || 0} error(s). Check results below.`);
      }
    } catch (error: any) {
      console.error('Error running migration:', error);
      alert(`Error running migration: ${error.message || 'Unknown error'}`);
    } finally {
      setMigrationRunning(false);
    }
  };

  // Fetch investigation data
  const fetchInvestigation = async () => {
    setInvestigationLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/migration/investigate', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setInvestigationData(data.investigation);
      } else {
        alert(`Failed to fetch investigation: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error fetching investigation:', error);
      alert(`Error fetching investigation: ${error.message || 'Unknown error'}`);
    } finally {
      setInvestigationLoading(false);
    }
  };

  // Drop safe tables
  const dropSafeTables = async (tableNames: string[]) => {
    if (!confirm(`Are you sure you want to drop these tables: ${tableNames.join(', ')}? This cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/migration/drop-safe-tables', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tableNames }),
      });
      const data = await response.json();
      if (response.ok) {
        alert(`Successfully dropped ${data.results.filter((r: any) => r.status === 'dropped').length} table(s)`);
        fetchDropVerification(); // Refresh verification
      } else {
        alert(`Failed to drop tables: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error dropping tables:', error);
      alert(`Error dropping tables: ${error.message || 'Unknown error'}`);
    }
  };

  // Fetch empty tables verification
  const fetchEmptyTablesVerification = async () => {
    setEmptyTablesLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/migration/drop-empty-tables', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setEmptyTablesVerification(data);
      } else {
        alert(`Failed to verify empty tables: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error fetching empty tables verification:', error);
      alert(`Error fetching empty tables verification: ${error.message || 'Unknown error'}`);
    } finally {
      setEmptyTablesLoading(false);
    }
  };

  // Drop empty tables
  const dropEmptyTables = async () => {
    if (!confirm('Are you sure you want to drop these empty unused tables? This cannot be undone.')) {
      return;
    }

    setEmptyTablesDropping(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/migration/drop-empty-tables', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok) {
        alert(`Successfully dropped ${data.droppedTables.length} empty table(s)`);
        fetchEmptyTablesVerification(); // Refresh verification
        fetchDropVerification(); // Also refresh main drop verification
      } else {
        alert(`Failed to drop empty tables: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error dropping empty tables:', error);
      alert(`Error dropping empty tables: ${error.message || 'Unknown error'}`);
    } finally {
      setEmptyTablesDropping(false);
    }
  };

  // Fix unmigrated transactions
  const fixUnmigratedTransactions = async () => {
    if (!confirm('Fix the unmigrated transaction? This will create tokenization if needed and migrate it.')) {
      return;
    }

    setFixingUnmigrated(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/migration/fix-unmigrated', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok) {
        alert(`Successfully migrated ${data.migrated} transaction(s). ${data.errors > 0 ? `${data.errors} error(s) occurred.` : ''}`);
        fetchInvestigation(); // Refresh investigation
        fetchDropVerification(); // Refresh drop verification
      } else {
        alert(`Failed to fix unmigrated transactions: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error fixing unmigrated transactions:', error);
      alert(`Error fixing unmigrated transactions: ${error.message || 'Unknown error'}`);
    } finally {
      setFixingUnmigrated(false);
    }
  };

  // Fetch single source of truth tests
  const fetchSingleSourceTests = async () => {
    setSingleSourceTestsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/migration/test-single-source', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setSingleSourceTests(data);
      } else {
        alert(`Failed to fetch tests: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error fetching single source tests:', error);
      alert(`Error fetching tests: ${error.message || 'Unknown error'}`);
    } finally {
      setSingleSourceTestsLoading(false);
    }
  };

  // Fetch drop verification
  const fetchDropVerification = async () => {
    setDropVerificationLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/migration/verify-drop', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setDropVerification(data);
      } else {
        alert(`Failed to verify table drops: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error fetching drop verification:', error);
      alert(`Error fetching drop verification: ${error.message || 'Unknown error'}`);
    } finally {
      setDropVerificationLoading(false);
    }
  };

  // Fetch health check data
  const fetchHealthData = async () => {
    setHealthLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/health', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setHealthData(data);
      } else {
        alert(`Failed to fetch health data: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error fetching health data:', error);
      alert(`Error fetching health data: ${error.message || 'Unknown error'}`);
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchPrivacyCheckData = async () => {
    setPrivacyCheckLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        alert('Not authenticated. Please log in again.');
        return;
      }
      const response = await fetch('/api/admin/privacy-policy-check', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setPrivacyCheckData(data);
      } else {
        alert(`Failed to fetch privacy policy check: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error fetching privacy policy check:', error);
      alert(`Error fetching privacy policy check: ${error.message || 'Unknown error'}`);
    } finally {
      setPrivacyCheckLoading(false);
    }
  };

  // Render Privacy Policy Check Tab
  const renderPrivacyPolicyCheck = () => {
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

    if (!privacyCheckData && !privacyCheckLoading) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">Click "Run Privacy Policy Check" to verify compliance</p>
          <button
            onClick={fetchPrivacyCheckData}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Run Privacy policy check
          </button>
        </div>
      );
    }

    if (privacyCheckLoading) {
      return (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <p className="mt-4 text-gray-600">Running privacy policy checks...</p>
        </div>
      );
    }

    const { status, summary, checks, lastChecked } = privacyCheckData || {};

    // Group checks by category
    const checksByCategory: { [key: string]: any[] } = {};
    checks?.forEach((check: any) => {
      if (!checksByCategory[check.category]) {
        checksByCategory[check.category] = [];
      }
      checksByCategory[check.category].push(check);
    });

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">🔒 Privacy policy check</h2>
              <p className="text-gray-600">
                Automated compliance verification for Privacy Policy commitments.
              </p>
            </div>
            <button
              onClick={fetchPrivacyCheckData}
              disabled={privacyCheckLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {privacyCheckLoading ? 'Checking...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Overall Status */}
        {summary && (
          <div className={`rounded-lg border-2 p-6 ${
            status === 'pass' 
              ? 'bg-green-50 border-green-300' 
              : status === 'fail'
              ? 'bg-red-50 border-red-300'
              : 'bg-yellow-50 border-yellow-300'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">
                  Overall Status: {getStatusIcon(status)} {status.toUpperCase()}
                </h3>
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{summary.passed}</div>
                    <div className="text-sm text-gray-600">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
                    <div className="text-sm text-gray-600">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{summary.warnings}</div>
                    <div className="text-sm text-gray-600">Warnings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">{summary.total}</div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                </div>
              </div>
            </div>
            {lastChecked && (
              <p className="text-sm text-gray-500 mt-4">
                Last checked: {new Date(lastChecked).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Checks by Category */}
        <div className="space-y-6">
          {Object.entries(checksByCategory).map(([category, categoryChecks]) => (
            <div key={category} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">{category}</h3>
              <div className="space-y-3">
                {categoryChecks.map((check: any, index: number) => (
                  <div
                    key={check.id}
                    className={`border rounded-lg p-4 ${getStatusColor(check.status)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-lg">{getStatusIcon(check.status)}</span>
                          <h4 className="font-semibold">{check.name}</h4>
                          <span className="text-xs font-mono bg-white bg-opacity-50 px-2 py-1 rounded">
                            {check.id}
                          </span>
                        </div>
                        <p className="text-sm mb-1">{check.message}</p>
                        {check.details && (
                          <p className="text-xs opacity-75 mt-2 italic">{check.details}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">🏥 App health</h2>
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
                    {healthData.summary.passed || healthData.summary.pass || healthData.infrastructure?.summary?.pass || healthData.operational?.summary?.pass || healthData.compliance?.summary?.pass || 0} passed, {healthData.summary.warnings || healthData.summary.warning || healthData.infrastructure?.summary?.warning || healthData.operational?.summary?.warning || healthData.compliance?.summary?.warning || 0} warnings, {healthData.summary.failed || healthData.summary.fail || healthData.infrastructure?.summary?.fail || healthData.operational?.summary?.fail || healthData.compliance?.summary?.fail || 0} failed
                  </p>
                )}
                {!healthData.summary && healthData.success && (
                  <p className="text-sm">
                    {(healthData.infrastructure?.summary?.pass || 0) + (healthData.operational?.summary?.pass || 0) + (healthData.compliance?.summary?.pass || 0)} passed, {(healthData.infrastructure?.summary?.warning || 0) + (healthData.operational?.summary?.warning || 0) + (healthData.compliance?.summary?.warning || 0)} warnings, {(healthData.infrastructure?.summary?.fail || 0) + (healthData.operational?.summary?.fail || 0) + (healthData.compliance?.summary?.fail || 0)} failed
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

          // Handle both old and new API response formats
          let infrastructure: any[] = [];
          let appHealth: any[] = [];
          let pipeda: any[] = [];
          let implementedRequirements: any[] = [];
          let documentationRequirements: any[] = [];

          if (healthData.infrastructure || healthData.operational || healthData.compliance) {
            // New API format - extract from nested structure
            infrastructure = healthData.infrastructure?.checks || [];
            appHealth = healthData.operational?.checks || [];
            pipeda = healthData.compliance?.activeTests || [];
            implementedRequirements = healthData.compliance?.implementedRequirements || [];
            documentationRequirements = healthData.compliance?.documentationRequirements || [];
          } else if (healthData.checks) {
            // Old API format - organize checks into sections
            infrastructure = healthData.checks.filter((c: any) => 
              infrastructureChecks.includes(c.name)
            );
            appHealth = healthData.checks.filter((c: any) => 
              appHealthChecks.includes(c.name)
            );
            pipeda = healthData.checks.filter((c: any) => 
              pipedaChecks.includes(c.name)
            );
          }

          // PIPEDA requirements that don't need automated checks (use from API if available, otherwise use defaults)
          const pipedaNoCheck = (implementedRequirements && implementedRequirements.length > 0) ? implementedRequirements : [
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
          const pipedaDocumentation = (documentationRequirements && documentationRequirements.length > 0) ? documentationRequirements : [
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
                  {appHealth.length > 0 ? (
                    appHealth.map((check: any, index: number) => renderCheck(check, index))
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-500">
                      No operational health checks available
                    </div>
                  )}
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
                    {pipeda.length > 0 ? (
                      pipeda.map((check: any, index: number) => renderCheck(check, index))
                    ) : (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-500">
                        No active compliance tests available
                      </div>
                    )}
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
              <h1 className="text-3xl font-bold text-gray-900">Admin dashboard</h1>
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
              onClick={() => {
                setActiveTab('inbox');
                setInboxSubTab('feedback');
              }}
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
              🏷️ Category engine
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
              onClick={() => {
                setActiveTab('monitoring');
                setMonitoringSubTab('health');
              }}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'monitoring'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 App monitoring
            </button>
            <button
              onClick={() => setActiveTab('migration')}
              className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                activeTab === 'migration'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🔄 Migration
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
                onClick={() => setMonitoringSubTab('health')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  monitoringSubTab === 'health'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                💚 App health
              </button>
              <button
                onClick={() => {
                  setMonitoringSubTab('privacy-policy');
                  if (!privacyCheckData && !privacyCheckLoading) {
                    fetchPrivacyCheckData();
                  }
                }}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  monitoringSubTab === 'privacy-policy'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🔒 Privacy policy check
              </button>
              <button
                onClick={() => setMonitoringSubTab('admin-logins')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  monitoringSubTab === 'admin-logins'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🔐 Admin logins
              </button>
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
            </div>
            {/* Monitoring Content */}
            {monitoringSubTab === 'accounts' && renderAccountsTab()}
            {monitoringSubTab === 'health' && renderAppHealth()}
            {monitoringSubTab === 'privacy-policy' && renderPrivacyPolicyCheck()}
            {monitoringSubTab === 'admin-logins' && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Admin logins</h2>
                    <button
                      onClick={fetchAdminLogins}
                      disabled={adminLoginsLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <svg className={`w-4 h-4 ${adminLoginsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>

                  {adminLoginsLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                      <p className="text-gray-600 mt-4">Loading admin logins...</p>
                    </div>
                  ) : adminLogins.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No admin login events recorded yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tab</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {adminLogins.map((login: any, idx: number) => {
                            const metadata = typeof login.metadata === 'string' ? JSON.parse(login.metadata) : login.metadata;
                            return (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {new Date(login.event_timestamp || login.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {metadata?.adminEmail || 'Unknown'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {login.event_type === 'admin_login' ? 'Login' : login.event_type === 'admin_tab_access' ? 'Tab Access' : login.event_type}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {metadata?.tab || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {metadata?.ip || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'inbox' && (
          <div className="space-y-6">
            {/* Inbox Sub-tabs */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
              <button
                onClick={() => setInboxSubTab('feedback')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  inboxSubTab === 'feedback'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                💬 Feedback
              </button>
              <button
                onClick={() => setInboxSubTab('chat-scheduler')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  inboxSubTab === 'chat-scheduler'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📅 Chat scheduler
              </button>
              <button
                onClick={() => setInboxSubTab('whats-coming-survey')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  inboxSubTab === 'whats-coming-survey'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📊 What's coming survey
              </button>
            </div>
            {/* Inbox Content */}
            {inboxSubTab === 'chat-scheduler' && renderChatScheduler()}
            {inboxSubTab === 'feedback' && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Feedback</h2>
                    <button
                      onClick={fetchUserFeedback}
                      disabled={userFeedbackLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <svg className={`w-4 h-4 ${userFeedbackLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>

                  {userFeedbackLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                      <p className="text-gray-600 mt-4">Loading feedback...</p>
                    </div>
                  ) : userFeedback.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No feedback submitted yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted At</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usefulness (1-5)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trust (1-5)</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Problems/Complaints</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">What to Learn</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {userFeedback.map((feedback: any) => (
                            <tr key={feedback.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(feedback.submittedAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {feedback.userId}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {feedback.firstName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {feedback.usefulness !== null ? feedback.usefulness : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {feedback.trust !== null ? feedback.trust : '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                                {feedback.problems || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                                {feedback.learnMore || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
            {inboxSubTab === 'whats-coming-survey' && (
              <div className="space-y-6">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">What's coming survey responses</h2>
                    <button
                      onClick={fetchSurveyResponses}
                      disabled={surveyResponsesLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      <svg className={`w-4 h-4 ${surveyResponsesLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh
                    </button>
                  </div>

                  {surveyResponsesLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                      <p className="text-gray-600 mt-4">Loading survey responses...</p>
                    </div>
                  ) : surveyResponses.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No survey responses yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted At</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Q1: Features</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Q2: Priorities</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Q3: Professionals</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Q4: Access Level</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Q5: Comments</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {surveyResponses.map((response: any) => (
                            <tr key={response.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(response.createdAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                <div>
                                  <div className="font-medium">{response.displayName || response.userEmail}</div>
                                  <div className="text-xs text-gray-500">{response.userEmail}</div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                                {response.q1 && Array.isArray(response.q1) && response.q1.length > 0 ? (
                                  <div className="space-y-1">
                                    {response.q1.map((item: any, idx: number) => (
                                      <div key={idx} className="text-xs">
                                        {item.feature}: {item.expect ? 'Expect' : item.use ? 'Use' : item.love ? 'Love' : ''}
                                      </div>
                                    ))}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                                {response.q2 && Array.isArray(response.q2) && response.q2.length > 0 ? (
                                  <div className="space-y-1">
                                    {response.q2.map((item: any, idx: number) => (
                                      <div key={idx} className="text-xs">
                                        #{item.rank}: {item.text}
                                      </div>
                                    ))}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                                {response.q3 && Array.isArray(response.q3) && response.q3.length > 0 ? (
                                  <div className="space-y-1">
                                    {response.q3.map((item: string, idx: number) => (
                                      <div key={idx} className="text-xs">{item}</div>
                                    ))}
                                  </div>
                                ) : '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {response.q4 || '-'}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                                <div className="break-words whitespace-normal">
                                  {response.q5 || '-'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'categories' && renderCategoriesTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
        {activeTab === 'migration' && renderMigrationTab()}
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



