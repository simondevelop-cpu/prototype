'use client';

import { useState, useRef, useEffect } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import TransactionModal from './TransactionModal';
import BulkRecategorizeModal from './BulkRecategorizeModal';
import StatementUploadModal from './StatementUploadModal';
import AddCategoryModal from './AddCategoryModal';
import { CATEGORIES } from '@/lib/categorization-engine';

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
  
  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ txId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  
  // Dropdown visibility states
  const [showCashflowDropdown, setShowCashflowDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [deleteConfirmTxId, setDeleteConfirmTxId] = useState<number | null>(null);
  const [editCounts, setEditCounts] = useState({ 
    totalUploads: 0,
    monthsWithData: 0,
    autoCategorisedNumerator: 0,
    autoCategorisedDenominator: 0,
    notCategorisedNumerator: 0,
    notCategorisedDenominator: 0,
    description: 0,
    date: 0,
    amount: 0,
    bulkEdit: 0,
  });
  const [editCountsLoading, setEditCountsLoading] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [addCategoryContext, setAddCategoryContext] = useState<{ field: 'category'; onAdd: (cat: string) => void } | null>(null);
  const [isOpeningAddCategoryModal, setIsOpeningAddCategoryModal] = useState(false);
  
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
      // Close inline edit if clicking outside (handled by onBlur on inputs)
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Apply initial filters when they change (must be in useEffect, not during render)
  useEffect(() => {
    if (initialCategoryFilter) {
      setSelectedCategories(prev => {
        if (!prev.includes(initialCategoryFilter)) {
          return [initialCategoryFilter];
        }
        return prev;
      });
    }
  }, [initialCategoryFilter]);
  
  useEffect(() => {
    if (initialCashflowFilter) {
      setSelectedCashflows(prev => {
        if (!prev.includes(initialCashflowFilter)) {
          return [initialCashflowFilter];
        }
        return prev;
      });
    }
  }, [initialCashflowFilter]);

  // Fetch edit counts
  const fetchEditCounts = async () => {
    setEditCountsLoading(true);
    try {
      const response = await fetch('/api/user/edit-counts', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setEditCounts(data);
      }
    } catch (error) {
      console.error('Error fetching edit counts:', error);
    } finally {
      setEditCountsLoading(false);
    }
  };

  useEffect(() => {
    fetchEditCounts();
  }, [token]);

  // Filter transactions (calculate even when loading to maintain hook order)
  const filteredTransactions = (transactions || []).filter(tx => {
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
  // Default categories for new users (only show these if user has no custom categories)
  const defaultCategories = ['Housing', 'Bills', 'Subscriptions', 'Food', 'Travel', 'Health', 'Transport', 'Education', 'Personal', 'Shopping', 'Work', 'Uncategorised'];
  const transactionCategories = Array.from(new Set((transactions || []).map(tx => tx.category).filter(Boolean)));
  
  // Check if user has any custom categories (categories not in default list)
  const hasCustomCategories = transactionCategories.some(cat => !defaultCategories.includes(cat));
  
  // For new users (no custom categories), only show defaults. Otherwise, show all.
  const categories = hasCustomCategories 
    ? Array.from(new Set([...defaultCategories, ...transactionCategories])).sort()
    : defaultCategories;
  
  const accounts = Array.from(new Set((transactions || []).map(tx => tx.account).filter(Boolean))).sort();
  const cashflows = Array.from(new Set((transactions || []).map(tx => tx.cashflow).filter(Boolean))).sort();
  const labels = Array.from(new Set((transactions || []).map(tx => tx.label).filter(Boolean))).sort();
  
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

  const selectedTotal = (transactions || [])
    .filter(tx => selectedTransactionIds.has(getTxId(tx)))
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  // Get IDs of selected transactions
  const getSelectedIds = () => {
    return (transactions || [])
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
      fetchEditCounts(); // Refresh edit counts
    } catch (error: any) {
      console.error('Create transaction error:', error);
      throw error;
    }
  };

  const handleUpdateTransaction = async (transactionData: any, originalTx?: any) => {
    try {
      // Check if category or label changed (for learning)
      const txToCheck = originalTx || editingTransaction;
      const categoryChanged = txToCheck && (
        txToCheck.category !== transactionData.category ||
        txToCheck.label !== transactionData.label
      );

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

      // If category changed, save to learning database
      if (categoryChanged && txToCheck.description) {
        try {
          const learnResponse = await fetch('/api/categorization/learn', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              description: txToCheck.description,
              originalCategory: txToCheck.category,
              originalLabel: txToCheck.label,
              correctedCategory: transactionData.category,
              correctedLabel: transactionData.label,
            }),
          });
          
          if (!learnResponse.ok) {
            const learnResult = await learnResponse.json();
            console.error('[Recategorization] Failed to save pattern:', learnResult);
          }
        } catch (learnError) {
          // Don't fail the update if learning fails
          console.error('[Recategorization] Error saving categorization learning:', learnError);
        }
      }

      setEditingTransaction(null);
      onRefresh(); // Refresh the list
      fetchEditCounts(); // Refresh edit counts
    } catch (error: any) {
      console.error('Update transaction error:', error);
      throw error;
    }
  };
  
  // Inline edit handlers
  const startInlineEdit = (tx: any, field: string) => {
    const txId = getTxId(tx);
    setEditingCell({ txId, field });
    
    // Format value based on field type
    if (field === 'date') {
      // Convert date to YYYY-MM-DD format for input
      const date = dayjs.utc(tx.date);
      setEditValue(date.format('YYYY-MM-DD'));
    } else if (field === 'amount') {
      // Store amount as string without sign for editing
      setEditValue(Math.abs(tx.amount || 0).toString());
    } else {
      setEditValue(tx[field] || '');
    }
  };
  
  const saveInlineEdit = async (tx: any, field: string, directValue?: string) => {
    if (!editingCell) return;
    
    const originalValue = tx[field];
    // Use directValue if provided (for dropdowns), otherwise use editValue from state
    let newValue: any = directValue !== undefined ? directValue : editValue.trim();
    
    // Convert value based on field type
    if (field === 'date') {
      // Date is already in YYYY-MM-DD format, keep as is
      if (!newValue) {
        setEditingCell(null);
        return;
      }
    } else if (field === 'amount') {
      // Convert amount string to number, preserve sign from original
      const numValue = parseFloat(newValue);
      if (isNaN(numValue) || numValue < 0) {
        setEditingCell(null);
        return;
      }
      // Preserve the original sign (positive or negative)
      newValue = tx.amount >= 0 ? numValue : -numValue;
    } else {
      // For other fields, use trimmed string
      newValue = newValue || null;
    }
    
    // Don't save if value hasn't changed
    if (field === 'amount') {
      if (Math.abs(originalValue) === Math.abs(newValue) && (originalValue >= 0) === (newValue >= 0)) {
        setEditingCell(null);
        return;
      }
    } else if (originalValue === newValue) {
      setEditingCell(null);
      return;
    }
    
    try {
      const updatedTx = { ...tx, [field]: newValue };
      await handleUpdateTransaction(updatedTx, tx);
      setEditingCell(null);
      // Refresh edit counts after successful edit
      fetchEditCounts();
    } catch (error) {
      console.error('Failed to save inline edit:', error);
      // Revert on error
      setEditingCell(null);
    }
  };
  
  const cancelInlineEdit = (tx: any, field: string) => {
    setEditingCell(null);
    setEditValue('');
  };
  
  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      // Use setTimeout to ensure DOM is ready
      const timer = setTimeout(() => {
        if (editInputRef.current) {
          editInputRef.current.focus();
          if (editInputRef.current instanceof HTMLInputElement) {
            editInputRef.current.select();
          }
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [editingCell]);

  const handleDeleteTransactionClick = (txId: number) => {
    setDeleteConfirmTxId(txId);
  };

  const handleDeleteTransactionConfirm = async () => {
    if (!deleteConfirmTxId) return;

    const txId = deleteConfirmTxId;
    setDeleteConfirmTxId(null);

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
      fetchEditCounts(); // Refresh edit counts
    } catch (error: any) {
      console.error('Delete transaction error:', error);
      alert(error.message);
    }
  };

  const handleDeleteTransactionCancel = () => {
    setDeleteConfirmTxId(null);
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
      // Refresh edit counts after successful bulk update
      fetchEditCounts();
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
  const emptyStateContent = !transactions || transactions.length === 0 ? (
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
            Upload statements
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Add transaction
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
          {/* Your Activity Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Your monthly activity... measuring just how much we got wrong (and can get better)!</h3>
            <p className="text-sm text-gray-600 mb-4">
              Let's play a game - you try and get these numbers as high as you can, and we'll try and bring the blue ones down over time!
            </p>
            {editCountsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-8 gap-4">
                {/* (i) Total uploads - green */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{editCounts.totalUploads}</div>
                  <div className="text-sm text-gray-600 mt-1">Total uploads</div>
                </div>
                
                {/* (ii) Months with data - green */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{editCounts.monthsWithData}</div>
                  <div className="text-sm text-gray-600 mt-1">Months with data</div>
                </div>
                
                {/* (iii) Auto-categorised - fraction (numerator red, denominator black) */}
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    <span className="text-red-600">{editCounts.autoCategorisedNumerator}</span>
                    <span className="text-gray-900">/{editCounts.autoCategorisedDenominator}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Auto-categorised</div>
                </div>
                
                {/* (iv) Not categorised - fraction (numerator red, denominator black) */}
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    <span className="text-red-600">{editCounts.notCategorisedNumerator}</span>
                    <span className="text-gray-900">/{editCounts.notCategorisedDenominator}</span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Not categorised</div>
                </div>
                
                {/* Edit counts - all in black */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{editCounts.description}</div>
                  <div className="text-sm text-gray-600 mt-1">Description</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{editCounts.date}</div>
                  <div className="text-sm text-gray-600 mt-1">Date</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{editCounts.amount}</div>
                  <div className="text-sm text-gray-600 mt-1">Amount</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900">{editCounts.bulkEdit}</div>
                  <div className="text-sm text-gray-600 mt-1">Bulk edit</div>
                </div>
              </div>
            )}
          </div>

          {/* Header with Title and Action Buttons */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">All transactions</h2>
              {selectedTransactionIds.size > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  {selectedTransactionIds.size} transaction{selectedTransactionIds.size !== 1 ? 's' : ''} selected 
                  {selectedTotal !== 0 && ` ($${Math.abs(selectedTotal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total)`}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsBulkModalOpen(true)}
                disabled={selectedTransactionIds.size === 0}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  selectedTransactionIds.size > 0
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Bulk edit or delete {selectedTransactionIds.size > 0 && `(${selectedTransactionIds.size})`}
              </button>
              
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload statements
              </button>
              
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add transaction
              </button>
            </div>
          </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Description, amount, category, label..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
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
            Clear all filters
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
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-12" /> {/* Checkbox */}
              <col className="w-32" /> {/* Date */}
              <col className="w-64" /> {/* Description */}
              <col className="w-32" /> {/* Cashflow */}
              <col className="w-40" /> {/* Account */}
              <col className="w-40" /> {/* Category */}
              <col className="w-40" /> {/* Label */}
              <col className="w-32" /> {/* Amount */}
              <col className="w-32" /> {/* Actions */}
            </colgroup>
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
                    className="text-xs font-medium text-gray-700 uppercase tracking-wider bg-transparent border-0 cursor-pointer hover:text-blue-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 whitespace-nowrap flex items-center gap-1"
                  >
                    CASHFLOW {selectedCashflows.length > 0 && `(${selectedCashflows.length})`} <span className="text-5xl font-bold">▾</span>
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
                    className="text-xs font-medium text-gray-700 uppercase tracking-wider bg-transparent border-0 cursor-pointer hover:text-blue-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 whitespace-nowrap flex items-center gap-1"
                  >
                    ACCOUNT {selectedAccounts.length > 0 && `(${selectedAccounts.length})`} <span className="text-5xl font-bold">▾</span>
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
                    className="text-xs font-medium text-gray-700 uppercase tracking-wider bg-transparent border-0 cursor-pointer hover:text-blue-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 whitespace-nowrap flex items-center gap-1"
                  >
                    CATEGORY {selectedCategories.length > 0 && `(${selectedCategories.length})`} <span className="text-5xl font-bold">▾</span>
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
                        {/* Add new category option */}
                        {!showAddCategoryInput ? (
                          <button
                            onClick={() => setShowAddCategoryInput(true)}
                            className="w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded border-t border-gray-200 mt-2 font-medium"
                          >
                            + Add new category
                          </button>
                        ) : (
                          <div className="px-3 py-2 border-t border-gray-200 mt-2">
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Category name"
                                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newCategoryName.trim()) {
                                    const trimmedName = newCategoryName.trim();
                                    if (!categories.includes(trimmedName)) {
                                      setSelectedCategories([...selectedCategories, trimmedName]);
                                    }
                                    setNewCategoryName('');
                                    setShowAddCategoryInput(false);
                                  } else if (e.key === 'Escape') {
                                    setNewCategoryName('');
                                    setShowAddCategoryInput(false);
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => {
                                  if (newCategoryName.trim()) {
                                    const trimmedName = newCategoryName.trim();
                                    if (!categories.includes(trimmedName)) {
                                      setSelectedCategories([...selectedCategories, trimmedName]);
                                    }
                                  }
                                  setNewCategoryName('');
                                  setShowAddCategoryInput(false);
                                }}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Add
                              </button>
                              <button
                                onClick={() => {
                                  setNewCategoryName('');
                                  setShowAddCategoryInput(false);
                                }}
                                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </th>
                <th className="px-6 py-3 text-left relative" ref={labelDropdownRef}>
                  <button
                    onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                    className="text-xs font-medium text-gray-700 uppercase tracking-wider bg-transparent border-0 cursor-pointer hover:text-blue-600 focus:ring-2 focus:ring-blue-500 rounded px-2 py-1 whitespace-nowrap flex items-center gap-1"
                  >
                    LABEL {selectedLabels.length > 0 && `(${selectedLabels.length})`} <span className="text-5xl font-bold">▾</span>
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
                      {editingCell?.txId === txId && editingCell?.field === 'date' ? (
                        <input
                          ref={editInputRef as React.RefObject<HTMLInputElement>}
                          type="date"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveInlineEdit(tx, 'date')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit(tx, 'date');
                            if (e.key === 'Escape') cancelInlineEdit(tx, 'date');
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span 
                          onClick={() => startInlineEdit(tx, 'date')}
                          className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded"
                          title="Click to edit"
                        >
                          {dayjs.utc(tx.date).format('MMM D, YYYY')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {editingCell?.txId === txId && editingCell?.field === 'description' ? (
                        <input
                          ref={editInputRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveInlineEdit(tx, 'description')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit(tx, 'description');
                            if (e.key === 'Escape') cancelInlineEdit(tx, 'description');
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <div 
                          onClick={() => startInlineEdit(tx, 'description')}
                          className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded"
                          title="Click to edit"
                        >
                          <div className="font-medium truncate" title={tx.description}>{tx.description}</div>
                          {tx.merchant && tx.merchant !== tx.description && (
                            <div className="text-gray-500 text-xs mt-1 truncate" title={tx.merchant}>{tx.merchant}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingCell?.txId === txId && editingCell?.field === 'cashflow' ? (
                        <select
                          ref={editInputRef as React.RefObject<HTMLSelectElement>}
                          value={editValue}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setEditValue(newVal);
                            saveInlineEdit(tx, 'cashflow', newVal);
                          }}
                          onBlur={() => saveInlineEdit(tx, 'cashflow')}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') cancelInlineEdit(tx, 'cashflow');
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="income">income</option>
                          <option value="expense">expense</option>
                          <option value="other">other</option>
                        </select>
                      ) : (
                        <span 
                          onClick={() => startInlineEdit(tx, 'cashflow')}
                          className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded inline-block"
                          title="Click to edit"
                        >
                          {getCashflowBadge(tx.cashflow)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {editingCell?.txId === txId && editingCell?.field === 'account' ? (
                        <select
                          ref={editInputRef as React.RefObject<HTMLSelectElement>}
                          value={editValue}
                          onChange={(e) => {
                            const newVal = e.target.value;
                            setEditValue(newVal);
                            saveInlineEdit(tx, 'account', newVal);
                          }}
                          onBlur={() => saveInlineEdit(tx, 'account')}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') cancelInlineEdit(tx, 'account');
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-</option>
                          {accounts.map(acc => (
                            <option key={acc} value={acc}>{acc}</option>
                          ))}
                        </select>
                      ) : (
                        <span 
                          onClick={() => startInlineEdit(tx, 'account')}
                          className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded truncate block"
                          title={tx.account || 'Click to edit'}
                        >
                          {tx.account || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {editingCell?.txId === txId && editingCell?.field === 'category' ? (
                        <div className="relative">
                          <select
                            ref={editInputRef as React.RefObject<HTMLSelectElement>}
                            value={editValue}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              if (newVal === '__ADD_NEW__') {
                                // Prevent blur from saving empty value
                                setIsOpeningAddCategoryModal(true);
                                setAddCategoryContext({
                                  field: 'category',
                                  onAdd: (cat: string) => {
                                    if (!categories.includes(cat)) {
                                      setEditValue(cat);
                                      saveInlineEdit(tx, 'category', cat);
                                    }
                                    setIsOpeningAddCategoryModal(false);
                                  }
                                });
                                setShowAddCategoryModal(true);
                                // Don't clear editValue - keep the original category value
                                // The modal will handle setting the new value
                              } else {
                                setEditValue(newVal);
                                saveInlineEdit(tx, 'category', newVal);
                              }
                            }}
                            onBlur={() => {
                              // Don't save if we're opening the add category modal
                              if (!isOpeningAddCategoryModal) {
                                saveInlineEdit(tx, 'category');
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') cancelInlineEdit(tx, 'category');
                            }}
                            className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-</option>
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="__ADD_NEW__" className="text-blue-600 font-medium">+ Add new category</option>
                          </select>
                        </div>
                      ) : (
                        <span 
                          onClick={() => startInlineEdit(tx, 'category')}
                          className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded truncate block"
                          title={tx.category || 'Click to edit'}
                        >
                          {tx.category || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {editingCell?.txId === txId && editingCell?.field === 'label' ? (
                        <input
                          ref={editInputRef as React.RefObject<HTMLInputElement>}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveInlineEdit(tx, 'label')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit(tx, 'label');
                            if (e.key === 'Escape') cancelInlineEdit(tx, 'label');
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span 
                          onClick={() => startInlineEdit(tx, 'label')}
                          className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded truncate block"
                          title={tx.label || 'Click to edit'}
                        >
                          {tx.label || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                      {editingCell?.txId === txId && editingCell?.field === 'amount' ? (
                        <input
                          ref={editInputRef as React.RefObject<HTMLInputElement>}
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveInlineEdit(tx, 'amount')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit(tx, 'amount');
                            if (e.key === 'Escape') cancelInlineEdit(tx, 'amount');
                          }}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
                          placeholder="0.00"
                        />
                      ) : (
                        <span 
                          onClick={() => startInlineEdit(tx, 'amount')}
                          className={`cursor-pointer hover:bg-blue-50 px-2 py-1 rounded inline-block ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          title="Click to edit"
                        >
                          {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
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
                      {deleteConfirmTxId === tx.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-700 font-medium">Delete?</span>
                          <button
                            onClick={handleDeleteTransactionConfirm}
                            className="text-red-600 hover:text-red-900 font-medium text-xs"
                            title="Confirm delete"
                          >
                            Yes
                          </button>
                          <button
                            onClick={handleDeleteTransactionCancel}
                            className="text-gray-600 hover:text-gray-900 font-medium text-xs"
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDeleteTransactionClick(tx.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
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
        onSuccess={() => {
          onRefresh();
          fetchEditCounts();
        }}
      />

      <AddCategoryModal
        isOpen={showAddCategoryModal}
        onClose={() => {
          setShowAddCategoryModal(false);
          setAddCategoryContext(null);
          setIsOpeningAddCategoryModal(false);
          // Restore editing state if modal was closed without adding
          if (isOpeningAddCategoryModal && editingCell) {
            const tx = transactions.find(t => t.id === editingCell.txId);
            if (tx && editingCell.field === 'category') {
              setEditValue(tx.category || '');
            }
          }
        }}
        onAdd={(categoryName) => {
          if (addCategoryContext) {
            addCategoryContext.onAdd(categoryName);
          }
          setShowAddCategoryModal(false);
          setAddCategoryContext(null);
          setIsOpeningAddCategoryModal(false);
          onRefresh(); // Refresh to show new category in list
        }}
        existingCategories={categories.filter(c => c !== 'All categories')}
      />
    </div>
  );
}
