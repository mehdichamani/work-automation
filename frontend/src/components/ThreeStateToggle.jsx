import { useState } from 'react';

export default function ThreeStateToggle({ state, onChange, loading, size = 'md' }) {
  const [hover, setHover] = useState(false);

  const sizes = {
    sm: { track: 'h-5 w-9', thumb: 'h-3.5 w-3.5', translate: 'translate-x-4', translateOff: 'translate-x-[3px]', translateMid: 'translate-x-[11px]' },
    md: { track: 'h-6 w-11', thumb: 'h-4 w-4', translate: 'translate-x-6', translateOff: 'translate-x-1', translateMid: 'translate-x-[13px]' },
  };
  const s = sizes[size] || sizes.md;

  const isOn = state === 'on' || state === 1 || state === true;
  const isIndeterminate = state === 'indeterminate' || state === -1;

  let bgColor = 'bg-gray-300';
  if (isOn) bgColor = 'bg-green-500';
  else if (isIndeterminate) bgColor = 'bg-yellow-500';

  if (hover && !loading) {
    if (isOn) bgColor = 'bg-green-600';
    else if (isIndeterminate) bgColor = 'bg-yellow-600';
    else bgColor = 'bg-gray-400';
  }

  let thumbTranslate = s.translateOff;
  if (isOn) thumbTranslate = s.translate;
  else if (isIndeterminate) thumbTranslate = s.translateMid;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      disabled={loading}
      onClick={() => {
        if (isIndeterminate || !isOn) {
          onChange(true);
        } else {
          onChange(false);
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`relative inline-flex items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${bgColor} ${s.track}`}
    >
      <span className="sr-only">Toggle</span>
      {loading ? (
        <span className={`inline-block rounded-full bg-white shadow-sm ${s.thumb} mx-auto`}>
          <svg className="animate-spin h-full w-full text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </span>
      ) : isIndeterminate ? (
        <span className={`inline-block rounded-full bg-white shadow-sm ${s.thumb} ${s.translateMid}`}>
          <span className="block w-1.5 h-[2px] bg-yellow-500 rounded-full mx-auto mt-[5px]" />
        </span>
      ) : (
        <span className={`inline-block rounded-full bg-white shadow-sm transition-transform ${s.thumb} ${thumbTranslate}`} />
      )}
    </button>
  );
}
