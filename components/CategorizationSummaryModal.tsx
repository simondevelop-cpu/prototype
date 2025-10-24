'use client';

import { useState, useEffect } from 'react';
import { categorizeTransaction, CATEGORIES, getCategorizationExplanation } from '@/lib/categorization-engine';

interface Transaction {
  date: string;
  description: string;
  merchant: string;
  amount: number;
  cashflow: 'income' | 'expense' | 'other';
  category: string;
  label: string;
  confidence?: number;
}

interface CategorizationSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  onUpdateTransactions: (updatedTransactions: Transaction[]) => void;
}

type CategoryView = 'summary' | string; // 'summary' or category name

export default function CategorizationSummaryModal({
  isOpen,
  onClose,
  transactions,
  onUpdateTransactions,
}: CategorizationSummaryModalProps) {
  const [currentView, setCurrentView] = useState<CategoryView>('summary');
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>(transactions);
  const [showExplanation, setShowExplanation] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalTransactions(transactions);
      setCurrentView('summary');
    }
  }, [isOpen, transactions]);

  if (!isOpen) return null;

  // Calculate summary by category (expenses only)
  const categorySummary = Object.keys(CATEGORIES).map(categoryName => {
    const categoryTransactions = localTransactions.filter(
      tx => tx.cashflow === 'expense' && tx.category === categoryName
    );
    const total = categoryTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    return {
      category: categoryName,
      count: categoryTransactions.length,
      total,
      transactions: categoryTransactions,
    };
  }).filter(cat => cat.count > 0); // Only show categories with transactions

  // Calculate average confidence
  const avgConfidence = localTransactions.length > 0
    ? Math.round(localTransactions.reduce((sum, tx) => sum + (tx.confidence || 0), 0) / localTransactions.length)
    : 0;

  // Update a transaction's category
  const updateTransaction = (index: number, newCategory: string, newLabel: string) => {
    const updated = [...localTransactions];
    updated[index] = { ...updated[index], category: newCategory, label: newLabel };
    setLocalTransactions(updated);
  };

  // Handle confirm - apply changes and close
  const handleConfirm = () => {
    onUpdateTransactions(localTransactions);
    onClose();
  };

  // Get available labels for a category
  const getLabelsForCategory = (category: string): string[] => {
    return CATEGORIES[category as keyof typeof CATEGORIES] || [];
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {currentView === 'summary' ? 'Categorisation Summary' : `${currentView} Transactions`}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {currentView === 'summary'
                  ? `${localTransactions.filter(tx => tx.cashflow === 'expense').length} expenses categorized with ${avgConfidence}% average confidence`
                  : 'Review and adjust categories for these transactions'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentView === 'summary' ? (
            /* Summary Table */
            <div>
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  {showExplanation ? 'Hide' : 'How does this work?'}
                </button>
              </div>

              {showExplanation && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
                  <h4 className="font-semibold text-blue-900 mb-2">How Auto-Categorisation Works</h4>
                  <p className="mb-2">
                    Our categorization engine uses a <strong>multi-tier approach</strong> to automatically categorize your transactions:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 mb-2">
                    <li><strong>Your Learned Patterns</strong> (Highest Priority): Prioritizes categories you've previously assigned to similar transactions</li>
                    <li><strong>Merchant Recognition</strong>: Matches against 250+ Canadian merchants and chains (Tim Hortons, Loblaws, Rogers, etc.)</li>
                    <li><strong>Keyword Analysis</strong>: Analyzes transaction descriptions using 150+ contextual keywords (English & French)</li>
                    <li><strong>Pattern Detection</strong>: Uses transaction amount and frequency patterns to infer categories</li>
                  </ol>
                  <p className="text-xs text-gray-600">
                    The system learns from your corrections. Every time you recategorize a transaction, it improves future suggestions for similar transactions.
                  </p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transactions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {categorySummary.map(({ category, count, total }) => (
                      <tr key={category} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                          ${total.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setCurrentView(category)}
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            Review →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Category Detail View */
            <div>
              <button
                onClick={() => setCurrentView('summary')}
                className="text-sm text-gray-600 hover:text-gray-800 mb-4 flex items-center"
              >
                ← Back to Summary
              </button>

              <div className="space-y-3">
                {localTransactions
                  .map((tx, index) => ({ tx, index }))
                  .filter(({ tx }) => tx.cashflow === 'expense' && tx.category === currentView)
                  .map(({ tx, index }) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{tx.description}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            ${Math.abs(tx.amount).toFixed(2)}
                            {tx.confidence !== undefined && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({tx.confidence}% confidence)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col gap-2">
                          <select
                            value={tx.category}
                            onChange={(e) => {
                              const newCategory = e.target.value;
                              const labels = getLabelsForCategory(newCategory);
                              updateTransaction(index, newCategory, labels[0] || '');
                            }}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            {Object.keys(CATEGORIES).map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          <select
                            value={tx.label}
                            onChange={(e) => updateTransaction(index, tx.category, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            {getLabelsForCategory(tx.category).map(label => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Confirm Categories
          </button>
        </div>
      </div>
    </div>
  );
}

