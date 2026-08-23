import React, { useRef, useEffect } from 'react';

export default function RichTextEditor({ value = '', onChange, placeholder = 'متن نامه را اینجا بنویسید...' }) {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);

  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const exec = (command, val = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, val);
    handleInput();
  };

  const handleInput = () => {
    if (editorRef.current && onChange) {
      isInternalChange.current = true;
      const html = editorRef.current.innerHTML;
      // If editor contains only empty br or whitespace
      if (html === '<br>' || html.trim() === '') {
        onChange('');
      } else {
        onChange(html);
      }
    }
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 transition-all bg-white">
      {/* نوار ابزار */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50/80 border-b border-gray-200 text-gray-700 select-none">
        {/* Bold */}
        <button
          type="button"
          onClick={() => exec('bold')}
          className="p-1.5 hover:bg-gray-200 rounded text-sm font-bold w-8 h-8 flex items-center justify-center transition-colors"
          title="درشت (Bold)"
        >
          <b>B</b>
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => exec('italic')}
          className="p-1.5 hover:bg-gray-200 rounded text-sm italic w-8 h-8 flex items-center justify-center transition-colors font-serif"
          title="مورب (Italic)"
        >
          <em>I</em>
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => exec('underline')}
          className="p-1.5 hover:bg-gray-200 rounded text-sm underline w-8 h-8 flex items-center justify-center transition-colors font-semibold"
          title="زیرخط (Underline)"
        >
          <u>U</u>
        </button>

        <span className="w-px h-5 bg-gray-300 mx-1"></span>

        {/* Headings */}
        <button
          type="button"
          onClick={() => exec('formatBlock', '<h2>')}
          className="px-2 py-1 hover:bg-gray-200 rounded text-xs font-bold h-8 flex items-center justify-center transition-colors"
          title="تیتر بزرگ (H1/H2)"
        >
          تیتر ۱
        </button>

        <button
          type="button"
          onClick={() => exec('formatBlock', '<h3>')}
          className="px-2 py-1 hover:bg-gray-200 rounded text-xs font-semibold h-8 flex items-center justify-center transition-colors"
          title="تیتر کوچک (H3)"
        >
          تیتر ۲
        </button>

        <button
          type="button"
          onClick={() => exec('formatBlock', '<p>')}
          className="px-2 py-1 hover:bg-gray-200 rounded text-xs h-8 flex items-center justify-center transition-colors"
          title="متن عادی (Paragraph)"
        >
          عادی
        </button>

        <span className="w-px h-5 bg-gray-300 mx-1"></span>

        {/* Unordered List */}
        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          className="p-1.5 hover:bg-gray-200 rounded text-sm w-8 h-8 flex items-center justify-center transition-colors"
          title="فهرست نقطه‌ای"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16M2 6h.01M2 12h.01M2 18h.01" />
          </svg>
        </button>

        {/* Ordered List */}
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          className="p-1.5 hover:bg-gray-200 rounded text-sm w-8 h-8 flex items-center justify-center transition-colors"
          title="فهرست شماره‌دار"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13M3 6h1m-1 6h1m-1 6h1" />
          </svg>
        </button>

        <span className="w-px h-5 bg-gray-300 mx-1"></span>

        {/* Align Right */}
        <button
          type="button"
          onClick={() => exec('justifyRight')}
          className="p-1.5 hover:bg-gray-200 rounded text-sm w-8 h-8 flex items-center justify-center transition-colors"
          title="راست‌چین"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 6H3M21 12H9M21 18H5" />
          </svg>
        </button>

        {/* Align Center */}
        <button
          type="button"
          onClick={() => exec('justifyCenter')}
          className="p-1.5 hover:bg-gray-200 rounded text-sm w-8 h-8 flex items-center justify-center transition-colors"
          title="وسط‌چین"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M5 18h14" />
          </svg>
        </button>

        {/* Align Left */}
        <button
          type="button"
          onClick={() => exec('justifyLeft')}
          className="p-1.5 hover:bg-gray-200 rounded text-sm w-8 h-8 flex items-center justify-center transition-colors"
          title="چپ‌چین"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 12h12M3 18h16" />
          </svg>
        </button>

        <span className="w-px h-5 bg-gray-300 mx-1"></span>

        {/* Horizontal Line */}
        <button
          type="button"
          onClick={() => exec('insertHorizontalRule')}
          className="px-2 py-1 hover:bg-gray-200 rounded text-xs h-8 flex items-center justify-center transition-colors"
          title="خط جداکننده"
        >
          خط افقی
        </button>

        {/* Clear formatting */}
        <button
          type="button"
          onClick={() => exec('removeFormat')}
          className="p-1.5 hover:bg-gray-200 rounded text-xs text-red-500 w-8 h-8 flex items-center justify-center transition-colors"
          title="حذف قالب‌بندی"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ناحیه تایپ متن */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="min-h-[160px] max-h-[350px] overflow-y-auto p-4 text-sm leading-relaxed text-gray-800 outline-none focus:outline-none rich-editor-content"
        dir="rtl"
        style={{ direction: 'rtl', textAlign: 'right' }}
        data-placeholder={placeholder}
      />
    </div>
  );
}
