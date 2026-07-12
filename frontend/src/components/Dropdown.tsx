import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';

interface DropdownOption {
  value: any;
  label: string;
}

interface DropdownProps {
  theme: 'light' | 'dark';
  value: any;
  onChange: (value: any) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
}

export default function Dropdown({
  theme,
  value,
  onChange,
  options,
  placeholder = 'Select option',
  className = '',
  buttonClassName = ''
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between px-4 py-2.5 text-xs font-bold rounded-xl border outline-none text-left transition-all cursor-pointer ${
          theme === 'dark'
            ? 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-200'
            : 'border-zinc-250 bg-white hover:bg-zinc-100/50 text-zinc-700 shadow-sm'
        } ${buttonClassName}`}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 ml-2.5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            initial={{ opacity: 0, y: -5, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.99 }}
            transition={{ duration: 0.1 }}
            className={`absolute left-0 mt-1.5 z-40 max-h-60 min-w-full overflow-y-auto rounded-xl border p-1 shadow-lg ${
              theme === 'dark'
                ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black'
                : 'bg-white border-zinc-200 text-zinc-800 shadow-md'
            }`}
          >
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-xs rounded-lg text-left transition-colors cursor-pointer ${
                    value === opt.value
                      ? 'bg-[#eb5e00] text-white font-bold'
                      : theme === 'dark'
                        ? 'hover:bg-zinc-850 text-zinc-300'
                        : 'hover:bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
