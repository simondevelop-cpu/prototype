'use client';

import { useState, useEffect } from 'react';
import dayjs from 'dayjs';

interface Transaction {
  date: string;
  description: string;
  merchant: string;
  amount: number;
  cashflow: 'income' | 'expense' | 'other';
  category: string;
  account: string;
  label: string;
}

interface ParsedStatement {
  filename: string;
  bank: string;
  accountType: string;
  accountHolderName?: string;
  categorized: {
    duplicates: Transaction[];
    other: Transaction[];
    expenses: Transaction[];
    income: Transaction[];
  };
}

interface StatementReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedStatements: ParsedStatement[];
  token: string;
  onSuccess: () => void;
}

type ReviewStep = 'summary' | 'duplicates' | 'other' | 'expenses' | 'income';

export default function StatementReviewModal({ 
  isOpen, 
  onClose, 
  parsedStatements, 
  token,
  onSuccess 
}: StatementReviewModalProps) {
  const [currentStep, setCurrentStep] = useState<ReviewStep>('summary');
  const [importing, setImporting] = useState(false);
  
  // Track which transactions are included/excluded
  const [excludedTransactions, setExcludedTransactions] = useState<Set<string>>(new Set());
  
  // Track edited transactions (keyed by unique ID: date_merchant_amount)
  const [editedTransactions, setEditedTransactions] = useState<Map<string, Transaction>>(new Map());
  
  // Track account name (editable on summary screen)
  const [accountName, setAccountName] = useState<string>('');
  
  // Editing state
  const [editingTransaction, setEditingTransaction] = useState<{ key: string; tx: Transaction } | null>(null);

  // Generate unique key for transaction
  const getTxKey = (tx: Transaction) => `${tx.date}_${tx.merchant}_${tx.amount}`;

  // Get all transactions from all statements for a given category
  const getAllTransactions = (category: keyof ParsedStatement['categorized']): { key: string; tx: Transaction; statement: ParsedStatement }[] => {
    const all: { key: string; tx: Transaction; statement: ParsedStatement }[] = [];
    for (const statement of parsedStatements) {
      for (const tx of statement.categorized[category]) {
        const key = getTxKey(tx);
        const finalTx = editedTransactions.get(key) || tx;
        all.push({ key, tx: finalTx, statement });
      }
    }
    return all;
  };

  // Toggle transaction inclusion
  const toggleInclude = (key: string) => {
    const newExcluded = new Set(excludedTransactions);
    if (newExcluded.has(key)) {
      newExcluded.delete(key);
    } else {
      newExcluded.add(key);
    }
    setExcludedTransactions(newExcluded);
  };

  // Update transaction after editing
  const saveEdit = (key: string, updatedTx: Transaction) => {
    const newEdited = new Map(editedTransactions);
    newEdited.set(key, updatedTx);
    setEditedTransactions(newEdited);
    setEditingTransaction(null);
  };

  // Get all transactions that will be imported
  const getTransactionsToImport = (): Transaction[] => {
    const toImport: Transaction[] = [];
    
    // Skip duplicates by default (unless user explicitly included them)
    const duplicates = getAllTransactions('duplicates');
    for (const { key, tx } of duplicates) {
      if (!excludedTransactions.has(key)) {
        // User wants to import this duplicate
        toImport.push(tx);
      }
    }
    
    // Include all non-duplicate transactions unless explicitly excluded
    const categories: Array<keyof ParsedStatement['categorized']> = ['other', 'expenses', 'income'];
    for (const category of categories) {
      const transactions = getAllTransactions(category);
      for (const { key, tx } of transactions) {
        if (!excludedTransactions.has(key)) {
          toImport.push(tx);
        }
      }
    }
    
    return toImport;
  };

  // Handle import
  const handleImport = async () => {
    const transactionsToImport = getTransactionsToImport();
    
    if (transactionsToImport.length === 0) {
      alert('No transactions selected for import');
      return;
    }

    // Apply custom account name to all transactions
    const transactionsWithAccount = transactionsToImport.map(tx => ({
      ...tx,
      account: accountName || tx.account
    }));

    setImporting(true);
    try {
      const response = await fetch('/api/statements/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ transactions: transactionsWithAccount }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(`Successfully imported ${result.imported} of ${result.total} transactions!`);
        onSuccess();
        onClose();
      } else {
        alert(`Import failed: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      alert(`Import error: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  // Initialize excluded transactions (all duplicates are excluded by default)
  // and account name from first statement
  useEffect(() => {
    if (isOpen && parsedStatements.length > 0) {
      if (excludedTransactions.size === 0) {
        const duplicates: { key: string; tx: Transaction; statement: ParsedStatement }[] = [];
        for (const statement of parsedStatements) {
          for (const tx of statement.categorized.duplicates) {
            const key = `${tx.date}_${tx.merchant}_${tx.amount}`;
            duplicates.push({ key, tx, statement });
          }
        }
        const initialExcluded = new Set(duplicates.map(d => d.key));
        setExcludedTransactions(initialExcluded);
      }
      
      if (!accountName) {
        // Handle multiple statements
        if (parsedStatements.length > 1) {
          // Multiple statements - create a combined name listing all banks and account types
          const accountDescriptions = parsedStatements.map(stmt => {
            const bank = stmt.bank || 'Unknown';
            const type = stmt.accountType || 'Account';
            // Simplified account type
            let shortType = type;
            if (type === 'Credit Card') shortType = 'Credit';
            else if (type === 'Checking') shortType = 'Chequing';
            else if (type === 'Savings') shortType = 'Savings';
            
            return `${bank} ${shortType}`;
          }).join(', ');
          
          const newName = `Multiple Accounts (${accountDescriptions})`;
          console.log('[Review Modal] Multiple statements:', newName);
          setAccountName(newName);
        } else {
          // Single statement - use name if available
          const statement = parsedStatements[0];
          const bank = statement.bank || 'Unknown Bank';
          const type = statement.accountType || 'Credit Card';
          const holderName = statement.accountHolderName;
          
          console.log('[Review Modal] Setting account name:', { bank, type, holderName });
          
          // Format account type for display
          let accountTypeDisplay = type;
          if (type === 'Credit Card') {
            accountTypeDisplay = 'Credit Card';
          } else if (type === 'Checking') {
            accountTypeDisplay = 'Chequing Account';
          } else if (type === 'Savings') {
            accountTypeDisplay = 'Savings Account';
          }
          
          // Format: "[Name]'s [Bank] [Account Type]" (e.g., "Jonathan's RBC Credit Card", "Elise's TD Chequing Account")
          // If no name detected, use placeholder: "[First Name]'s [Bank] [Account Type]"
          if (holderName) {
            const newName = `${holderName}'s ${bank} ${accountTypeDisplay}`;
            console.log('[Review Modal] With name:', newName);
            setAccountName(newName);
          } else {
            const newName = `[First Name]'s ${bank} ${accountTypeDisplay}`;
            console.log('[Review Modal] Without name (using placeholder):', newName);
            setAccountName(newName);
          }
        }
      }
    }
  }, [isOpen, parsedStatements, excludedTransactions.size, accountName]);

  // Render transaction row
  const renderTransactionRow = (key: string, tx: Transaction, statement: ParsedStatement, isDuplicate: boolean = false) => {
    const isExcluded = excludedTransactions.has(key);
    const isIncluded = !isExcluded;
    
    // For duplicates, default is excluded; for others, default is included
    const willImport = isDuplicate ? isIncluded : !isExcluded;

    return (
      <div 
        key={key} 
        className={`p-4 border rounded-lg ${willImport ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'}`}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={willImport}
            onChange={() => toggleInclude(key)}
            className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          
          {/* Transaction Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{tx.merchant}</p>
                <p className="text-sm text-gray-600">{tx.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{dayjs(tx.date).format('MMM D, YYYY')}</span>
                  <span>•</span>
                  <span>{tx.account}</span>
                  {tx.category && (
                    <>
                      <span>•</span>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">{tx.category}</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <p className={`text-lg font-semibold ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">{statement.filename}</p>
              </div>
            </div>
            
            {/* Edit Button */}
            <button
              onClick={() => setEditingTransaction({ key, tx })}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              ✏️ Edit
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Calculate summary statistics
  const getSummaryStats = () => {
    const toImport = getTransactionsToImport();
    const duplicates = getAllTransactions('duplicates');
    
    // Split duplicates by cashflow type
    const duplicateExpenses = duplicates.filter(d => d.tx.cashflow === 'expense');
    const duplicateIncome = duplicates.filter(d => d.tx.cashflow === 'income');
    const duplicateOther = duplicates.filter(d => d.tx.cashflow === 'other');
    
    const duplicatesIncludedExpenses = duplicateExpenses.filter(d => !excludedTransactions.has(d.key)).length;
    const duplicatesIncludedIncome = duplicateIncome.filter(d => !excludedTransactions.has(d.key)).length;
    const duplicatesIncludedOther = duplicateOther.filter(d => !excludedTransactions.has(d.key)).length;
    
    const expenses = toImport.filter(tx => tx.cashflow === 'expense');
    const income = toImport.filter(tx => tx.cashflow === 'income');
    const other = toImport.filter(tx => tx.cashflow === 'other');
    
    const expensesTotal = expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const incomeTotal = income.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    const otherTotal = other.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    return {
      duplicates: { 
        expenses: { count: duplicateExpenses.length, included: duplicatesIncludedExpenses },
        income: { count: duplicateIncome.length, included: duplicatesIncludedIncome },
        other: { count: duplicateOther.length, included: duplicatesIncludedOther },
        total: duplicates.length,
        totalIncluded: duplicatesIncludedExpenses + duplicatesIncludedIncome + duplicatesIncludedOther
      },
      expenses: { count: expenses.length, total: expensesTotal },
      income: { count: income.length, total: incomeTotal },
      other: { count: other.length, total: otherTotal },
      totalTransactions: toImport.length,
    };
  };

  // Render current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 'summary': {
        const stats = getSummaryStats();
        
        return (
          <div>
            {/* Account Name Editor */}
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., TD Visa, BMO Mastercard"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">This will be the account name for all imported transactions</p>
            </div>

            {/* Summary Table */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Transaction Summary</h3>
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {/* Duplicates - Expenses Row */}
                    {stats.duplicates.expenses.count > 0 && (
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">🔴</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">Duplicates - Expenses</p>
                              <p className="text-xs text-gray-500">Already in database</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <p className="text-sm font-semibold text-gray-900">{stats.duplicates.expenses.count}</p>
                          <p className="text-xs text-yellow-600">{stats.duplicates.expenses.included} to import</p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-500">—</td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => setCurrentStep('duplicates')}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Investigate →
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* Duplicates - Income Row */}
                    {stats.duplicates.income.count > 0 && (
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">🔴</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">Duplicates - Income</p>
                              <p className="text-xs text-gray-500">Already in database</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <p className="text-sm font-semibold text-gray-900">{stats.duplicates.income.count}</p>
                          <p className="text-xs text-yellow-600">{stats.duplicates.income.included} to import</p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-500">—</td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => setCurrentStep('duplicates')}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Investigate →
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* Duplicates - Other Row */}
                    {stats.duplicates.other.count > 0 && (
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-2xl mr-3">🔴</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">Duplicates - Other</p>
                              <p className="text-xs text-gray-500">Already in database</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <p className="text-sm font-semibold text-gray-900">{stats.duplicates.other.count}</p>
                          <p className="text-xs text-yellow-600">{stats.duplicates.other.included} to import</p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm text-gray-500">—</td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => setCurrentStep('duplicates')}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Investigate →
                          </button>
                        </td>
                      </tr>
                    )}

                    {/* Expenses Row */}
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">💸</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Expenses</p>
                            <p className="text-xs text-gray-500">Money spent</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <p className="text-sm font-semibold text-red-600">{stats.expenses.count}</p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <p className="text-sm font-semibold text-red-600">
                          ${stats.expenses.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => setCurrentStep('expenses')}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Investigate →
                        </button>
                      </td>
                    </tr>

                    {/* Income Row */}
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">💰</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Income</p>
                            <p className="text-xs text-gray-500">Money received</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <p className="text-sm font-semibold text-green-600">{stats.income.count}</p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <p className="text-sm font-semibold text-green-600">
                          ${stats.income.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => setCurrentStep('income')}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Investigate →
                        </button>
                      </td>
                    </tr>

                    {/* Other Row */}
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">🔄</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">Other</p>
                            <p className="text-xs text-gray-500">Transfers, payments</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <p className="text-sm font-semibold text-blue-600">{stats.other.count}</p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <p className="text-sm font-semibold text-blue-600">
                          ${stats.other.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => setCurrentStep('other')}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Investigate →
                        </button>
                      </td>
                    </tr>

                    {/* Total Row */}
                    <tr className="bg-blue-50 font-semibold">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <p className="text-sm font-bold text-gray-900">Total to Import</p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <p className="text-sm font-bold text-blue-900">{stats.totalTransactions}</p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <p className="text-xs text-gray-600">
                          {stats.expenses.count} outflows totalling ${stats.expenses.total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info Box */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 Tip:</strong> You can confirm the upload immediately, or click "Investigate" on any row to review and edit individual transactions.
              </p>
            </div>
          </div>
        );
      }

      case 'duplicates': {
        const duplicates = getAllTransactions('duplicates');
        const includedCount = duplicates.filter(d => !excludedTransactions.has(d.key)).length;
        
        return (
          <div>
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-1">🔴 Duplicate Transactions</h3>
              <p className="text-sm text-yellow-700">
                These transactions already exist in your database. By default, they are <strong>excluded</strong> from import.
                Check the box to include them if you want duplicates.
              </p>
              <p className="text-sm text-yellow-700 mt-2">
                <strong>{includedCount}</strong> of <strong>{duplicates.length}</strong> duplicates will be imported.
              </p>
            </div>
            
            {duplicates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ✅ No duplicate transactions found!
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {duplicates.map(({ key, tx, statement }) => {
                  const isExcluded = excludedTransactions.has(key);
                  const willImport = !isExcluded;
                  
                  return (
                    <div 
                      key={key} 
                      className={`p-3 border rounded-lg flex items-center justify-between ${willImport ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'}`}
                    >
                      <input
                        type="checkbox"
                        checked={willImport}
                        onChange={() => toggleInclude(key)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{tx.description || tx.merchant}</p>
                      </div>
                      <p className={`text-lg font-semibold ml-4 ${tx.cashflow === 'income' ? 'text-green-600' : tx.cashflow === 'other' ? 'text-blue-600' : 'text-red-600'}`}>
                        ${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      case 'other': {
        const other = getAllTransactions('other');
        const includedCount = other.filter(d => !excludedTransactions.has(d.key)).length;
        
        return (
          <div>
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-1">🔄 Other Transactions</h3>
              <p className="text-sm text-blue-700">
                Transfers, credit card payments, and other transactions that don't affect net income/expenses.
              </p>
              <p className="text-sm text-blue-700 mt-2">
                <strong>{includedCount}</strong> of <strong>{other.length}</strong> will be imported.
              </p>
            </div>
            
            {other.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ✅ No other transactions found!
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {other.map(({ key, tx, statement }) => {
                  const isExcluded = excludedTransactions.has(key);
                  const willImport = !isExcluded;
                  
                  return (
                    <div 
                      key={key} 
                      className={`p-3 border rounded-lg flex items-center justify-between ${willImport ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'}`}
                    >
                      <input
                        type="checkbox"
                        checked={willImport}
                        onChange={() => toggleInclude(key)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-3"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{tx.description || tx.merchant}</p>
                      </div>
                      <p className="text-lg font-semibold text-blue-600 ml-4">
                        ${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      case 'expenses': {
        const expenses = getAllTransactions('expenses');
        const includedCount = expenses.filter(d => !excludedTransactions.has(d.key)).length;
        
        return (
          <div>
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-1">💸 Expense Transactions</h3>
              <p className="text-sm text-red-700">
                These transactions were automatically categorized as expenses.
              </p>
              <p className="text-sm text-red-700 mt-2">
                <strong>{includedCount}</strong> of <strong>{expenses.length}</strong> will be imported.
              </p>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {expenses.map(({ key, tx, statement }) => {
                const isExcluded = excludedTransactions.has(key);
                const willImport = !isExcluded;
                
                return (
                  <div 
                    key={key} 
                    className={`p-3 border rounded-lg flex items-center justify-between ${willImport ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'}`}
                  >
                    <input
                      type="checkbox"
                      checked={willImport}
                      onChange={() => toggleInclude(key)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-3"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{tx.description || tx.merchant}</p>
                    </div>
                    <p className="text-lg font-semibold text-red-600 ml-4">
                      ${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'income': {
        const income = getAllTransactions('income');
        const includedCount = income.filter(d => !excludedTransactions.has(d.key)).length;
        
        return (
          <div>
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-1">💰 Income Transactions</h3>
              <p className="text-sm text-green-700">
                These transactions were automatically categorized as income.
              </p>
              <p className="text-sm text-green-700 mt-2">
                <strong>{includedCount}</strong> of <strong>{income.length}</strong> will be imported.
              </p>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {income.map(({ key, tx, statement }) => {
                const isExcluded = excludedTransactions.has(key);
                const willImport = !isExcluded;
                
                return (
                  <div 
                    key={key} 
                    className={`p-3 border rounded-lg flex items-center justify-between ${willImport ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-60'}`}
                  >
                    <input
                      type="checkbox"
                      checked={willImport}
                      onChange={() => toggleInclude(key)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 mr-3"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{tx.description || tx.merchant}</p>
                    </div>
                    <p className="text-lg font-semibold text-green-600 ml-4">
                      ${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

    }
  };

  if (!isOpen || parsedStatements.length === 0) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {currentStep === 'summary' ? 'Review & Import Transactions' : `Review ${currentStep.charAt(0).toUpperCase() + currentStep.slice(1)}`}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {currentStep === 'summary' 
                    ? 'Review the summary and confirm import, or investigate individual categories'
                    : 'Review and edit transactions in this category'
                  }
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={importing}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {renderStepContent()}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={currentStep === 'summary' ? onClose : () => setCurrentStep('summary')}
              disabled={importing}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {currentStep === 'summary' ? 'Cancel' : '← Back to Summary'}
            </button>

            <button
              onClick={handleImport}
              disabled={importing || getTransactionsToImport().length === 0}
              className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {importing ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importing...
                </>
              ) : (
                <>
                  ✓ Confirm & Import {getTransactionsToImport().length} Transactions
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal (simplified inline editor) */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Transaction</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Merchant</label>
                <input
                  type="text"
                  value={editingTransaction.tx.merchant}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    tx: { ...editingTransaction.tx, merchant: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={editingTransaction.tx.category}
                  onChange={(e) => setEditingTransaction({
                    ...editingTransaction,
                    tx: { ...editingTransaction.tx, category: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={Math.abs(editingTransaction.tx.amount)}
                  onChange={(e) => {
                    const newAmount = parseFloat(e.target.value) || 0;
                    setEditingTransaction({
                      ...editingTransaction,
                      tx: { 
                        ...editingTransaction.tx, 
                        amount: editingTransaction.tx.amount < 0 ? -newAmount : newAmount 
                      }
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingTransaction(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveEdit(editingTransaction.key, editingTransaction.tx)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

