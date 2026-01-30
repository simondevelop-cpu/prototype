'use client';

import { useState, useEffect } from 'react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: any) => Promise<void>;
  transaction?: any; // If provided, we're editing; otherwise, creating
  categories: string[];
  accounts: string[];
}

export default function TransactionModal({
  isOpen,
  onClose,
  onSave,
  transaction,
  categories,
  accounts,
}: TransactionModalProps) {
  const [formData, setFormData] = useState({
    date: '',
    description: '',
    amount: '',
    cashflow: 'expense',
    category: '',
    account: '',
    label: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initialize form data when transaction changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (transaction) {
        // Editing existing transaction
        // Format date to YYYY-MM-DD for input[type="date"]
        let formattedDate = transaction.date;
        if (formattedDate) {
          // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS" formats
          formattedDate = formattedDate.split('T')[0];
        }
        
        setFormData({
          date: formattedDate || '',
          description: transaction.description || '',
          amount: Math.abs(transaction.amount).toString(),
          cashflow: transaction.cashflow || 'expense',
          category: transaction.category || '',
          account: transaction.account || '',
          label: transaction.label || '',
        });
      } else {
        // Creating new transaction - reset form
        const today = new Date().toISOString().split('T')[0];
        setFormData({
          date: today,
          description: '',
          amount: '',
          cashflow: 'expense',
          category: '',
          account: '',
          label: '',
        });
      }
      setError('');
    }
  }, [isOpen, transaction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validate
      if (!formData.date || !formData.description || !formData.amount || !formData.cashflow) {
        setError('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }

      // Convert amount based on cashflow type
      let finalAmount = parseFloat(formData.amount);
      if (formData.cashflow === 'expense') {
        finalAmount = -Math.abs(finalAmount);
      } else if (formData.cashflow === 'income') {
        finalAmount = Math.abs(finalAmount);
      }

      const transactionData = {
        ...formData,
        amount: finalAmount,
        id: transaction?.id, // Include ID if editing
      };

      await onSave(transactionData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-gray-900">
            {transaction ? 'Edit Transaction' : 'Add New Transaction'}
          </h2>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Cashflow Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.cashflow}
                onChange={(e) => setFormData({ ...formData, cashflow: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Grocery shopping"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-2.5 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => {
                  const newVal = e.target.value;
                  if (newVal === '__ADD_NEW__') {
                    const newCat = prompt('Enter new category name:');
                    if (newCat && newCat.trim()) {
                      setFormData({ ...formData, category: newCat.trim() });
                    }
                  } else {
                    setFormData({ ...formData, category: newVal });
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select a category...</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__ADD_NEW__" className="text-blue-600 font-medium">+ Add new category</option>
              </select>
            </div>

            {/* Account */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account
              </label>
              <input
                type="text"
                list="accounts-list"
                value={formData.account}
                onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                placeholder="e.g., Credit Card"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <datalist id="accounts-list">
                {accounts.map((acc) => (
                  <option key={acc} value={acc} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Label
            </label>
            <input
              type="text"
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., Weekly Shopping"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : transaction ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

