'use client';

import { useState, useEffect } from 'react';
import CashflowChart from './CashflowChart';
import TransactionsList from './TransactionsList';
import FeedbackModal from './FeedbackModal';
import CookieBanner from './CookieBanner';
import BookingModal from './BookingModal';
import BookingItem from './BookingItem';
import SurveyModal from './SurveyModal';
import { apiFetch } from '@/lib/api-client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

interface DashboardProps {
  user: any;
  token: string;
  onLogout: () => void;
}

export default function Dashboard({ user, token, onLogout }: DashboardProps) {
  const [currentToken, setCurrentToken] = useState(token);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Track user activity for 30-minute inactivity timeout
  useEffect(() => {
    const updateActivity = () => {
      localStorage.setItem('ci.session.lastActivity', Date.now().toString());
    };
    
    // Update activity on user interactions
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, updateActivity, { passive: true });
    });
    
    // Initial activity update
    updateActivity();
    
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, []);
  const [timeframe, setTimeframe] = useState('3m');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [customMonthRange, setCustomMonthRange] = useState({ start: '', end: '' }); // Store YYYY-MM for month picker
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [summary, setSummary] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]); // For dashboard breakdown/chart
  const [allTransactions, setAllTransactions] = useState<any[]>([]); // For transactions tab (all data)
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedCashflow, setSelectedCashflow] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [hasLoadedTransactions, setHasLoadedTransactions] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [selectedBookingSlot, setSelectedBookingSlot] = useState<{ date: string; time: string } | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Array<{ date: string; time: string }>>([]);
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [cashflowFilter, setCashflowFilter] = useState<string | null>(null);
  const [dateRangeFilter, setDateRangeFilter] = useState<{ start: string; end: string } | null>(null);

  // Update currentToken when token prop changes
  useEffect(() => {
    setCurrentToken(token);
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [timeframe, currentToken]);

  useEffect(() => {
    if (selectedCashflow) {
      fetchCategories();
    }
  }, [selectedMonth, selectedCashflow, timeframe]);

  // Update customMonthRange whenever summary data changes (for preset timeframes)
  useEffect(() => {
    if (timeframe !== 'custom' && summary.length > 0) {
      const dates = summary.map(s => s.month);
      const earliest = dates[0];
      const latest = dates[dates.length - 1];
      
      if (earliest && latest) {
        const earliestMonth = earliest.substring(0, 7); // Get YYYY-MM
        const latestMonth = latest.substring(0, 7);
        setCustomMonthRange({ start: earliestMonth, end: latestMonth });
      }
    }
  }, [summary, timeframe]);

  // Fetch all transactions when switching to transactions tab
  useEffect(() => {
    if (activeTab === 'transactions' && !hasLoadedTransactions) {
      fetchAllTransactions();
    }
  }, [activeTab, currentToken]);

  // Reset loaded state when token changes (user logs in/out)
  useEffect(() => {
    setHasLoadedTransactions(false);
    setAllTransactions([]);
  }, [currentToken]);

  // Fetch available slots and bookings when Schedule a chat tab is active
  useEffect(() => {
    if (activeTab === 'budget') {
      fetchAvailableSlots();
      fetchMyBookings();
    }
  }, [activeTab, currentToken]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build query params
      let summaryUrl = `/api/summary?months=${getMonthCount(timeframe)}`;
      let txUrl = `/api/transactions?months=${getMonthCount(timeframe)}`;
      
      if (timeframe === 'custom' && customDateRange.start && customDateRange.end) {
        summaryUrl = `/api/summary?start=${customDateRange.start}&end=${customDateRange.end}`;
        txUrl = `/api/transactions?start=${customDateRange.start}&end=${customDateRange.end}`;
      }

      // Fetch summary using apiFetch
      const summaryResponse = await apiFetch(summaryUrl, {
        method: 'GET',
      }, onLogout);
      
      if (summaryResponse.data) {
        setSummary(summaryResponse.data.summary || []);
      }

      // Fetch transactions (filtered by timeframe for dashboard)
      const txResponse = await apiFetch(txUrl, {
        method: 'GET',
      }, onLogout);
      
      if (txResponse.data) {
        setTransactions(txResponse.data.transactions || []);
      }

      // Fetch categories for selected month/cashflow
      await fetchCategories();
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTransactions = async () => {
    setTransactionsLoading(true);
    try {
      // Fetch ALL transactions (no date filter) for transactions tab
      const txResponse = await apiFetch('/api/transactions', {
        method: 'GET',
      }, onLogout);
      
      if (txResponse.data) {
        setAllTransactions(txResponse.data.transactions || []);
      }
      setHasLoadedTransactions(true); // Mark as loaded
    } catch (err) {
      console.error('Error fetching all transactions:', err);
      setHasLoadedTransactions(true); // Still mark as attempted even on error
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      let catUrl = `/api/categories`;
      const params = new URLSearchParams();
      
      if (selectedCashflow) {
        params.append('cashflow', selectedCashflow);
      }
      
      if (selectedMonth) {
        // Single month
        params.append('month', selectedMonth);
      } else if (timeframe === 'custom' && customDateRange.start && customDateRange.end) {
        // Custom date range
        params.append('start', customDateRange.start);
        params.append('end', customDateRange.end);
      } else {
        // Standard timeframe (3m, 6m, 12m)
        params.append('months', getMonthCount(timeframe).toString());
      }
      
      if (params.toString()) {
        catUrl += `?${params.toString()}`;
      }
      
      const catResponse = await apiFetch(catUrl, {
        method: 'GET',
      }, onLogout);
      
      if (catResponse.data) {
        setCategories(catResponse.data.categories || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchAvailableSlots = async () => {
    setBookingsLoading(true);
    try {
      const response = await apiFetch('/api/bookings/available', {
        method: 'GET',
      }, onLogout);
      
      if (response.data) {
        console.log('Fetched available slots:', response.data.availableSlots?.length || 0);
        setAvailableSlots(response.data.availableSlots || []);
      } else {
        console.error('Failed to fetch available slots:', response.status, response.error);
        setAvailableSlots([]);
      }
    } catch (err) {
      console.error('Error fetching available slots:', err);
      setAvailableSlots([]);
    } finally {
      setBookingsLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    try {
      const response = await apiFetch('/api/bookings/my-bookings', {
        method: 'GET',
      }, onLogout);
      
      if (response.data) {
        setMyBookings(response.data.bookings || []);
      } else {
        console.error('Failed to fetch my bookings:', response.status, response.error);
        setMyBookings([]);
      }
    } catch (err) {
      console.error('Error fetching my bookings:', err);
      setMyBookings([]);
    }
  };

  const getMonthCount = (tf: string) => {
    switch (tf) {
      case '3m': return 3;
      case '6m': return 6;
      case '12m': return 12;
      default: return 6;
    }
  };

  const handleBarClick = (month: string, cashflow: string) => {
    setSelectedMonth(month);
    setSelectedCashflow(cashflow);
  };

  const handleStatCardClick = (cashflow: string) => {
    // Clear month selection and show aggregated data for entire range
    setSelectedMonth(null);
    setSelectedCashflow(cashflow);
  };

  const handleCategoryClick = (category: string) => {
    // Load transactions if not loaded
    if (!hasLoadedTransactions) {
      fetchAllTransactions();
    }
    // Set the category filter and cashflow type, then switch to transactions tab
    setCategoryFilter(category);
    // Set cashflow based on current breakdown view (income/expense/other)
    if (selectedCashflow) {
      setCashflowFilter(selectedCashflow);
    }
    // Set date range filter based on current dashboard view
    if (timeframe === 'custom' && customDateRange.start && customDateRange.end) {
      setDateRangeFilter({ start: customDateRange.start, end: customDateRange.end });
    } else {
      // For preset timeframes, calculate the date range from summary data
      if (summary.length > 0) {
        const dates = summary.map(s => s.month);
        const earliest = dates[0];
        const latest = dates[dates.length - 1];
        if (earliest && latest) {
          const earliestMonth = earliest.substring(0, 7);
          const latestMonth = latest.substring(0, 7);
          const startDate = earliestMonth + '-01';
          const [endYear, endMonth] = latestMonth.split('-');
          const lastDay = new Date(parseInt(endYear), parseInt(endMonth), 0).getDate();
          const endDate = `${latestMonth}-${String(lastDay).padStart(2, '0')}`;
          setDateRangeFilter({ start: startDate, end: endDate });
        }
      }
    }
    setActiveTab('transactions');
  };

  const handleCustomButtonClick = () => {
    // Always populate with current date range when opening
    if (!showCustomDate && summary.length > 0) {
      const dates = summary.map(s => s.month);
      const earliest = dates[0];
      const latest = dates[dates.length - 1];
      
      if (earliest && latest) {
        const earliestMonth = earliest.substring(0, 7); // Get YYYY-MM
        const latestMonth = latest.substring(0, 7);
        setCustomMonthRange({ start: earliestMonth, end: latestMonth });
      }
    }
    setShowCustomDate(!showCustomDate);
  };

  const handleCustomDateApply = () => {
    if (customMonthRange.start && customMonthRange.end) {
      // Convert YYYY-MM format to full date ranges (first day to last day of month)
      const startDate = customMonthRange.start + '-01'; // First day of start month
      
      // Calculate last day of end month
      const [endYear, endMonth] = customMonthRange.end.split('-');
      const lastDay = new Date(parseInt(endYear), parseInt(endMonth), 0).getDate();
      const endDate = `${customMonthRange.end}-${String(lastDay).padStart(2, '0')}`;
      
      // Update customDateRange with full dates for API (keep month values in customMonthRange)
      setCustomDateRange({ start: startDate, end: endDate });
      setTimeframe('custom');
      setShowCustomDate(false);
      fetchData();
    }
  };

  // Filter transactions based on selected month and cashflow
  const filteredTransactionsForBreakdown = transactions.filter(tx => {
    if (!selectedCashflow) return false;
    
    // If month is selected, filter by specific month
    if (selectedMonth) {
      const txMonth = tx.date.substring(0, 7); // YYYY-MM
      return txMonth === selectedMonth && tx.cashflow === selectedCashflow;
    }
    
    // Otherwise, show all transactions in current range with selected cashflow
    return tx.cashflow === selectedCashflow;
  });

  // Calculate date range display
  const getDateRangeDisplay = () => {
    // For custom timeframe, use the selected date range directly
    if (timeframe === 'custom' && customDateRange.start && customDateRange.end) {
      const start = dayjs.utc(customDateRange.start).format('MMM D, YYYY');
      const end = dayjs.utc(customDateRange.end).format('MMM D, YYYY');
      return `${start} - ${end}`;
    }
    
    // For preset timeframes, calculate from summary data
    if (summary.length === 0) return '';
    const dates = summary.map(s => s.month);
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    
    if (!earliest || !latest) return '';
    
    // Parse the month strings (format: YYYY-MM-DD or YYYY-MM)
    // Extract just YYYY-MM if full date is provided
    const earliestMonth = earliest.substring(0, 7); // Get YYYY-MM
    const latestMonth = latest.substring(0, 7);
    
    // Show full date with day for first and last of month range using UTC
    const startDate = dayjs.utc(earliestMonth + '-01');
    const endDate = dayjs.utc(latestMonth + '-01').endOf('month');
    
    const start = startDate.format('MMM D, YYYY');
    const end = endDate.format('MMM D, YYYY');
    return `${start} - ${end}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex items-center justify-center">
                <img src="/Humminbird_logo_blue_rounded.png" alt="Hummingbird Finance" className="w-10 h-10 object-contain" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Hummingbird Finance</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user.name || user.email}
              </span>
              <a
                href="/settings"
                className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                title="Account Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </a>
              <button
                onClick={onLogout}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8 items-center justify-between">
            <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'transactions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'insights'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              What's coming
            </button>
            <button
              onClick={() => setActiveTab('budget')}
              className={`py-4 border-b-2 font-medium transition-colors ${
                activeTab === 'budget'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Schedule a chat
            </button>
            </div>
            <button
              onClick={() => setShowFeedback(true)}
              className="py-4 px-4 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Feedback
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <div>
            {/* Timeframe Selector */}
            <div className="flex justify-end mb-6 gap-3">
              <div className="inline-flex rounded-lg bg-white shadow-sm border border-gray-200">
                {['3m', '6m', '12m'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => {
                      setTimeframe(tf);
                      setSelectedMonth(null);
                      setSelectedCashflow(null);
                    }}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      timeframe === tf
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-50'
                    } ${tf === '3m' ? 'rounded-l-lg' : ''} ${tf === '12m' ? 'rounded-r-lg' : ''}`}
                  >
                    {tf === '3m' ? '3 Months' : tf === '6m' ? '6 Months' : '12 Months'}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCustomButtonClick}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  timeframe === 'custom'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom Date Range Picker */}
            {showCustomDate && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Custom Date Range</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Month</label>
                    <input
                      type="month"
                      value={customMonthRange.start}
                      onChange={(e) => setCustomMonthRange({ ...customMonthRange, start: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Month</label>
                    <input
                      type="month"
                      value={customMonthRange.end}
                      onChange={(e) => setCustomMonthRange({ ...customMonthRange, end: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleCustomDateApply}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Cashflow</h2>
                {!loading && summary.length > 0 && (
                  <span className="text-xs text-gray-500">{getDateRangeDisplay()}</span>
                )}
              </div>
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-gray-500">Loading data...</div>
                </div>
              ) : (
                <CashflowChart data={summary} onBarClick={handleBarClick} />
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <button
                onClick={() => handleStatCardClick('income')}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all hover:border-green-300 cursor-pointer text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total income</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      ${Math.round(summary.reduce((sum, m) => sum + (m.income || 0), 0)).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">Click to see breakdown</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleStatCardClick('expense')}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all hover:border-red-300 cursor-pointer text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total expenses</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                      ${Math.round(summary.reduce((sum, m) => sum + (m.expense || 0), 0)).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">Click to see breakdown</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleStatCardClick('other')}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all hover:border-blue-300 cursor-pointer text-left group relative"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      Total other
                      <span className="inline-block w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help" title="Transfers between accounts, credit card payments, and other internal movements">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    </p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      ${Math.round(summary.reduce((sum, m) => sum + (m.other || 0), 0)).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">Click to see breakdown</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                </div>
                {/* Tooltip on hover */}
                <div className="absolute left-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none">
                  <p className="font-semibold mb-1">What is "Other"?</p>
                  <p>Transfers between your accounts, credit card payments, and internal movements that don't affect your net income or expenses.</p>
                </div>
              </button>
            </div>

            {/* Category Breakdown */}
            {selectedCashflow && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedCashflow.charAt(0).toUpperCase() + selectedCashflow.slice(1)} breakdown
                  </h2>
                  <span className="text-sm text-gray-600">
                    {selectedMonth 
                      ? dayjs.utc(selectedMonth + '-01').format('MMMM YYYY')
                      : getDateRangeDisplay()
                    }
                  </span>
                </div>
                {categories.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No categories for this selection</div>
                ) : (
                  <div className="space-y-4">
                    {categories.slice(0, 10).map((cat, idx) => {
                      const totalAmount = categories.reduce((sum, c) => sum + c.total, 0);
                      const percentage = ((cat.total / totalAmount) * 100).toFixed(1);
                      return (
                        <button
                          key={idx}
                          onClick={() => handleCategoryClick(cat.category)}
                          className="w-full flex items-center justify-between hover:bg-gray-50 p-2 rounded-lg transition-colors cursor-pointer"
                        >
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-900 capitalize">{cat.category}</span>
                              <span className={`text-sm font-bold ${
                                selectedCashflow === 'income' ? 'text-green-600' : 
                                selectedCashflow === 'expense' ? 'text-red-600' : 'text-blue-600'
                              }`}>
                                {selectedCashflow === 'income' ? '+' : selectedCashflow === 'expense' ? '-' : ''}${Math.round(cat.total).toLocaleString()}
                                <span className="text-xs text-gray-500 ml-1">({percentage}%)</span>
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  selectedCashflow === 'income' ? 'bg-green-500' : 
                                  selectedCashflow === 'expense' ? 'bg-red-500' : 'bg-blue-500'
                                }`}
                                style={{ 
                                  width: `${percentage}%`
                                }}
                              />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Filtered Transactions */}
            {selectedCashflow && filteredTransactionsForBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900">Transactions</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {filteredTransactionsForBreakdown.length} {filteredTransactionsForBreakdown.length === 1 ? 'transaction' : 'transactions'}
                    {selectedMonth 
                      ? ` in ${dayjs.utc(selectedMonth + '-01').format('MMMM YYYY')}`
                      : ` (${getDateRangeDisplay()})`
                    }
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredTransactionsForBreakdown.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{tx.description}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{tx.category}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                            <span className={tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <TransactionsList 
            transactions={allTransactions} 
            loading={transactionsLoading}
            token={currentToken}
            onRefresh={fetchAllTransactions}
            initialCategoryFilter={categoryFilter}
            onClearCategoryFilter={() => setCategoryFilter(null)}
            initialCashflowFilter={cashflowFilter}
            onClearCashflowFilter={() => setCashflowFilter(null)}
            initialDateRange={dateRangeFilter}
            onClearDateRange={() => setDateRangeFilter(null)}
          />
        )}

        {activeTab === 'insights' && (
          <div className="flex items-center justify-center min-h-[60vh] py-12">
            <div className="max-w-2xl w-full text-center">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Instead of telling you our feature roadmap over the next few months, we'd love to hear from you!
                </h2>
                <p className="text-gray-700 text-lg mb-8 leading-relaxed">
                  The survey will take 2 minutes and will directly inform what we build next. Thanks in advance for helping us out!
                </p>
                <button
                  onClick={() => setShowSurveyModal(true)}
                  className="px-8 py-4 bg-blue-600 text-white rounded-lg font-medium text-lg hover:bg-blue-700 transition-colors shadow-md"
                >
                  Begin 2 minute survey
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Schedule a chat</h2>
              <p className="text-gray-600">
                Do you need any support with the App, some money therapy or just want to chat? Book a 20 minute chat with the team.
              </p>
            </div>

            {/* My Bookings */}
            {myBookings.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">My scheduled chats</h3>
                <div className="space-y-3">
                  {myBookings.map((booking: any) => (
                    <BookingItem
                      key={booking.id}
                      booking={booking}
                      token={currentToken}
                      onUpdate={fetchMyBookings}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Available Slots */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Available time slots</h3>
              {bookingsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading available slots...</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No available slots at this time. Please check back later.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {availableSlots.slice(0, 30).map((slot, idx) => {
                    const slotDate = dayjs(slot.date);
                    const isPast = slotDate.isBefore(dayjs(), 'day') || (slotDate.isSame(dayjs(), 'day') && slot.time < dayjs().format('HH:mm'));
                    const isBooked = myBookings.some((b: any) => b.date === slot.date && b.time === slot.time);
                    
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (!isPast && !isBooked) {
                            setSelectedBookingSlot(slot);
                            setShowBookingModal(true);
                          }
                        }}
                        disabled={isPast || isBooked}
                        className={`p-4 border rounded-lg text-left transition-colors ${
                          isPast || isBooked
                            ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-50'
                            : 'bg-white border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                        }`}
                      >
                        <p className="font-medium text-gray-900">
                          {slotDate.format('ddd, MMM D')}
                        </p>
                        <p className="text-sm text-gray-600">{slot.time}</p>
                        {isBooked && <p className="text-xs text-blue-600 mt-1">Already booked</p>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>


      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        token={currentToken}
      />

      {/* Booking Modal */}
      {selectedBookingSlot && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => {
            setShowBookingModal(false);
            setSelectedBookingSlot(null);
            // Refresh slots and bookings after closing
            fetchAvailableSlots();
            fetchMyBookings();
          }}
          date={selectedBookingSlot.date}
          time={selectedBookingSlot.time}
          token={currentToken}
        />
      )}

      {/* Survey Modal */}
      <SurveyModal
        isOpen={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        token={currentToken}
      />

      {/* Cookie Banner - shown for signed-in users until choice recorded */}
      <CookieBanner token={currentToken} userId={user?.id} />
    </div>
  );
}

