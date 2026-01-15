'use client';

import { useState, useRef, useEffect } from 'react';

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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full text-left px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
          isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''
        }`}
      >
        <span className={selected.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
            ? selected[0]
            : `${selected.length} selected`}
        </span>
        <span className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b border-gray-200">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {selected.length === options.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="py-1">
            {options.map((option) => (
              <label
                key={option}
                className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => handleToggle(option)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

