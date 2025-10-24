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
  onBack?: () => void; // Optional: custom back handler to return to review modal
}

type CategoryView = 'summary' | string; // 'summary' or category name

export default function CategorizationSummaryModal({
  isOpen,
  onClose,
  transactions,
  onUpdateTransactions,
  onBack,
}: CategorizationSummaryModalProps) {
  const [currentView, setCurrentView] = useState<CategoryView>('summary');
  const [localTransactions, setLocalTransactions] = useState<Transaction[]>(transactions);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState<{ [key: number]: string }>({});
  const [showCustomInput, setShowCustomInput] = useState<{ [key: number]: boolean }>({});
  const [viewingIndexes, setViewingIndexes] = useState<number[]>([]); // Track which transaction indexes are being viewed

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalTransactions(transactions);
      setCurrentView('summary');
    }
  }, [isOpen, transactions]);

  if (!isOpen) return null;

  // Priority categories to always show
  const priorityCategories = ['Housing', 'Bills', 'Food', 'Transport', 'Uncategorised'];
  
  // Calculate summary by category (expenses only) - INCLUDE ALL CATEGORIES
  const allCategorySummary = [
    ...Object.keys(CATEGORIES).map(categoryName => {
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
    }),
    // Always include Uncategorised
    {
      category: 'Uncategorised',
      count: localTransactions.filter(tx => tx.cashflow === 'expense' && (tx.category === 'Uncategorised' || !tx.category)).length,
      total: localTransactions.filter(tx => tx.cashflow === 'expense' && (tx.category === 'Uncategorised' || !tx.category)).reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
      transactions: localTransactions.filter(tx => tx.cashflow === 'expense' && (tx.category === 'Uncategorised' || !tx.category)),
    }
  ];
  
  // Split into categories with transactions and without
  const categoriesWithTransactions = allCategorySummary.filter(cat => cat.count > 0);
  const categoriesWithoutTransactions = allCategorySummary.filter(cat => cat.count === 0);
  
  // Determine what to display (show all if expanded, or just those with transactions)
  const categorySummary = showAllCategories 
    ? [...categoriesWithTransactions, ...categoriesWithoutTransactions]
    : categoriesWithTransactions;

  // Calculate categorization stats
  const totalExpenses = localTransactions.filter(tx => tx.cashflow === 'expense').length;
  const categorizedCount = localTransactions.filter(tx => 
    tx.cashflow === 'expense' && tx.category && tx.category !== 'Uncategorised'
  ).length;
  
  // Debug: Log all expense categories
  console.log('[CategorizationSummary] Expense categories:', 
    localTransactions
      .filter(tx => tx.cashflow === 'expense')
      .map(tx => ({ desc: tx.description.substring(0, 30), category: tx.category, label: tx.label }))
  );

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
                {currentView === 'summary' ? 'Our Auto-Categorisation Engine' : `${currentView} Transactions`}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {currentView === 'summary'
                  ? `${categorizedCount} of ${totalExpenses} expenses automatically categorized`
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
                  {showExplanation ? 'Hide' : 'How it works'}
                </button>
              </div>

              {showExplanation && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700">
                  <p>
                    We're building a powerful categorization engine designed specifically for Canadian transactions. 
                    We prioritise any recategorisation you have made before. Otherwise we look for keywords or merchants, 
                    in order and assign the first match we find (i.e. Housing → Bills → Subscriptions → Food → etc.). 
                    We're constantly expanding our keyword database to improve accuracy; and we'll build in confidence 
                    measures to overcome the bias created from a first-match approach.
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
                            onClick={() => {
                              // Save the indexes of transactions matching this category
                              const indexes = localTransactions
                                .map((tx, idx) => ({ tx, idx }))
                                .filter(({ tx }) => 
                                  tx.cashflow === 'expense' && 
                                  (tx.category === category || (category === 'Uncategorised' && (!tx.category || tx.category === 'Uncategorised')))
                                )
                                .map(({ idx }) => idx);
                              setViewingIndexes(indexes);
                              setCurrentView(category);
                            }}
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

              {/* Expand/Collapse Button */}
              {categoriesWithoutTransactions.length > 0 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllCategories(!showAllCategories)}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    {showAllCategories 
                      ? '← Show Less Categories' 
                      : `+ Show ${categoriesWithoutTransactions.length} More Categories`
                    }
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Category Detail View - Table Format */
            <div>
              <button
                onClick={() => setCurrentView('summary')}
                className="text-sm text-gray-600 hover:text-gray-800 mb-4 flex items-center"
              >
                ← Back to Summary
              </button>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {localTransactions
                      .map((tx, index) => ({ tx, index }))
                      .filter(({ index }) => viewingIndexes.includes(index)) // Use saved indexes instead of live filtering
                      .map(({ tx, index }) => {
                        // Determine confidence badge color
                        const confidence = tx.confidence || 0;
                        let badgeColor = 'bg-gray-100 text-gray-700';
                        if (confidence >= 90) badgeColor = 'bg-green-100 text-green-700';
                        else if (confidence >= 70) badgeColor = 'bg-blue-100 text-blue-700';
                        else if (confidence >= 50) badgeColor = 'bg-yellow-100 text-yellow-700';
                        else if (confidence > 0) badgeColor = 'bg-orange-100 text-orange-700';

                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="font-medium">{tx.description}</div>
                              {tx.confidence !== undefined && tx.confidence > 0 && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor} inline-block mt-1`}>
                                  {tx.confidence}% confidence
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                              ${Math.abs(tx.amount).toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              {showCustomInput[index] ? (
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={customCategoryInput[index] || ''}
                                    onChange={(e) => setCustomCategoryInput({ ...customCategoryInput, [index]: e.target.value })}
                                    placeholder="Enter new category"
                                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => {
                                      if (customCategoryInput[index]?.trim()) {
                                        const labels = getLabelsForCategory(customCategoryInput[index]);
                                        updateTransaction(index, customCategoryInput[index].trim(), labels[0] || '');
                                        setShowCustomInput({ ...showCustomInput, [index]: false });
                                        setCustomCategoryInput({ ...customCategoryInput, [index]: '' });
                                      }
                                    }}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowCustomInput({ ...showCustomInput, [index]: false });
                                      setCustomCategoryInput({ ...customCategoryInput, [index]: '' });
                                    }}
                                    className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs hover:bg-gray-400"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <select
                                  value={tx.category || 'Uncategorised'}
                                  onChange={(e) => {
                                    if (e.target.value === '__ADD_NEW__') {
                                      setShowCustomInput({ ...showCustomInput, [index]: true });
                                    } else {
                                      const newCategory = e.target.value;
                                      const labels = getLabelsForCategory(newCategory);
                                      updateTransaction(index, newCategory, labels[0] || '');
                                    }
                                  }}
                                  className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                                >
                                  {Object.keys(CATEGORIES).map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                  <option value="Uncategorised">Uncategorised</option>
                                  <option value="__ADD_NEW__" className="font-semibold text-blue-600">+ Add New Category</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between">
          <button
            onClick={() => {
              if (currentView !== 'summary') {
                // If in detail view, go back to summary
                setCurrentView('summary');
              } else if (onBack) {
                // If in summary view and onBack provided, use it
                onBack();
              } else {
                // Otherwise just close
                onClose();
              }
            }}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100"
          >
            Back
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

