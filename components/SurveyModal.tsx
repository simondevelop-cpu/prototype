'use client';

import { useState, useEffect, Fragment } from 'react';
import dayjs from 'dayjs';

interface SurveyModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

interface RankedItem {
  text: string;
  rank: number | null;
  footnote?: string;
}

export default function SurveyModal({ isOpen, onClose, token }: SurveyModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q1Data, setQ1Data] = useState<Array<{ feature: string; expect: boolean; use: boolean; love: boolean }>>([]);
  const [q2Ranked, setQ2Ranked] = useState<RankedItem[]>([
    { text: 'Maintain user trust with obsession on data security', rank: 1 },
    { text: 'More accurate automatic categorization', rank: null },
    { text: 'Faster transaction import and processing', rank: null },
    { text: 'Better visualizations and charts', rank: null },
    { text: 'Better mobile experience', rank: null },
    { text: 'More detailed category breakdowns', rank: null },
    { text: 'Ability to add notes or tags to transactions', rank: null },
    { text: 'Communicating the value proposition better', rank: null },
    { text: 'Explaining how the tool works', rank: null },
    { text: 'Integration with my banking provider', rank: null },
    { text: 'Unleash the power of AI', rank: null, footnote: 'Sorry if you want this as we will never let AI touch user data' },
  ]);
  const [q3Data, setQ3Data] = useState<string[]>([]);
  const [q4Data, setQ4Data] = useState<string | null>(null);
  const [q5Data, setQ5Data] = useState('');
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  const totalSteps = 4; // Q1, Q2, Q3+Q4, Q5

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
      setIsSubmitting(false);
      setIsSubmitted(false);
      setShowSuccessModal(false);
      setQ1Data([]);
      setQ2Ranked([
        { text: 'Maintain user trust with obsession on data security', rank: 1 },
        { text: 'More accurate automatic categorization', rank: null },
        { text: 'Faster transaction import and processing', rank: null },
        { text: 'Better visualizations and charts', rank: null },
        { text: 'Better mobile experience', rank: null },
        { text: 'More detailed category breakdowns', rank: null },
        { text: 'Ability to add notes or tags to transactions', rank: null },
        { text: 'Communicating the value proposition better', rank: null },
        { text: 'Explaining how the tool works', rank: null },
        { text: 'Integration with my banking provider', rank: null },
        { text: 'Unleash the power of AI', rank: null, footnote: 'Sorry if you want this as we will never let AI touch user data' },
      ]);
      setQ3Data([]);
      setQ4Data(null);
      setQ5Data('');
    }
  }, [isOpen]);

  const handleQ1Toggle = (feature: string, type: 'expect' | 'use' | 'love') => {
    setQ1Data(prev => {
      const existing = prev.find(item => item.feature === feature);
      if (existing) {
        // Update existing
        const updated = { ...existing, expect: false, use: false, love: false, [type]: !existing[type] };
        return prev.map(item => item.feature === feature ? updated : item);
      } else {
        // Add new
        return [...prev, { feature, expect: type === 'expect', use: type === 'use', love: type === 'love' }];
      }
    });
  };

  const handleQ2Click = (index: number) => {
    if (index === 0) return; // Can't change locked #1
    
    setQ2Ranked(prev => {
      const item = prev[index];
      if (item.rank !== null) {
        // Deselect - remove rank and shift others down
        const currentRank = item.rank;
        const newRanked = prev.map(i => {
          if (i.rank !== null && i.rank > currentRank) {
            return { ...i, rank: i.rank - 1 };
          }
          if (i === item) {
            return { ...i, rank: null };
          }
          return i;
        });
        return newRanked;
      } else {
        // Assign next available rank
        const rankedItems = prev.filter(i => i.rank !== null).sort((a, b) => (a.rank || 0) - (b.rank || 0));
        const maxRank = rankedItems.length > 0 ? Math.max(...rankedItems.map(i => i.rank || 0)) : 1;
        const nextRank = maxRank < 6 ? maxRank + 1 : null;
        
        if (nextRank) {
          return prev.map((i, idx) => idx === index ? { ...i, rank: nextRank } : i);
        }
        return prev;
      }
    });
  };

  const handleQ2DragStart = (index: number) => {
    if (index === 0 || q2Ranked[index].rank === null) return;
    setDraggedItem(index);
  };

  const handleQ2DragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null || index === 0 || draggedItem === index) return;
    
    const draggedRank = q2Ranked[draggedItem].rank;
    const targetRank = q2Ranked[index].rank;
    
    if (draggedRank === null || targetRank === null) return;
    
    setQ2Ranked(prev => {
      const newRanked = [...prev];
      // Swap ranks
      newRanked[draggedItem] = { ...newRanked[draggedItem], rank: targetRank };
      newRanked[index] = { ...newRanked[index], rank: draggedRank };
      return newRanked;
    });
  };

  const handleQ2DragEnd = () => {
    setDraggedItem(null);
  };

  const handleQ3Toggle = (value: string) => {
    setQ3Data(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const shouldShowQ4 = () => {
    const excludeOptions = [
      'I wouldn\'t want to involve a human advisor',
      'Not sure, don\'t think I would ever want one'
    ];
    return q3Data.some(v => !excludeOptions.includes(v));
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    // Prevent double submission
    if (isSubmitting || isSubmitted) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const q2Final = q2Ranked
        .filter(item => item.rank !== null)
        .sort((a, b) => (a.rank || 0) - (b.rank || 0));

      const response = await fetch('/api/survey/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Origin': window.location.origin,
        },
        body: JSON.stringify({
          q1: q1Data,
          q2: q2Final,
          q3: q3Data,
          q4: q4Data,
          q5: q5Data,
        }),
      });

      if (response.ok) {
        setIsSubmitted(true);
        setShowSuccessModal(true);
        setError(null);
        // Auto-close after 2 seconds
        setTimeout(() => {
          setShowSuccessModal(false);
          onClose();
        }, 2000);
      } else {
        setIsSubmitting(false);
        setError('Failed to submit survey. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
      setIsSubmitting(false);
      setError('Failed to submit survey. Please try again.');
    }
  };

  const renderStep1 = () => (
    <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Of the following features, which would you (i) expect (ii) would use or (iii) would love?
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left p-3 font-semibold text-gray-900">Feature</th>
              <th className="text-center p-3 font-semibold text-gray-900 min-w-[120px]">Expect</th>
              <th className="text-center p-3 font-semibold text-gray-900 min-w-[100px]">Use</th>
              <th className="text-center p-3 font-semibold text-gray-900 min-w-[100px]">Love</th>
            </tr>
          </thead>
          <tbody>
            {[
              'Monthly spending reports and summaries',
              'Goal tracking with progress visualization',
              'Receipt scanning and expense matching',
              'Multi-currency support for travel expenses',
              'Integration with more banks and credit cards',
              'Predictive insights (e.g., "You usually spend $X on groceries this week")',
              'Do my own analysis based on excels pulled from the App',
              'Recommendations and comparisons',
              'Mobile app for on-the-go expense tracking',
              'Family/household budget sharing',
              'Personalized financial tips and recommendations',
              'Ability to set and track custom spending limits',
              'Notifications about unusual spending patterns',
              'Comparison with peers - is my spend normal type charts',
              'Integration with investment tracking',
              'Tax preparation features',
            ].map((feature, idx) => {
              const existing = q1Data.find(item => item.feature === feature);
              return (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="p-3 text-gray-700">{feature}</td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={existing?.expect || false}
                      onChange={() => handleQ1Toggle(feature, 'expect')}
                      onClick={(e) => {
                        const row = e.currentTarget.closest('tr');
                        if (row) {
                          const useCheckbox = row.querySelector('input[value="use"]') as HTMLInputElement;
                          const loveCheckbox = row.querySelector('input[value="love"]') as HTMLInputElement;
                          if (e.currentTarget.checked) {
                            if (useCheckbox) useCheckbox.checked = false;
                            if (loveCheckbox) loveCheckbox.checked = false;
                          }
                        }
                      }}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={existing?.use || false}
                      onChange={() => handleQ1Toggle(feature, 'use')}
                      onClick={(e) => {
                        const row = e.currentTarget.closest('tr');
                        if (row) {
                          const expectCheckbox = row.querySelector('input[value="expect"]') as HTMLInputElement;
                          const loveCheckbox = row.querySelector('input[value="love"]') as HTMLInputElement;
                          if (e.currentTarget.checked) {
                            if (expectCheckbox) expectCheckbox.checked = false;
                            if (loveCheckbox) loveCheckbox.checked = false;
                          }
                        }
                      }}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={existing?.love || false}
                      onChange={() => handleQ1Toggle(feature, 'love')}
                      onClick={(e) => {
                        const row = e.currentTarget.closest('tr');
                        if (row) {
                          const expectCheckbox = row.querySelector('input[value="expect"]') as HTMLInputElement;
                          const useCheckbox = row.querySelector('input[value="use"]') as HTMLInputElement;
                          if (e.currentTarget.checked) {
                            if (expectCheckbox) expectCheckbox.checked = false;
                            if (useCheckbox) useCheckbox.checked = false;
                          }
                        }
                      }}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const rankedItems = q2Ranked.filter(item => item.rank !== null).sort((a, b) => (a.rank || 0) - (b.rank || 0));
    const unrankedItems = q2Ranked.filter(item => item.rank === null);

    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          What functionality should we prioritise improving?
        </h2>
        <p className="text-gray-600 mb-6">Rank the top 6</p>

        {/* Ranked Items */}
        {rankedItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Your Rankings:</h3>
            <div className="space-y-2">
              {rankedItems.map((item, displayIdx) => {
                const actualIdx = q2Ranked.findIndex(i => i.text === item.text);
                return (
                  <div
                    key={actualIdx}
                    draggable={item.rank !== 1}
                    onDragStart={() => handleQ2DragStart(actualIdx)}
                    onDragOver={(e) => handleQ2DragOver(e, actualIdx)}
                    onDragEnd={handleQ2DragEnd}
                    onClick={() => handleQ2Click(actualIdx)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      item.rank === 1
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-white border-gray-300 hover:border-blue-400'
                    } ${draggedItem === actualIdx ? 'opacity-50' : ''}`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      item.rank === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {item.rank}
                    </div>
                    <span className="text-gray-700 flex-1 font-medium">
                      {item.text}
                      {item.footnote && (
                        <span className="text-xs text-gray-500 italic ml-2">({item.footnote})</span>
                      )}
                    </span>
                    {item.rank !== 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQ2Click(actualIdx);
                        }}
                        className="text-gray-400 hover:text-gray-600 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Unranked Items */}
        {unrankedItems.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Click to rank:</h3>
            <div className="space-y-2">
              {unrankedItems.map((item) => {
                const actualIdx = q2Ranked.findIndex(i => i.text === item.text);
                return (
                  <div
                    key={actualIdx}
                    onClick={() => handleQ2Click(actualIdx)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm bg-gray-100 text-gray-400">
                      -
                    </div>
                    <span className="text-gray-700 flex-1">
                      {item.text}
                      {item.footnote && (
                        <span className="text-xs text-gray-500 italic ml-2">({item.footnote})</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-8">
      {/* Question 3 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          If we dilligenced and partnered with trusted professionals who could optionally use this tool (with your permission) to help you, would you be interested in any of them?
        </h2>
        <div className="space-y-3">
          {[
            { emoji: '🧾', text: 'Accountant / CPA (taxes, filings, cleanup, year-end)' },
            { emoji: '🏦', text: 'Fee-only financial planner (budgeting, saving, big decisions, retirement planning)' },
            { emoji: '💳', text: 'Credit card / rewards specialist (optimize cards based on spend)' },
            { emoji: '🏠', text: 'Mortgage or home-buying advisor' },
            { emoji: '📈', text: 'Investment advisor (non-sales / fee-only)' },
            { emoji: '🧠', text: 'Financial coach (habits, accountability, planning)' },
            { emoji: '🧑‍💼', text: 'Small-business / side-hustle advisor' },
            { emoji: '❌', text: 'I wouldn\'t want to involve a human advisor' },
            { emoji: '🤔', text: 'Not sure, depends on context' },
            { emoji: '🤔', text: 'Not sure, don\'t think I would ever want one' },
          ].map((option, idx) => (
            <label key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={q3Data.includes(option.text)}
                onChange={() => handleQ3Toggle(option.text)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700 flex-1">
                <span className="mr-2">{option.emoji}</span>
                {option.text}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Question 4 - Conditional */}
      {shouldShowQ4() && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            If you did involve a professional, what level of access would you be comfortable with?
          </h2>
          <p className="text-gray-600 mb-4">Select one</p>
          <div className="space-y-3">
            {[
              { emoji: '👀', text: 'View-only access (they can see, not edit)' },
              { emoji: '✏️', text: 'Suggest changes (categories, insights, notes)' },
              { emoji: '🤝', text: 'Work together live (shared session / screen)' },
              { emoji: '📤', text: 'Export-only (I send them reports)' },
              { emoji: '🔒', text: 'No direct access — advice only' },
              { emoji: '❌', text: 'I wouldn\'t want to share my data' },
            ].map((option, idx) => (
              <label key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="q4_access"
                  value={option.text}
                  checked={q4Data === option.text}
                  onChange={() => setQ4Data(option.text)}
                  className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <span className="text-gray-700 flex-1">
                  <span className="mr-2">{option.emoji}</span>
                  {option.text}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => {
    const wordCount = q5Data.trim().split(/\s+/).filter(Boolean).length;
    const maxWords = 200;
    const borderClass = wordCount >= maxWords ? 'border-red-300' : 'border-gray-300';
    const wordLimitMessage = wordCount >= maxWords ? (
      <p className="text-sm text-red-600 mt-1">200 word maximum</p>
    ) : null;
    
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Would you like to leave any comments, suggestions or be willing to have a follow up conversation? Let us know.
        </h2>
        <textarea
          value={q5Data}
          onChange={(e) => {
            const newValue = e.target.value;
            const words = newValue.trim().split(/\s+/).filter(Boolean);
            // Prevent typing beyond word limit
            if (words.length <= maxWords) {
              setQ5Data(newValue);
            }
          }}
          rows={6}
          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${borderClass}`}
          placeholder="Your comments, suggestions, or let us know if you're open to a follow-up conversation..."
        />
        {wordLimitMessage}
      </div>
    );
  };

  // Early return if modal is not open
  if (!isOpen) {
    return null;
  }

  // Prepare success modal content
  let successModalContent: JSX.Element | null = null;
  if (showSuccessModal) {
    successModalContent = (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h3>
          <p className="text-gray-600">Your responses will help shape our roadmap.</p>
        </div>
      </div>
    );
  }

  // Main component content
  const mainContent = (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-50 to-indigo-100 overflow-y-auto">
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Header with step indicator and close button */}
            <div className="flex justify-between items-center mb-6">
              <div className="text-sm font-medium text-gray-600">
                Step {currentStep + 1} of {totalSteps}
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

            {/* Step Content */}
            <div className="mb-8 min-h-[400px]">
              {currentStep === 0 && renderStep1()}
              {currentStep === 1 && renderStep2()}
              {currentStep === 2 && renderStep3()}
              {currentStep === 3 && renderStep4()}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200">
              <button
                onClick={currentStep > 0 ? handleBack : onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {currentStep > 0 ? 'Back' : 'Cancel'}
              </button>
              <button
                onClick={handleNext}
                disabled={isSubmitting || isSubmitted}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitted 
                  ? 'Thank you for submitting' 
                  : currentStep === totalSteps - 1 
                    ? (isSubmitting ? 'Submitting...' : 'Submit Survey')
                    : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Return both success modal and main content
  return (
    <Fragment>
      {successModalContent}
      {mainContent}
      {/* Error message - inline at top of modal */}
      {error && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center">
            <div className="mb-4">
              <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Error</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => setError(null)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </Fragment>
  );
}

