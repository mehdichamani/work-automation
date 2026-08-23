import React from 'react';

export default function HtmlContent({ html = '', className = '', clampLines = null }) {
  if (!html) return null;

  const isHtml = /<[a-z][\s\S]*>/i.test(html);

  if (!isHtml) {
    return (
      <p className={`whitespace-pre-wrap leading-relaxed ${className}`}>
        {html}
      </p>
    );
  }

  return (
    <div
      className={`prose-sm max-w-none text-gray-700 dark:text-gray-300 rich-text-rendered leading-relaxed ${clampLines ? `line-clamp-${clampLines}` : ''} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
