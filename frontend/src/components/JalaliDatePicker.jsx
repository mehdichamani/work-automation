import { useState, useRef, useEffect, useMemo } from 'react';
import JalaliCalendar from './JalaliCalendar';
import moment from 'moment-jalaali';

function normalizeJalaliDate(inputStr) {
  if (!inputStr) return '';

  // 1. Convert Persian/Arabic digits to English digits
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  let normalized = inputStr;
  for (let i = 0; i < 10; i++) {
    normalized = normalized.replace(persianDigits[i], String(i)).replace(arabicDigits[i], String(i));
  }

  // 2. Remove any characters that aren't digits, slashes, hyphens, dots or spaces
  normalized = normalized.replace(/[^0-9/\-.\s]/g, '');

  // 3. Replace hyphens, dots, spaces with slashes
  normalized = normalized.replace(/[\-.\s]+/g, '/');

  // 4. Handle 8-digit inputs without delimiters (e.g. 14020511 -> 1402/05/11)
  if (/^\d{8}$/.test(normalized)) {
    const y = normalized.substring(0, 4);
    const m = normalized.substring(4, 6);
    const d = normalized.substring(6, 8);
    normalized = `${y}/${m}/${d}`;
  }

  // 5. Autocomplete year prefix and pad month/day
  const parts = normalized.split('/');
  if (parts.length === 3) {
    let [y, m, d] = parts;
    if (y.length === 2) {
      y = parseInt(y, 10) < 50 ? '14' + y : '13' + y;
    }
    m = m.padStart(2, '0');
    d = d.padStart(2, '0');
    normalized = `${y}/${m}/${d}`;
  }

  return normalized;
}

export default function JalaliDatePicker({ value, onChange, placeholder = 'انتخاب تاریخ', showPast = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [error, setError] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setInputValue(value || '');
    setError(false);
  }, [value]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInputChange = (e) => {
    const rawVal = e.target.value;
    setInputValue(rawVal);

    if (rawVal.trim() === '') {
      setError(false);
      onChange('');
      return;
    }

    // Try a live validation of complete input patterns
    const normalized = normalizeJalaliDate(rawVal);
    const parts = normalized.split('/');
    if (parts.length === 3 && parts[0].length === 4 && parts[1].length === 2 && parts[2].length === 2) {
      const isValid = moment(normalized, 'jYYYY/jMM/jDD', true).isValid();
      const todayStr = moment().format('jYYYY/jMM/jDD');
      const isPast = normalized < todayStr;
      const isPastRestricted = isPast && !showPast;

      if (isValid && !isPastRestricted) {
        setError(false);
        onChange(normalized);
      } else {
        setError(true);
      }
    } else {
      // Don't show error while user is in the middle of typing, unless length exceeds normal format
      if (rawVal.length > 10) {
        setError(true);
      } else {
        setError(false);
      }
    }
  };

  const handleBlurOrSubmit = () => {
    if (inputValue.trim() === '') {
      setError(false);
      onChange('');
      return;
    }

    const normalized = normalizeJalaliDate(inputValue);
    const isValid = moment(normalized, 'jYYYY/jMM/jDD', true).isValid();
    const todayStr = moment().format('jYYYY/jMM/jDD');
    const isPast = normalized < todayStr;
    const isPastRestricted = isPast && !showPast;

    if (isValid && !isPastRestricted) {
      setError(false);
      setInputValue(normalized);
      onChange(normalized);
    } else {
      setError(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBlurOrSubmit();
      setOpen(false);
    }
  };

  const isPastError = useMemo(() => {
    if (showPast) return false;
    const normalized = normalizeJalaliDate(inputValue);
    if (!normalized || normalized.split('/').length !== 3) return false;
    const todayStr = moment().format('jYYYY/jMM/jDD');
    return normalized < todayStr;
  }, [inputValue, showPast]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={handleBlurOrSubmit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full px-4 py-3 border rounded-xl text-sm transition-all bg-white pr-10
          ${error
            ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500 text-red-900'
            : 'border-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-gray-800'
          }`}
      />

      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
            setInputValue('');
            setError(false);
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-sm font-bold bg-white/80 p-1 rounded-full transition-colors"
          title="پاک کردن تاریخ"
        >
          ✕
        </button>
      )}

      {error && (
        <span className="text-[11px] text-red-500 block mt-1 select-none">
          {isPastError
            ? 'انتخاب تاریخ گذشته مجاز نیست.'
            : 'تاریخ وارد شده معتبر نیست. نمونه: ۱۴۰۳/۰۱/۱۵'}
        </span>
      )}

      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 shadow-xl rounded-xl">
          <JalaliCalendar
            selectedDate={value}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
            showPast={showPast}
          />
        </div>
      )}
    </div>
  );
}
