import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [moduleFilter, setModuleFilter] = useState('');

  const modules = ['auth','admin','leave','overtime','purchase','mission','work-order','payment','repair','it','conference','security','daily-output','project-supply','inspection','letters','announcements','job-applications'];

  const moduleLabels = {
    auth: 'احراز هویت', admin: 'مدیریت سیستم', leave: 'مرخصی', overtime: 'اضافه کار',
    purchase: 'درخواست خرید', mission: 'ماموریت', 'work-order': 'کار داخلی', payment: 'درخواست وجه',
    repair: 'تعمیرات', it: 'فناوری اطلاعات', conference: 'کنفرانس', security: 'حراست',
    'daily-output': 'آمار تولید', 'project-supply': 'تامین کالا', inspection: 'بازرسی فنی',
    letters: 'نامه‌ها', announcements: 'اطلاعیه‌ها', 'job-applications': 'پرسشنامه استخدامی'
  };

  useEffect(() => { loadLogs(); }, [page, moduleFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-log', { params: { page, limit: 30, module: moduleFilter || undefined } });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error('خطا در بارگذاری لاگ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6">
        <h1 className="text-2xl font-bold">لاگ فعالیت‌ها</h1>
        <p className="text-primary-100 text-sm mt-1">تاریخچه تمام تغییرات سیستم</p>
      </div>

      <div className="flex gap-4 items-center">
        <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1); }} className="px-4 py-2 border border-gray-200 rounded-xl text-sm">
          <option value="">همه ماژول‌ها</option>
          {modules.map(m => <option key={m} value={m}>{moduleLabels[m] || m}</option>)}
        </select>
        <span className="text-sm text-gray-500">{total} رکورد</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">تاریخ</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">کاربر</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">ماژول</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">عملیات</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">جزئیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString('fa-IR')}</td>
                  <td className="px-4 py-3 text-sm">{log.user_name || '-'}</td>
                  <td className="px-4 py-3 text-sm"><span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full text-xs">{moduleLabels[log.module_name] || log.module_name}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{log.action}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">{log.details}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan="5" className="px-4 py-12 text-center text-gray-400 text-sm">لاگی یافت نشد</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex justify-center gap-2 p-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50">قبلی</button>
            <span className="px-3 py-1 text-sm text-gray-500">صفحه {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 30} className="px-3 py-1 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 disabled:opacity-50">بعدی</button>
          </div>
        </div>
      )}
    </div>
  );
}
