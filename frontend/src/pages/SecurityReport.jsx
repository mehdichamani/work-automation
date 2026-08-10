import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import JalaliCalendar from '../components/JalaliCalendar';
import { toJalali, toJalaliDateTime } from '../utils/dateUtils';

const statusMap = {
  pending: { text: 'در انتظار بررسی', color: 'bg-blue-100 text-blue-700' },
  reviewed: { text: 'بررسی شده', color: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'تایید شده', color: 'bg-green-100 text-green-700' },
  rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
};

const shiftLabels = { morning: 'صبح', evening: 'عصر', night: 'شب' };

export default function SecurityReport() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [formData, setFormData] = useState({ report_date: '', shift_type: '', incidents: '', visitors: '', vehicles: '', notes: '' });
  const [showDateCal, setShowDateCal] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportHistory, setReportHistory] = useState([]);
  const [rejectComment, setRejectComment] = useState('');

  useEffect(() => { loadReports(); }, [activeTab]);

  const loadReports = async () => {
    try {
      setLoading(true);
      let res;
      if (activeTab === 'my') {
        res = await api.get('/security/my-reports');
        setReports(res.data || []);
      } else if (activeTab === 'pending') {
        res = await api.get('/security/pending-review');
        setReports(res.data || []);
      } else {
        res = await api.get('/security');
        setReports(res.data.reports || []);
      }
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const submitReport = async () => {
    setSubmitLoading(true);
    try {
      if (!formData.report_date || !formData.shift_type) return toast.error('تاریخ و شیفت الزامی است');
      await api.post('/security', formData);
      toast.success('گزارش ثبت شد و منتظر بررسی است');
      setShowForm(false);
      setFormData({ report_date: '', shift_type: '', incidents: '', visitors: '', vehicles: '', notes: '' });
      loadReports();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
    finally { setSubmitLoading(false); }
  };

  const reviewReport = async (id, status) => {
    const comment = status === 'rejected' ? prompt('دلیل رد:') : '';
    if (status === 'rejected' && !comment) return;
    try {
      await api.post(`/security/${id}/review`, { status, comment: comment || '' });
      toast.success(status === 'reviewed' ? 'بررسی شد' : 'رد شد');
      setSelectedReport(null);
      loadReports();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const approveReport = async (id) => {
    try {
      await api.post(`/security/${id}/approve`, { comment: '' });
      toast.success('گزارش تایید شد');
      setSelectedReport(null);
      loadReports();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const rejectReport = async (id) => {
    if (!rejectComment) return toast.error('دلیل رد الزامی است');
    try {
      await api.post(`/security/${id}/reject`, { comment: rejectComment });
      toast.success('گزارش رد شد');
      setSelectedReport(null);
      setRejectComment('');
      loadReports();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const deleteReport = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try { await api.delete(`/security/${id}`); toast.success('حذف شد'); loadReports(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const viewReport = async (id) => {
    try {
      const res = await api.get(`/security/${id}`);
      setSelectedReport(res.data.report);
      setReportHistory(res.data.history || []);
    } catch (err) { toast.error('خطا در بارگذاری جزئیات'); }
  };

  return (
    <div className="animate-fade-in space-y-6" dir="rtl">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">گزارش روزانه حراست</h1>
          <p className="text-primary-100 text-sm mt-1">مدیریت گزارش‌های روزانه حراست</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-white/20 hover:bg-white/30 backdrop-blur text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
          + گزارش جدید
        </button>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'my', label: 'گزارش‌های من' },
          { key: 'pending', label: 'در انتظار بررسی', role: 'supervisor' },
          { key: 'all', label: 'همه گزارش‌ها' },
        ].filter(t => !t.role || user.role === 'supervisor' || user.role === 'manager' || user.role === 'admin').map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-primary-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="font-bold text-lg mb-4">ثبت گزارش جدید</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="text-sm text-gray-600 mb-1 block">تاریخ <span className="text-red-500">*</span></label>
                <button type="button" onClick={() => setShowDateCal(!showDateCal)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-left focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" dir="ltr">
                  {formData.report_date || 'انتخاب تاریخ'}
                </button>
                {showDateCal && (
                  <div className="absolute mt-1 z-10">
                    <JalaliCalendar
                      selectedDate={formData.report_date}
                      onSelect={(d) => { setFormData({...formData, report_date: d}); setShowDateCal(false); }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">شیفت <span className="text-red-500">*</span></label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" value={formData.shift_type} onChange={e => setFormData({ ...formData, shift_type: e.target.value })}>
                  <option value="">انتخاب شیفت</option>
                  <option value="morning">صبح</option>
                  <option value="evening">عصر</option>
                  <option value="night">شب</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">حوادث و رویدادها</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" rows={3} placeholder="توضیحات حوادث..." value={formData.incidents} onChange={e => setFormData({ ...formData, incidents: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">مراجعین</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" rows={3} placeholder="لیست مراجعین..." value={formData.visitors} onChange={e => setFormData({ ...formData, visitors: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">تردد خودروها</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" rows={3} placeholder="تردد خودروها..." value={formData.vehicles} onChange={e => setFormData({ ...formData, vehicles: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">یادداشت‌ها</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" rows={3} placeholder="یادداشت‌ها..." value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => { setShowForm(false); setFormData({ report_date: '', shift_type: '', incidents: '', visitors: '', vehicles: '', notes: '' }); }} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">انصراف</button>
              <button onClick={submitReport} disabled={submitLoading} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">{submitLoading ? 'در حال ارسال...' : 'ثبت گزارش'}</button>
            </div>
          </div>
        </div>
      )}

      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in" dir="rtl">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg">جزئیات گزارش حراست</h3>
              <button onClick={() => { setSelectedReport(null); setRejectComment(''); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">تاریخ:</span> <span className="font-medium">{selectedReport.report_date}</span></div>
                <div><span className="text-gray-500">شیفت:</span> <span className="font-medium">{shiftLabels[selectedReport.shift_type]}</span></div>
                <div><span className="text-gray-500">ثبت کننده:</span> <span className="font-medium">{selectedReport.user_name}</span></div>
                <div><span className="text-gray-500">وضعیت:</span> <span className={`px-2 py-0.5 rounded text-xs ${statusMap[selectedReport.status]?.color || ''}`}>{statusMap[selectedReport.status]?.text || selectedReport.status}</span></div>
              </div>
              {selectedReport.incidents && <div><span className="text-gray-500">حوادث:</span><p className="mt-1 bg-gray-50 p-2 rounded whitespace-pre-wrap">{selectedReport.incidents}</p></div>}
              {selectedReport.visitors && <div><span className="text-gray-500">مراجعین:</span><p className="mt-1 bg-gray-50 p-2 rounded whitespace-pre-wrap">{selectedReport.visitors}</p></div>}
              {selectedReport.vehicles && <div><span className="text-gray-500">خودروها:</span><p className="mt-1 bg-gray-50 p-2 rounded whitespace-pre-wrap">{selectedReport.vehicles}</p></div>}
              {selectedReport.notes && <div><span className="text-gray-500">یادداشت‌ها:</span><p className="mt-1 bg-gray-50 p-2 rounded whitespace-pre-wrap">{selectedReport.notes}</p></div>}
              {selectedReport.supervisor_name && <div><span className="text-gray-500">بررسی کننده:</span> <span className="font-medium">{selectedReport.supervisor_name}</span></div>}
              {selectedReport.supervisor_comment && <div><span className="text-gray-500">نظر سرپرست:</span> <span className="font-medium">{selectedReport.supervisor_comment}</span></div>}
              {selectedReport.manager_name && <div><span className="text-gray-500">تایید کننده:</span> <span className="font-medium">{selectedReport.manager_name}</span></div>}

              {reportHistory.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-bold text-primary-700 text-sm border-b border-primary-100 pb-1 mb-2">تاریخچه</h4>
                  <div className="space-y-2">
                    {reportHistory.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs bg-gray-50 rounded-lg p-2">
                        <span className="font-bold text-primary-600 shrink-0">{h.action}</span>
                        <span className="text-gray-500">{h.user_name}</span>
                        {h.comment && <span className="text-gray-400">- {h.comment}</span>}
                        <span className="text-gray-400 mr-auto">{toJalali(h.created_at, 'jYYYY/jMM/jDD HH:mm')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedReport.status === 'pending' && (user.role === 'supervisor' || user.role === 'admin') && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex gap-2">
                    <button onClick={() => reviewReport(selectedReport.id, 'reviewed')} className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded-xl text-sm font-bold">بررسی شده</button>
                    <button onClick={() => reviewReport(selectedReport.id, 'rejected')} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl text-sm font-bold">رد</button>
                  </div>
                </div>
              )}
              {selectedReport.status === 'reviewed' && (user.role === 'manager' || user.role === 'admin') && (
                <div className="border-t pt-4 mt-4">
                  <label className="text-sm font-medium mb-1 block">نظر (برای رد الزامی است)</label>
                  <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm mb-3" placeholder="دلیل رد..." />
                  <div className="flex gap-2">
                    <button onClick={() => approveReport(selectedReport.id)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-bold">تایید</button>
                    <button onClick={() => rejectReport(selectedReport.id)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl text-sm font-bold">رد</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-500 mt-2 text-sm">در حال بارگذاری...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-300 text-5xl mb-4">📋</div>
            <p className="text-gray-400 text-sm">گزارشی وجود ندارد</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تاریخ</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">شیفت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">حوادث</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">مراجعین</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">ثبت کننده</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">وضعیت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map(r => {
                const s = statusMap[r.status] || statusMap.pending;
                return (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs">{r.report_date}</td>
                  <td className="px-4 py-3 text-xs">{shiftLabels[r.shift_type] || r.shift_type}</td>
                  <td className="px-4 py-3 text-xs max-w-[150px] truncate">{r.incidents || '-'}</td>
                  <td className="px-4 py-3 text-xs max-w-[150px] truncate">{r.visitors || '-'}</td>
                  <td className="px-4 py-3 text-xs">{r.user_name}</td>
                  <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.text}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => viewReport(r.id)} className="bg-primary-50 text-primary-600 hover:bg-primary-100 px-3 py-1 rounded-lg text-xs font-medium transition-all">مشاهده</button>
                      {(r.status === 'pending' || r.status === 'rejected') && r.user_id === user.id && (
                        <button onClick={() => deleteReport(r.id)} className="bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1 rounded-lg text-xs font-medium transition-all">حذف</button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
