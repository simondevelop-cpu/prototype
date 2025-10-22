'use client';

import dayjs from 'dayjs';

interface TransactionsListProps {
  transactions: any[];
  loading: boolean;
}

export default function TransactionsList({ transactions, loading }: TransactionsListProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">Loading transactions...</div>
      </div>
    );
  }

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

  const getCategoryColor = (category: string) => {
    if (category === 'income') return 'text-green-600 bg-green-50';
    if (category === 'expense') return 'text-red-600 bg-red-50';
    return 'text-blue-600 bg-blue-50';
  };

  const getCategoryIcon = (category: string) => {
    if (category === 'income') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      );
    }
    if (category === 'expense') {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Recent Transactions</h2>
        <p className="text-sm text-gray-600 mt-1">{transactions.length} total transactions</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx, idx) => (
              <tr key={idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {dayjs(tx.date).format('MMM D, YYYY')}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="font-medium">{tx.description}</div>
                  {tx.merchant && (
                    <div className="text-gray-500 text-xs mt-1">{tx.merchant}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(tx.category)}`}>
                    {getCategoryIcon(tx.category)}
                    {tx.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                  <span className={tx.category === 'income' ? 'text-green-600' : 'text-red-600'}>
                    {tx.category === 'income' ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

