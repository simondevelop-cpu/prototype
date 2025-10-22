'use client';

import { useState, useEffect } from 'react';
import CashflowChart from './CashflowChart';
import TransactionsList from './TransactionsList';

interface DashboardProps {
  user: any;
  token: string;
  onLogout: () => void;
}

export default function Dashboard({ user, token, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeframe, setTimeframe] = useState('6m');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
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

  useEffect(() => {
    fetchData();
  }, [timeframe, token]);

  useEffect(() => {
    if (selectedCashflow) {
      fetchCategories();
    }
  }, [selectedMonth, selectedCashflow, timeframe]);

  // Fetch all transactions when switching to transactions tab
  useEffect(() => {
    if (activeTab === 'transactions' && !hasLoadedTransactions) {
      fetchAllTransactions();
    }
  }, [activeTab, token]);

  // Reset loaded state when token changes (user logs in/out)
  useEffect(() => {
    setHasLoadedTransactions(false);
    setAllTransactions([]);
  }, [token]);

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

      // Fetch summary
      const summaryRes = await fetch(summaryUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const summaryData = await summaryRes.json();
      setSummary(summaryData.summary || []);

      // Fetch transactions (filtered by timeframe for dashboard)
      const txRes = await fetch(txUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const txData = await txRes.json();
      setTransactions(txData.transactions || []);

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
      const txRes = await fetch('/api/transactions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const txData = await txRes.json();
      setAllTransactions(txData.transactions || []);
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
      
      const catRes = await fetch(catUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const catData = await catRes.json();
      setCategories(catData.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
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

  const handleCustomDateApply = () => {
    if (customDateRange.start && customDateRange.end) {
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
    if (summary.length === 0) return '';
    const dates = summary.map(s => s.month);
    const earliest = dates[0];
    const latest = dates[dates.length - 1];
    
    if (!earliest || !latest) return '';
    
    // Parse the month strings (format: YYYY-MM-DD or YYYY-MM)
    // Extract just YYYY-MM if full date is provided
    const earliestMonth = earliest.substring(0, 7); // Get YYYY-MM
    const latestMonth = latest.substring(0, 7);
    
    // Show full date with day for first and last of month range
    const startDate = new Date(earliestMonth + '-01'); // First day of earliest month
    const latestDate = new Date(latestMonth + '-01');
    
    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(latestDate.getTime())) {
      return '';
    }
    
    const lastDay = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 0).getDate(); // Last day of latest month
    const endDate = new Date(latestDate.getFullYear(), latestDate.getMonth(), lastDay);
    
    const start = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const end = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${start} - ${end}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Canadian Insights</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                {user.name || user.email}
              </span>
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
          <nav className="flex gap-8">
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
                onClick={() => setShowCustomDate(!showCustomDate)}
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={customDateRange.start}
                      onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={customDateRange.end}
                      onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
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
                <h2 className="text-xl font-bold text-gray-900">Cash Flow</h2>
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
                    <p className="text-sm text-gray-600">Total Income</p>
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
                    <p className="text-sm text-gray-600">Total Expenses</p>
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

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Net Cash Flow</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      ${Math.round(summary.reduce((sum, m) => sum + (m.income || 0) - (m.expense || 0), 0)).toLocaleString()}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            {selectedCashflow && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mt-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedCashflow.charAt(0).toUpperCase() + selectedCashflow.slice(1)} Breakdown
                  </h2>
                  <span className="text-sm text-gray-600">
                    {selectedMonth 
                      ? new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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
                        <div key={idx} className="flex items-center justify-between">
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
                        </div>
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
                      ? ` in ${new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
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
            token={token}
            onRefresh={fetchAllTransactions}
          />
        )}
      </main>
    </div>
  );
}

