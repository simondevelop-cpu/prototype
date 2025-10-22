'use client';

import { useState } from 'react';
import dayjs from 'dayjs';

interface TransactionsListProps {
  transactions: any[];
  loading: boolean;
}

export default function TransactionsList({ transactions, loading }: TransactionsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All categories');
  const [selectedAccount, setSelectedAccount] = useState('All accounts');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<number>>(new Set());

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">Loading transactions...</div>
      </div>
    );
  }

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    // Universal search: searches across description, merchant, category, label, amount
    const matchesSearch = searchTerm === '' || 
      tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.merchant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.amount?.toString().includes(searchTerm) ||
      Math.abs(tx.amount)?.toFixed(2).includes(searchTerm);
    
    const matchesCategory = selectedCategory === 'All categories' || tx.category === selectedCategory;
    const matchesAccount = selectedAccount === 'All accounts' || tx.account === selectedAccount;
    
    // Date range filter
    const matchesDateRange = (!startDate || tx.date >= startDate) && (!endDate || tx.date <= endDate);
    
    return matchesSearch && matchesCategory && matchesAccount && matchesDateRange;
  });

  // Get unique categories and accounts
  const categories = ['All categories', ...Array.from(new Set(transactions.map(tx => tx.category).filter(Boolean)))];
  const accounts = ['All accounts', ...Array.from(new Set(transactions.map(tx => tx.account).filter(Boolean)))];

  // Selection handlers
  const handleSelectAll = () => {
    if (selectedTransactions.size === filteredTransactions.length) {
      setSelectedTransactions(new Set());
    } else {
      setSelectedTransactions(new Set(filteredTransactions.map((_, idx) => idx)));
    }
  };

  const handleSelectTransaction = (idx: number) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedTransactions(newSelected);
  };

  // Calculate selected totals
  const selectedTotal = Array.from(selectedTransactions).reduce((sum, idx) => {
    return sum + (filteredTransactions[idx]?.amount || 0);
  }, 0);

  const getCashflowBadge = (cashflow: string) => {
    if (cashflow === 'income') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
          income
        </span>
      );
    }
    if (cashflow === 'expense') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          </svg>
          expense
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
        {cashflow}
      </span>
    );
  };

  if (!transactions.length) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-600">No transactions found</p>
          <p className="text-sm text-gray-500 mt-1">Start adding transactions to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Everything</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Description, amount, category, label..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {accounts.map(acc => (
                <option key={acc} value={acc}>{acc}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setStartDate('');
                setEndDate('');
                setSelectedCategory('All categories');
                setSelectedAccount('All accounts');
              }}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
              <p className="text-sm text-gray-600 mt-1">
                {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
              </p>
            </div>
            {selectedTransactions.size > 0 && (
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{selectedTransactions.size}</span> selected
                <span className="ml-2">
                  (${Math.abs(selectedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total)
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cashflow
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Label
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((tx, idx) => (
                <tr key={idx} className={`transition-colors ${selectedTransactions.has(idx) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.has(idx)}
                      onChange={() => handleSelectTransaction(idx)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {dayjs(tx.date).format('MMM D, YYYY')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="font-medium">{tx.description}</div>
                    {tx.merchant && tx.merchant !== tx.description && (
                      <div className="text-gray-500 text-xs mt-1">{tx.merchant}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getCashflowBadge(tx.cashflow)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {tx.account || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {tx.category || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {tx.label || '-'}
                  </td>
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
    </div>
  );
}
