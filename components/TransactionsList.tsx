'use client';

import { useState, useRef, useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import TransactionModal from './TransactionModal';
import BulkRecategorizeModal from './BulkRecategorizeModal';
import StatementUploadModal from './StatementUploadModal';

dayjs.extend(utc);

interface TransactionsListProps {
  transactions: any[];
  loading: boolean;
  token: string;
  onRefresh: () => void;
  initialCategoryFilter?: string | null;
  onClearCategoryFilter?: () => void;
  initialCashflowFilter?: string | null;
  onClearCashflowFilter?: () => void;
  initialDateRange?: { start: string; end: string } | null;
  onClearDateRange?: () => void;
}

export default function TransactionsList({ transactions, loading, token, onRefresh, initialCategoryFilter, onClearCategoryFilter, initialCashflowFilter, onClearCashflowFilter, initialDateRange, onClearDateRange }: TransactionsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategoryFilter ? [initialCategoryFilter] : []);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCashflows, setSelectedCashflows] = useState<string[]>(initialCashflowFilter ? [initialCashflowFilter] : []);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(initialDateRange?.start || '');
  const [endDate, setEndDate] = useState(initialDateRange?.end || '');
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<Set<string>>(new Set());
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  
  // Dropdown visibility states
  const [showCashflowDropdown, setShowCashflowDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  
  const cashflowDropdownRef = useRef<HTMLTableHeaderCellElement>(null);
  const accountDropdownRef = useRef<HTMLTableHeaderCellElement>(null);
  const categoryDropdownRef = useRef<HTMLTableHeaderCellElement>(null);
  const labelDropdownRef = useRef<HTMLTableHeaderCellElement>(null);
  
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cashflowDropdownRef.current && !cashflowDropdownRef.current.contains(event.target as Node)) {
        setShowCashflowDropdown(false);
      }
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(event.target as Node)) {
        setShowLabelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apply initial filters when they change
  if (initialCategoryFilter && !selectedCategories.includes(initialCategoryFilter)) {
    setSelectedCategories([initialCategoryFilter]);
  }
  if (initialCashflowFilter && !selectedCashflows.includes(initialCashflowFilter)) {
    setSelectedCashflows([initialCashflowFilter]);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">Loading transactions...</div>
      </div>
    );
  }

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = searchTerm === '' || 
      tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.merchant?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.amount?.toString().includes(searchTerm) ||
      Math.abs(tx.amount)?.toFixed(2).includes(searchTerm);
    
    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(tx.category);
    const matchesAccount = selectedAccounts.length === 0 || selectedAccounts.includes(tx.account);
    const matchesCashflow = selectedCashflows.length === 0 || selectedCashflows.includes(tx.cashflow);
    const matchesLabel = selectedLabels.length === 0 || selectedLabels.includes(tx.label);
    const matchesDateRange = (!startDate || tx.date >= startDate) && (!endDate || tx.date <= endDate);
    
    return matchesSearch && matchesCategory && matchesAccount && matchesCashflow && matchesLabel && matchesDateRange;
  });

  // Get unique values for each filter
  const categories = Array.from(new Set(transactions.map(tx => tx.category).filter(Boolean))).sort();
  const accounts = Array.from(new Set(transactions.map(tx => tx.account).filter(Boolean))).sort();
  const cashflows = Array.from(new Set(transactions.map(tx => tx.cashflow).filter(Boolean))).sort();
  const labels = Array.from(new Set(transactions.map(tx => tx.label).filter(Boolean))).sort();
  
  // Multi-select toggle handlers
  const toggleFilter = (value: string, selected: string[], setSelected: (vals: string[]) => void) => {
    if (selected.includes(value)) {
      setSelected(selected.filter(v => v !== value));
    } else {
      setSelected([...selected, value]);
    }
  };

  // Helper to create unique ID for each transaction
  const getTxId = (tx: any) => tx.id?.toString() || `${tx.date}_${tx.description}_${tx.amount}`;

  // Selection handlers
  const handleSelectAll = () => {
    const filteredIds = new Set(filteredTransactions.map(getTxId));
    if (filteredTransactions.every(tx => selectedTransactionIds.has(getTxId(tx)))) {
      const newSelected = new Set(selectedTransactionIds);
      filteredIds.forEach(id => newSelected.delete(id));
      setSelectedTransactionIds(newSelected);
    } else {
      const combined = Array.from(selectedTransactionIds).concat(Array.from(filteredIds));
      setSelectedTransactionIds(new Set(combined));
    }
  };

  const handleSelectTransaction = (tx: any) => {
    const txId = getTxId(tx);
    const newSelected = new Set(selectedTransactionIds);
    if (newSelected.has(txId)) {
      newSelected.delete(txId);
    } else {
      newSelected.add(txId);
    }
    setSelectedTransactionIds(newSelected);
  };

  const selectedTotal = transactions
    .filter(tx => selectedTransactionIds.has(getTxId(tx)))
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Get IDs of selected transactions
  const getSelectedIds = () => {
    return transactions
      .filter(tx => selectedTransactionIds.has(getTxId(tx)))
      .map(tx => tx.id)
      .filter(Boolean);
  };

  // Transaction CRUD handlers
  const handleCreateTransaction = async (transactionData: any) => {
    try {
      const response = await fetch('/api/transactions/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: transactionData.date,
          description: transactionData.description,
          amount: transactionData.amount,
          cashflow: transactionData.cashflow,
          category: transactionData.category,
          account: transactionData.account,
          label: transactionData.label,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create transaction');
      }

      onRefresh(); // Refresh the list
    } catch (error: any) {
      console.error('Create transaction error:', error);
      throw error;
    }
  };

  const handleUpdateTransaction = async (transactionData: any) => {
    try {
      const response = await fetch('/api/transactions/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(transactionData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update transaction');
      }

      setEditingTransaction(null);
      onRefresh(); // Refresh the list
    } catch (error: any) {
      console.error('Update transaction error:', error);
      throw error;
    }
  };

  const handleDeleteTransaction = async (txId: number) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const response = await fetch(`/api/transactions/delete?id=${txId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete transaction');
      }

      onRefresh(); // Refresh the list
    } catch (error: any) {
      console.error('Delete transaction error:', error);
      alert(error.message);
    }
  };

  const handleBulkUpdate = async (updates: any) => {
    try {
      const selectedIds = getSelectedIds();
      if (selectedIds.length === 0) {
        throw new Error('No transactions selected');
      }

      const response = await fetch('/api/transactions/bulk-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionIds: selectedIds,
          updates,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to bulk update transactions');
      }

      setSelectedTransactionIds(new Set()); // Clear selection
      onRefresh(); // Refresh the list
    } catch (error: any) {
      console.error('Bulk update error:', error);
      throw error;
    }
  };

  const handleBulkDelete = async () => {
    try {
      const selectedIds = getSelectedIds();
      if (selectedIds.length === 0) {
        throw new Error('No transactions selected');
      }

      // Delete each transaction
      for (const id of selectedIds) {
        const response = await fetch(`/api/transactions/delete?id=${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete transaction');
        }
      }

      setSelectedTransactionIds(new Set()); // Clear selection
      onRefresh(); // Refresh the list
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      throw error;
    }
  };

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

  // Empty state content
  const emptyStateContent = !transactions.length ? (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="text-gray-600">No transactions found</p>
        <p className="text-sm text-gray-500 mt-1">Start adding transactions to see them here</p>
        <div className="mt-4 flex gap-3 justify-center">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Statements
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Add Transaction
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      {/* Show empty state or normal content */}
      {emptyStateContent || (
        <>
          {/* Header with Title and Action Buttons */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">All Transactions</h2>
              {selectedTransactionIds.size > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedTransactionIds.size} transaction{selectedTransactionIds.size !== 1 ? 's' : ''} selected 
                  {selectedTotal !== 0 && ` ($${Math.abs(selectedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total)`}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {selectedTransactionIds.size > 0 && (
                <button
                  onClick={() => setIsBulkModalOpen(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Bulk Update ({selectedTransactionIds.size})
                </button>
              )}
              
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload Statements
              </button>
              
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Transaction
              </button>
            </div>
          </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              setSearchTerm('');
              setStartDate('');
              setEndDate('');
              setSelectedCategories([]);
              setSelectedAccounts([]);
              setSelectedCashflows([]);
              setSelectedLabels([]);
              if (onClearCategoryFilter) {
                onClearCategoryFilter();
              }
              if (onClearCashflowFilter) {
                onClearCashflowFilter();
              }
              if (onClearDateRange) {
                onClearDateRange();
              }
            }}
            className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                {filteredTransactions.length} {filteredTransactions.length === 1 ? 'transaction' : 'transactions'}
              </p>
            </div>
            {selectedTransactionIds.size > 0 && (
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{selectedTransactionIds.size}</span> selected
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
                    checked={filteredTransactions.length > 0 && filteredTransactions.every(tx => selectedTransactionIds.has(getTxId(tx)))}
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
                <th className="px-6 py-3 text-left relative" ref={cashflowDropdownRef}>
                  <button
                    onClick={() => setShowCashflowDropdown(!showCashflowDropdown)}
                    className="text-xs font-medium text-gray-700 uppercase tracking-wider bg-transparent border-0 cursor-pointer hover:text-blue-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 whitespace-nowrap"
                  >
                    CASHFLOW {selectedCashflows.length > 0 && `(${selectedCashflows.length})`} ▾
                  </button>
                  {showCashflowDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[100] min-w-[200px] max-h-[400px] overflow-y-auto">
                      <div className="p-2">
                        <div className="flex gap-2 px-3 py-2 border-b border-gray-200 mb-2">
                          <button
                            onClick={() => setSelectedCashflows(cashflows)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Select All
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => {
                              setSelectedCashflows([]);
                              if (onClearCashflowFilter) onClearCashflowFilter();
                            }}
                            className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                          >
                            Clear
                          </button>
                        </div>
                        {cashflows.map(cf => (
                          <label key={cf} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedCashflows.includes(cf)}
                              onChange={() => {
                                toggleFilter(cf, selectedCashflows, setSelectedCashflows);
                                if (selectedCashflows.includes(cf) && cf === initialCashflowFilter && onClearCashflowFilter) {
                                  onClearCashflowFilter();
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-2"
                            />
                            <span className="text-sm">{cf}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </th>
                <th className="px-6 py-3 text-left relative" ref={accountDropdownRef}>
                  <button
                    onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                    className="text-xs font-medium text-gray-700 uppercase tracking-wider bg-transparent border-0 cursor-pointer hover:text-blue-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 whitespace-nowrap"
                  >
                    ACCOUNT {selectedAccounts.length > 0 && `(${selectedAccounts.length})`} ▾
                  </button>
                  {showAccountDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[100] min-w-[200px] max-h-[400px] overflow-y-auto">
                      <div className="p-2">
                        <div className="flex gap-2 px-3 py-2 border-b border-gray-200 mb-2">
                          <button
                            onClick={() => setSelectedAccounts(accounts)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Select All
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => setSelectedAccounts([])}
                            className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                          >
                            Clear
                          </button>
                        </div>
                        {accounts.map(acc => (
                          <label key={acc} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedAccounts.includes(acc)}
                              onChange={() => toggleFilter(acc, selectedAccounts, setSelectedAccounts)}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-2"
                            />
                            <span className="text-sm">{acc}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </th>
                <th className="px-6 py-3 text-left relative" ref={categoryDropdownRef}>
                  <button
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="text-xs font-medium text-gray-700 uppercase tracking-wider bg-transparent border-0 cursor-pointer hover:text-blue-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 whitespace-nowrap"
                  >
                    CATEGORY {selectedCategories.length > 0 && `(${selectedCategories.length})`} ▾
                  </button>
                  {showCategoryDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[100] min-w-[200px] max-h-[400px] overflow-y-auto">
                      <div className="p-2">
                        <div className="flex gap-2 px-3 py-2 border-b border-gray-200 mb-2">
                          <button
                            onClick={() => setSelectedCategories(categories)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Select All
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => {
                              setSelectedCategories([]);
                              if (onClearCategoryFilter) onClearCategoryFilter();
                            }}
                            className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                          >
                            Clear
                          </button>
                        </div>
                        {categories.map(cat => (
                          <label key={cat} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer rounded">
                            <input
                              type="checkbox"
                              checked={selectedCategories.includes(cat)}
                              onChange={() => {
                                toggleFilter(cat, selectedCategories, setSelectedCategories);
                                if (selectedCategories.includes(cat) && cat === initialCategoryFilter && onClearCategoryFilter) {
                                  onClearCategoryFilter();
                                }
                              }}
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-2"
                            />
                            <span className="text-sm">{cat}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </th>
                <th className="px-6 py-3 text-left relative" ref={labelDropdownRef}>
                  <button
                    onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                    className="text-xs font-medium text-gray-700 uppercase tracking-wider bg-transparent border-0 cursor-pointer hover:text-blue-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 whitespace-nowrap"
                  >
                    LABEL {selectedLabels.length > 0 && `(${selectedLabels.length})`} ▾
                  </button>
                  {showLabelDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-[100] min-w-[200px] max-h-[400px] overflow-y-auto">
                      <div className="p-2">
                        {labels.length > 0 ? (
                          <>
                            <div className="flex gap-2 px-3 py-2 border-b border-gray-200 mb-2">
                              <button
                                onClick={() => setSelectedLabels(labels)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Select All
                              </button>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => setSelectedLabels([])}
                                className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                              >
                                Clear
                              </button>
                            </div>
                            {labels.map(label => (
                              <label key={label} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer rounded">
                                <input
                                  type="checkbox"
                                  checked={selectedLabels.includes(label)}
                                  onChange={() => toggleFilter(label, selectedLabels, setSelectedLabels)}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-2"
                                />
                                <span className="text-sm">{label}</span>
                              </label>
                            ))}
                          </>
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500">No labels available</div>
                        )}
                      </div>
                    </div>
                  )}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((tx, idx) => {
                const txId = getTxId(tx);
                const isSelected = selectedTransactionIds.has(txId);
                return (
                  <tr key={idx} className={`transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectTransaction(tx)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {dayjs.utc(tx.date).format('MMM D, YYYY')}
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setEditingTransaction(tx)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="Edit"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteTransaction(tx.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {/* Add empty rows to ensure dropdowns have space when there are few transactions */}
              {Array.from({ length: Math.max(0, 10 - filteredTransactions.length) }).map((_, idx) => (
                <tr key={`empty-${idx}`} className="h-16">
                  <td colSpan={9} className="border-0">&nbsp;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {/* Modals - Always rendered so they work in empty state too */}
      <TransactionModal
        isOpen={isAddModalOpen || editingTransaction !== null}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingTransaction(null);
        }}
        onSave={editingTransaction ? handleUpdateTransaction : handleCreateTransaction}
        transaction={editingTransaction}
        categories={categories.filter(c => c !== 'All categories')}
        accounts={accounts.filter(a => a !== 'All accounts')}
      />

      <BulkRecategorizeModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onApply={handleBulkUpdate}
        onDelete={handleBulkDelete}
        selectedCount={selectedTransactionIds.size}
        categories={categories.filter(c => c !== 'All categories')}
        accounts={accounts.filter(a => a !== 'All accounts')}
      />

      <StatementUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        token={token}
        onSuccess={onRefresh}
      />
    </div>
  );
}
