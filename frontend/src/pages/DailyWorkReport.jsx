import { useState, useEffect } from 'react';
import api from '../api/axios';
import moment from 'moment-jalaali';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { toJalali } from '../utils/dateUtils';

const STATUS_MAP = {
  pending_central: { label: 'در انتظار سانترال', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  rejected_by_central: { label: 'رد شده توسط سانترال', color: 'bg-red-100 text-red-800', icon: '❌' },
  pending_manager: { label: 'در انتظار مدیریت', color: 'bg-orange-100 text-orange-800', icon: '⏳' },
  manager_approved: { label: 'تایید مدیریت', color: 'bg-blue-100 text-blue-800', icon: '✅' },
  rejected_by_manager: { label: 'رد شده توسط مدیر', color: 'bg-red-100 text-red-800', icon: '❌' },
  pending_project_control: { label: 'ارجاع به کنترل پروژه', color: 'bg-purple-100 text-purple-800', icon: '📋' },
  completed: { label: 'تکمیل شده', color: 'bg-green-100 text-green-800', icon: '✅' },
};

export default function DailyWorkReport() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [comment, setComment] = useState('');
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ report_date: '', work_description: '', work_duration: '' });
  const [submitting, setSubmitting] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      const url = filter === 'all' ? '/daily-work-report' : `/daily-work-report?status=${filter}`;
      const res = await api.get(url);
      setReports(res.data.reports || res.data);
    } catch (err) {
      toast.error('خطا در بارگذاری');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const loadDetail = async (id) => {
    try {
      setSelected(id);
      const res = await api.get(`/daily-work-report/${id}`);
      setDetail(res.data.report);
      setHistory(res.data.history || []);
      setComment('');
    } catch (err) { toast.error('خطا'); }
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!form.report_date || !form.work_description) return toast.error('تاریخ و شرح کار الزامی است');
    setSubmitting(true);
    try {
      await api.post('/daily-work-report', form);
      toast.success('ثبت شد');
      setShowForm(false);
      setForm({ report_date: '', work_description: '', work_duration: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    } finally { setSubmitting(false); }
  };

  const doAction = async (id, action, successMsg) => {
    if (action.includes('reject') && !comment) return toast.error('دلیل رد الزامی است');
    try {
      await api.post(`/daily-work-report/${id}/${action}`, { comment });
      toast.success(successMsg);
      setSelected(null);
      setDetail(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('آیا از حذف مطمئن هستید؟')) return;
    try {
      await api.delete(`/daily-work-report/${id}`);
      toast.success('حذف شد');
      setSelected(null);
      setDetail(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const renderActions = (report) => {
    if (!report) return null;
    const s = report.status;
    const isAdmin = user.role === 'admin' || user.role === 'manager';
    const isCentral = user.role === 'admin' || user.role === 'manager' || user.role === 'supervisor';
    const isManager = user.role === 'admin' || user.role === 'manager';

    return (
      <div className="flex flex-wrap gap-2 mt-4">
        {isCentral && s === 'pending_central' && (
          <>
            <button onClick={() => doAction(report.id, 'central-approve', 'تایید شد')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">تایید و ارسال به مدیریت</button>
            <button onClick={() => doAction(report.id, 'central-reject', 'رد شد')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">رد</button>
          </>
        )}
        {isManager && s === 'pending_manager' && (
          <>
            <button onClick={() => doAction(report.id, 'manager-approve', 'تایید شد')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">تایید مدیریت</button>
            <button onClick={() => doAction(report.id, 'manager-reject', 'رد شد')} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">رد</button>
          </>
        )}
        {isCentral && s === 'manager_approved' && (
          <button onClick={() => doAction(report.id, 'forward-to-project-control', 'ارجاع شد')} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">ارجاع به کنترل پروژه</button>
        )}
        {isAdmin && s === 'pending_project_control' && (
          <button onClick={() => doAction(report.id, 'project-control-approve', 'تایید نهایی شد')} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">تایید نهایی</button>
        )}
        {report.user_id === user.id && s === 'pending_central' && (
          <button onClick={() => handleDelete(report.id)} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm">حذف</button>
        )}
      </div>
    );
  };

  const today = moment().format('YYYY-MM-DD');

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">گزارش کار روزانه</h1>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {showForm ? 'بستن' : '+ ثبت گزارش جدید'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitReport} className="bg-white rounded-xl shadow p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">تاریخ گزارش <span className="text-red-500">*</span></label>
              <input type="date" value={form.report_date} max={today}
                onChange={e => setForm({ ...form, report_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">مدت زمان کار (ساعت)</label>
              <input type="text" value={form.work_duration} placeholder="مثلاً 8 ساعت"
                onChange={e => setForm({ ...form, work_duration: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">شرح کار انجام شده <span className="text-red-500">*</span></label>
            <textarea rows={5} value={form.work_description} placeholder="شرح کار انجام شده در این روز..."
              onChange={e => setForm({ ...form, work_description: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'در حال ارسال...' : 'ثبت گزارش'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400">لغو</button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'all', label: 'همه' },
          { key: 'pending_central', label: 'در انتظار سانترال' },
          { key: 'pending_manager', label: 'در انتظار مدیریت' },
          { key: 'manager_approved', label: 'تایید مدیریت' },
          { key: 'pending_project_control', label: 'ارجاع به کنترل پروژه' },
          { key: 'completed', label: 'تکمیل شده' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-full text-sm ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">در حال بارگذاری...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 text-gray-500 bg-white rounded-xl shadow p-8">گزارشی ثبت نشده</div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md transition"
              onClick={() => loadDetail(r.id)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[r.status]?.color || 'bg-gray-100'}`}>
                      {STATUS_MAP[r.status]?.icon} {STATUS_MAP[r.status]?.label || r.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-1">{r.report_date} — {r.user_name} ({r.department_name || 'بدون بخش'})</div>
                  <div className="text-gray-800 line-clamp-2">{r.work_description}</div>
                  {r.work_duration && <div className="text-xs text-gray-500 mt-1">مدت: {r.work_duration}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && detail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" dir="rtl">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">جزئیات گزارش</h2>
              <button onClick={() => { setSelected(null); setDetail(null); }} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>

            <div className="space-y-3 text-sm">
              <div><span className="font-medium">تاریخ:</span> {detail.report_date}</div>
              <div><span className="font-medium">نویسنده:</span> {detail.user_name} — {detail.department_name}</div>
              <div><span className="font-medium">مدت:</span> {detail.work_duration || 'نامشخص'}</div>
              <div><span className="font-medium">وضعیت:</span> <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_MAP[detail.status]?.color}`}>{STATUS_MAP[detail.status]?.label}</span></div>
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="font-medium mb-1">شرح کار:</div>
                <div className="whitespace-pre-wrap">{detail.work_description}</div>
              </div>
            </div>

            {history.length > 0 && (
              <div className="mt-4">
                <h3 className="font-bold mb-2">تاریخچه</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="flex gap-3 items-start text-sm border-b pb-2">
                      <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                      <div>
                        <div className="font-medium">{h.user_name} — {h.action}</div>
                        <div className="text-gray-500 text-xs">{toJalali(h.created_at)}</div>
                        {h.comment && <div className="text-gray-600 mt-1">{h.comment}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">نظر / توضیح</label>
              <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="نظر خود را بنویسید..." />
            </div>

            <div className="flex gap-2 mt-4">
              {renderActions(detail)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
