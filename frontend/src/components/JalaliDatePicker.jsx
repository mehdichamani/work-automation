import { useState, useRef, useEffect } from 'react';
import JalaliCalendar from './JalaliCalendar';

export default function JalaliDatePicker({ value, onChange, placeholder = 'انتخاب تاریخ', showPast = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <input
        type="text"
        readOnly
        value={value}
        onClick={() => setOpen(!open)}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all cursor-pointer bg-white"
      />
      {value && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 text-xs"
        >
          ✕
        </button>
      )}
      {open && (
        <div className="absolute top-full mt-1 right-0 z-50 shadow-xl rounded-xl">
          <JalaliCalendar
            selectedDate={value}
            onSelect={(date) => { onChange(date); setOpen(false); }}
            showPast={showPast}
          />
        </div>
      )}
    </div>
  );
}
