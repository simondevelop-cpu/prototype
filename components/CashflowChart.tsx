'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import dayjs from 'dayjs';

interface CashflowChartProps {
  data: any[];
  onBarClick?: (month: string, cashflow: string) => void;
}

export default function CashflowChart({ data, onBarClick }: CashflowChartProps) {
  // Transform data for Recharts
  const chartData = data.map((month) => ({
    month: dayjs(month.month).format('MMM'),
    monthKey: dayjs(month.month).format('YYYY-MM'),
    fullMonth: dayjs(month.month).format('MMMM YYYY'),
    income: month.income || 0,
    expense: Math.abs(month.expense || 0), // Make positive for display
    other: month.other || 0,
  }));

  if (!chartData.length) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600">No cash flow data available yet</p>
          <p className="text-sm text-gray-500 mt-1">Your transactions will appear here</p>
        </div>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{payload[0]?.payload?.fullMonth}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="mb-1">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium" style={{ color: entry.color }}>
                  {entry.name}:
                </span>
                <span className="font-bold">${entry.value.toLocaleString()}</span>
              </div>
              {entry.name === 'Other' && (
                <p className="text-xs text-gray-500 mt-0.5 italic">Transfers & internal payments</p>
              )}
            </div>
          ))}
          <div className="border-t border-gray-200 mt-2 pt-2">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium text-gray-700">Net:</span>
              <span className="font-bold text-blue-600">
                ${(payload[0]?.value - payload[1]?.value).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Legend with tooltip for "Other"
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex justify-center gap-6 pt-4">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="group relative">
            <div className="flex items-center gap-2 cursor-help">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-700">{entry.value}</span>
            </div>
            {entry.value === 'Other' && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 pointer-events-none">
                <p className="font-semibold mb-1">What is "Other"?</p>
                <p>Transfers between accounts, credit card payments, and other internal movements that don't affect net income/expenses.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ADE80" stopOpacity={1} />
              <stop offset="100%" stopColor="#22C55E" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F87171" stopOpacity={1} />
              <stop offset="100%" stopColor="#EF4444" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="otherGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#93C5FD" stopOpacity={1} />
              <stop offset="100%" stopColor="#60A5FA" stopOpacity={1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis 
            dataKey="month" 
            stroke="#6B7280"
            style={{ fontSize: '14px', fontWeight: 500 }}
          />
          <YAxis 
            stroke="#6B7280"
            style={{ fontSize: '14px' }}
            tickFormatter={(value) => `$${value.toLocaleString()}`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
          <Legend 
            content={<CustomLegend />}
            wrapperStyle={{ paddingTop: '20px' }}
          />
          <Bar 
            dataKey="income" 
            fill="url(#incomeGradient)" 
            radius={[8, 8, 0, 0]}
            name="Income"
            onClick={(data) => onBarClick?.(data.monthKey, 'income')}
            cursor="pointer"
          />
          <Bar 
            dataKey="expense" 
            fill="url(#expenseGradient)" 
            radius={[8, 8, 0, 0]}
            name="Expenses"
            onClick={(data) => onBarClick?.(data.monthKey, 'expense')}
            cursor="pointer"
          />
          <Bar 
            dataKey="other" 
            fill="url(#otherGradient)" 
            radius={[8, 8, 0, 0]}
            name="Other"
            onClick={(data) => onBarClick?.(data.monthKey, 'other')}
            cursor="pointer"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

