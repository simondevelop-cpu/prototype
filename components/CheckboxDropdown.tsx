'use client';

import { useState, useRef, useEffect, useMemo } from 'react';

interface CheckboxDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function CheckboxDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder = 'Select options...',
  disabled = false,
}: CheckboxDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const lowerSearch = searchTerm.toLowerCase();
    return options.filter(option => option.toLowerCase().includes(lowerSearch));
  }, [options, searchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === filteredOptions.length && filteredOptions.every(opt => selected.includes(opt))) {
      // Deselect all filtered options
      onChange(selected.filter(opt => !filteredOptions.includes(opt)));
    } else {
      // Select all filtered options
      const newSelected = [...new Set([...selected, ...filteredOptions])];
      onChange(newSelected);
    }
  };

  const allFilteredSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selected.includes(opt));
  const someFilteredSelected = filteredOptions.some(opt => selected.includes(opt));

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full text-left px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-all ${
          isOpen ? 'ring-2 ring-blue-500 border-blue-500 shadow-sm' : ''
        }`}
      >
        <span className={selected.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
            ? selected[0]
            : `${selected.length} selected`}
        </span>
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
          <svg 
            className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-xl max-h-72 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search bar */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search options..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Select All / Deselect All */}
          <div className="p-2 border-b border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              {allFilteredSelected ? 'Deselect All' : 'Select All'}
            </button>
            {filteredOptions.length < options.length && (
              <span className="text-xs text-gray-500 ml-2">
                ({filteredOptions.length} of {options.length} shown)
              </span>
            )}
          </div>

          {/* Options list */}
          <div className="overflow-auto max-h-48">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                No options match "{searchTerm}"
              </div>
            ) : (
              <div className="py-1">
                {filteredOptions.map((option) => (
                  <label
                    key={option}
                    className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer transition-colors group"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(option)}
                      onChange={() => handleToggle(option)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                    />
                    <span className="text-sm text-gray-700 flex-1 truncate group-hover:text-gray-900">
                      {option}
                    </span>
                    {selected.includes(option) && (
                      <svg className="w-4 h-4 text-blue-600 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Footer with selection count */}
          {selected.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
              {selected.length} {selected.length === 1 ? 'option' : 'options'} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

