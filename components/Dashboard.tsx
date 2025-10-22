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
  const [summary, setSummary] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [timeframe, token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch summary
      const summaryRes = await fetch(`/api/summary?months=${getMonthCount(timeframe)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const summaryData = await summaryRes.json();
      setSummary(summaryData.summary || []);

      // Fetch transactions
      const txRes = await fetch(`/api/transactions?months=${getMonthCount(timeframe)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const txData = await txRes.json();
      setTransactions(txData.transactions || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
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
            <div className="flex justify-end mb-6">
              <div className="inline-flex rounded-lg bg-white shadow-sm border border-gray-200">
                {['3m', '6m', '12m'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
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
            </div>

            {/* Chart */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Cash Flow</h2>
              {loading ? (
                <div className="h-96 flex items-center justify-center">
                  <div className="text-gray-500">Loading data...</div>
                </div>
              ) : (
                <CashflowChart data={summary} />
              )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Income</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      ${summary.reduce((sum, m) => sum + (m.income || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Expenses</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">
                      ${summary.reduce((sum, m) => sum + (m.expense || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Net Cash Flow</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">
                      ${summary.reduce((sum, m) => sum + (m.income || 0) - (m.expense || 0), 0).toLocaleString()}
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
          </div>
        )}

        {activeTab === 'transactions' && (
          <TransactionsList transactions={transactions} loading={loading} />
        )}
      </main>
    </div>
  );
}

