import { useState, useEffect, useMemo } from 'react';
import moment from 'moment-jalaali';
import api from '../api/axios';

// Global cache to prevent duplicate requests when multiple calendars are rendered or re-mounted
let globalHolidays = null;
let globalHolidaysPromise = null;

function getJalaliDayOfWeek(jYear, jMonth, jDay) {
  // Optimized: Use moment-jalaali direct day calculation instead of anchor comparison
  const target = moment(`${jYear}/${String(jMonth).padStart(2, '0')}/${String(jDay).padStart(2, '0')}`, 'jYYYY/jMM/jDD');
  const mDay = target.day();
  return (mDay + 1) % 7;
}

function getDaysInMonth(jYear, jMonth) {
  return moment.jDaysInMonth(jYear, jMonth);
}

function getFirstDayOfMonth(jYear, jMonth) {
  return getJalaliDayOfWeek(jYear, jMonth, 1);
}

const MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

export default function JalaliCalendar({ onSelect, selectedDate, showPast = false }) {
  const today = moment();
  const todayStr = today.format('jYYYY/jMM/jDD');
  const currentJYear = today.jYear();

  const [viewYear, setViewYear] = useState(today.jYear());
  const [viewMonth, setViewMonth] = useState(today.jMonth() + 1);
  const [holidays, setHolidays] = useState({});

  // Year range: 30 years in the past to 10 years in the future
  const years = useMemo(() => {
    return Array.from({ length: 41 }, (_, i) => currentJYear - 30 + i);
  }, [currentJYear]);

  useEffect(() => {
    if (globalHolidays) {
      setHolidays(globalHolidays);
      return;
    }
    if (globalHolidaysPromise) {
      globalHolidaysPromise.then(data => {
        if (data) setHolidays(data);
      });
      return;
    }

    globalHolidaysPromise = api.get('/leave/holidays')
      .then(res => {
        const holMap = {};
        res.data.forEach(h => {
          holMap[h.holiday_date] = h.title || 'تعطیل رسمی';
        });
        globalHolidays = holMap;
        setHolidays(holMap);
        return holMap;
      })
      .catch(err => {
        console.error('Error fetching holidays in calendar:', err);
        globalHolidaysPromise = null; // Allow retry on subsequent mounts
        return null;
      });
  }, []);

  const cells = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const tempCells = [];

    for (let i = 0; i < firstDay; i++) {
      tempCells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}/${String(viewMonth).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const holiday = holidays[dateStr];
      const isThursday = getJalaliDayOfWeek(viewYear, viewMonth, d) === 5;
      const isFriday = getJalaliDayOfWeek(viewYear, viewMonth, d) === 6;

      tempCells.push({ day: d, dateStr, isPast, isToday, isSelected, holiday, isThursday, isFriday });
    }
    return tempCells;
  }, [viewYear, viewMonth, selectedDate, showPast, holidays, todayStr]);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const goToToday = () => {
    setViewYear(today.jYear());
    setViewMonth(today.jMonth() + 1);
    if (onSelect) {
      onSelect(todayStr);
    }
  };

  const weekDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  const weekDaysShort = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

  return (
    <div className="bg-white border rounded-xl p-4 shadow-xl w-full max-w-[320px] sm:max-w-none">
      <div className="flex items-center justify-between mb-4 gap-2">
        <button
          type="button"
          onClick={prevMonth}
          className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-600 transition-colors"
          title="ماه قبل"
        >
          &lt;
        </button>

        <div className="flex items-center gap-1">
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
            className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={viewYear}
            onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
            className="bg-gray-50 border border-gray-200 text-gray-800 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
          >
            {years.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={goToToday}
          className="px-2 py-1 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-600 text-xs font-bold transition-colors"
          title="برو به امروز"
        >
          امروز
        </button>

        <button
          type="button"
          onClick={nextMonth}
          className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-bold text-gray-600 transition-colors"
          title="ماه بعد"
        >
          &gt;
        </button>
      </div>

      <table className="w-full text-center text-xs border-collapse">
        <thead>
          <tr>
            {weekDays.map((d, idx) => (
              <th key={d} className="py-2 px-1 text-gray-500 font-medium">
                <span className="hidden sm:inline">{d}</span>
                <span className="inline sm:hidden">{weekDaysShort[idx]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, rowIdx) => (
            <tr key={rowIdx}>
              {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
                if (!cell) return <td key={colIdx} className="py-1"></td>;

                const disabled = cell.isPast && !showPast;
                
                let dayClass = 'text-gray-700';
                if (!disabled && !cell.isSelected) {
                  if (cell.holiday) {
                    dayClass = 'bg-purple-100 text-purple-700 hover:bg-purple-200 font-bold';
                  } else if (cell.isFriday) {
                    dayClass = 'bg-red-50 text-red-600 hover:bg-red-100';
                  } else if (cell.isThursday) {
                    dayClass = 'bg-amber-50 text-amber-700 hover:bg-amber-100';
                  }
                }

                return (
                  <td key={colIdx} className="py-1">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && onSelect(cell.dateStr)}
                      className={`w-8 h-8 rounded-lg text-[11px] font-medium transition-all
                        ${disabled ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer hover:bg-primary-100'}
                        ${cell.isSelected ? 'bg-primary-500 text-white hover:bg-primary-600 shadow' : ''}
                        ${cell.isToday && !cell.isSelected ? 'ring-2 ring-primary-300 font-bold' : ''}
                        ${dayClass}
                      `}
                      title={cell.holiday || ''}
                    >
                      {cell.day}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {cells.some(c => c?.holiday) && (
        <div className="mt-3 pt-3 border-t space-y-1">
          {cells.filter(c => c?.holiday).map(c => (
            <div key={c.dateStr} className="flex items-center gap-2 text-[11px]">
              <span className="text-purple-500 font-bold">{c.day} {MONTH_NAMES[viewMonth - 1]}</span>
              <span className="text-purple-600">🟣</span>
              <span className="text-gray-600">{c.holiday}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
