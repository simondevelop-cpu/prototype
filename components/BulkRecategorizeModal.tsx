'use client';

import { useState } from 'react';

interface BulkRecategorizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (updates: any) => Promise<void>;
  onDelete?: () => Promise<void>;
  selectedCount: number;
  categories: string[];
  accounts: string[];
}

export default function BulkRecategorizeModal({
  isOpen,
  onClose,
  onApply,
  onDelete,
  selectedCount,
  categories,
  accounts,
}: BulkRecategorizeModalProps) {
  const [updates, setUpdates] = useState({
    category: '',
    cashflow: '',
    account: '',
    label: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Filter out empty values
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== '')
      );

      if (Object.keys(filteredUpdates).length === 0) {
        setError('Please select at least one field to update');
        setIsSubmitting(false);
        return;
      }

      await onApply(filteredUpdates);
      
      // Reset form
      setUpdates({
        category: '',
        cashflow: '',
        account: '',
        label: '',
      });
      
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update transactions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!onDelete) return;
    
    const confirmed = confirm(
      `Are you absolutely sure you want to delete ${selectedCount} ${selectedCount === 1 ? 'transaction' : 'transactions'}? This action cannot be undone.`
    );
    
    if (!confirmed) {
      setShowDeleteConfirm(false);
      return;
    }
    
    setError('');
    setIsDeleting(true);
    setShowDeleteConfirm(false);

    try {
      await onDelete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete transactions');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bulk update</h2>
            <p className="text-sm text-gray-600 mt-1">
              Updating {selectedCount} {selectedCount === 1 ? 'transaction' : 'transactions'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
            <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Select the fields you want to update. Empty fields will not be changed.
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={updates.category}
              onChange={(e) => {
                const newVal = e.target.value;
                if (newVal === '__ADD_NEW__') {
                  const newCat = prompt('Enter new category name:');
                  if (newCat && newCat.trim()) {
                    setUpdates({ ...updates, category: newCat.trim() });
                  }
                } else {
                  setUpdates({ ...updates, category: newVal });
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Leave empty to keep current</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="__ADD_NEW__" className="text-blue-600 font-medium">+ Add new category</option>
            </select>
          </div>

          {/* Cashflow type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cashflow type
            </label>
            <select
              value={updates.cashflow}
              onChange={(e) => setUpdates({ ...updates, cashflow: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Keep current</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account
            </label>
            <input
              type="text"
              list="bulk-accounts-list"
              value={updates.account}
              onChange={(e) => setUpdates({ ...updates, account: e.target.value })}
              placeholder="Leave empty to keep current"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <datalist id="bulk-accounts-list">
              {accounts.map((acc) => (
                <option key={acc} value={acc} />
              ))}
            </datalist>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Label
            </label>
            <input
              type="text"
              value={updates.label}
              onChange={(e) => setUpdates({ ...updates, label: e.target.value })}
              placeholder="Leave empty to keep current"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {!showDeleteConfirm ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  disabled={isSubmitting || isDeleting}
                >
                  Cancel
                </button>
                
                {onDelete && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting || isDeleting}
                  >
                    Delete
                  </button>
                )}
                
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || isDeleting}
                >
                  {isSubmitting ? 'Updating...' : 'Update'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDeleteCancel}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, delete'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

