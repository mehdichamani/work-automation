import { useState } from 'react';
import moment from 'moment-jalaali';

const HOLIDAYS_1405 = {
  '1405/01/01': 'جشن نوروز',
  '1405/01/02': 'جشن نوروز',
  '1405/01/03': 'جشن نوروز',
  '1405/01/04': 'جشن نوروز',
  '1405/01/12': 'روز جمهوری اسلامی',
  '1405/01/13': 'سیزده به در',
  '1405/01/25': 'شهادت امام جعفر صادق (ع)',
  '1405/03/06': 'عید سعید قربان',
  '1405/03/14': 'رحلت امام خمینی - عید سعید غدیر خم',
  '1405/03/15': 'قیام ۱۵ خرداد',
  '1405/04/03': 'تاسوعای حسینی',
  '1405/04/04': 'عاشورای حسینی',
  '1405/05/13': 'اربعین حسینی',
  '1405/05/21': 'رحلت رسول اکرم - شهادت امام حسن مجتبی (ع)',
  '1405/05/22': 'شهادت امام رضا (ع)',
  '1405/08/22': 'شهادت حضرت فاطمه زهرا (س)',
  '1405/11/22': 'پیروزی انقلاب اسلامی',
  '1405/12/19': 'عید سعید فطر',
};

function getJalaliDayOfWeek(jYear, jMonth, jDay) {
  const anchor = moment('1405/01/01', 'jYYYY/jMM/jDD');
  const target = moment(`${jYear}/${String(jMonth).padStart(2, '0')}/${String(jDay).padStart(2, '0')}`, 'jYYYY/jMM/jDD');
  const diff = target.diff(anchor, 'days');
  return ((diff % 7) + 7) % 7;
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

  const [viewYear, setViewYear] = useState(today.jYear());
  const [viewMonth, setViewMonth] = useState(today.jMonth() + 1);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells = [];

  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}/${String(viewMonth).padStart(2, '0')}/${String(d).padStart(2, '0')}`;
    const isPast = dateStr < todayStr;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const holiday = HOLIDAYS_1405[dateStr];
    const isFriday = getJalaliDayOfWeek(viewYear, viewMonth, d) === 6;

    cells.push({ day: d, dateStr, isPast, isToday, isSelected, holiday, isFriday });
  }

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

  const weekDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-bold">&lt;</button>
        <div className="text-center">
          <span className="font-bold text-sm">{MONTH_NAMES[viewMonth - 1]} {viewYear}</span>
        </div>
        <button onClick={nextMonth} className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-bold">&gt;</button>
      </div>

      <table className="w-full text-center text-xs border-collapse">
        <thead>
          <tr>
            {weekDays.map(d => (
              <th key={d} className="py-2 px-1 text-gray-500 font-medium">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, rowIdx) => (
            <tr key={rowIdx}>
              {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((cell, colIdx) => {
                if (!cell) return <td key={colIdx} className="py-1"></td>;

                const disabled = cell.isPast && !showPast;
                const baseClass = cell.isFriday && !cell.holiday
                  ? 'text-red-400'
                  : '';

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
                        ${cell.holiday && !cell.isSelected ? 'bg-red-100 text-red-700 hover:bg-red-200' : ''}
                        ${baseClass}
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
              <span className="text-red-500 font-bold">{c.day} {MONTH_NAMES[viewMonth - 1]}</span>
              <span className="text-red-600">🔴</span>
              <span className="text-gray-600">{c.holiday}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
