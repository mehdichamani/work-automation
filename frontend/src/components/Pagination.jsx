export default function Pagination({ page, total, limit, onChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  const pages = [];
  const maxVisible = 5;
  let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-between mt-4 px-2 text-sm">
      <span className="text-gray-500">
        نمایش {start}-{end} از {total} مورد
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(1)}
          disabled={page === 1}
          className="px-2 py-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          «»
        </button>
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          «
        </button>
        {startPage > 1 && <span className="px-1">...</span>}
        {pages.map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`px-3 py-1 rounded border transition-colors ${
              p === page
                ? 'bg-primary-500 text-white border-primary-500'
                : 'hover:bg-gray-100'
            }`}
          >
            {p}
          </button>
        ))}
        {endPage < totalPages && <span className="px-1">...</span>}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-2 py-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          »
        </button>
        <button
          onClick={() => onChange(totalPages)}
          disabled={page === totalPages}
          className="px-2 py-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
        >
          »»
        </button>
      </div>
    </div>
  );
}
