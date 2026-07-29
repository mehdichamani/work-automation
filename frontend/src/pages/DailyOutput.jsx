import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import JalaliCalendar from '../components/JalaliCalendar';
import { toJalali } from '../utils/dateUtils';

const statusMap = {
  pending: { text: 'در انتظار بررسی', color: 'bg-blue-100 text-blue-700' },
  reviewed: { text: 'بررسی شده', color: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'تایید شده', color: 'bg-green-100 text-green-700' },
  rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
};

export default function DailyOutput() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [formData, setFormData] = useState({ report_date: '', product_name: '', quantity: '', unit: 'عدد', quality_score: '', description: '', machine_number: '' });
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
        res = await api.get('/daily-output/my-reports');
        setReports(res.data || []);
      } else if (activeTab === 'pending') {
        res = await api.get('/daily-output/pending-review');
        setReports(res.data || []);
      } else {
        res = await api.get('/daily-output');
        setReports(res.data.reports || []);
      }
      if (activeTab === 'summary' || activeTab === 'all') {
        const sumRes = await api.get('/daily-output/summary');
        setSummary(sumRes.data);
      }
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const submitReport = async () => {
    setSubmitLoading(true);
    try {
      if (!formData.report_date || !formData.product_name || !formData.quantity) {
        return toast.error('تاریخ، نام محصول و تعداد الزامی است');
      }
      await api.post('/daily-output', formData);
      toast.success('گزارش ثبت شد و منتظر بررسی است');
      setShowForm(false);
      setFormData({ report_date: '', product_name: '', quantity: '', unit: 'عدد', quality_score: '', description: '', machine_number: '' });
      loadReports();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
    finally { setSubmitLoading(false); }
  };

  const reviewReport = async (id, status) => {
    const comment = status === 'rejected' ? prompt('دلیل رد:') : '';
    if (status === 'rejected' && !comment) return;
    try {
      await api.post(`/daily-output/${id}/review`, { status, comment: comment || '' });
      toast.success(status === 'reviewed' ? 'بررسی شد' : 'رد شد');
      setSelectedReport(null);
      loadReports();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const approveReport = async (id) => {
    try {
      await api.post(`/daily-output/${id}/approve`, { comment: '' });
      toast.success('گزارش تایید شد');
      setSelectedReport(null);
      loadReports();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const rejectReport = async (id) => {
    if (!rejectComment) return toast.error('دلیل رد الزامی است');
    try {
      await api.post(`/daily-output/${id}/reject`, { comment: rejectComment });
      toast.success('گزارش رد شد');
      setSelectedReport(null);
      setRejectComment('');
      loadReports();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const deleteReport = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try { await api.delete(`/daily-output/${id}`); toast.success('حذف شد'); loadReports(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const viewReport = async (id) => {
    try {
      const res = await api.get(`/daily-output/${id}`);
      setSelectedReport(res.data.report);
      setReportHistory(res.data.history || []);
    } catch (err) { toast.error('خطا در بارگذاری جزئیات'); }
  };

  return (
    <div className="animate-fade-in space-y-6" dir="rtl">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">آمار روزانه خروجی</h1>
          <p className="text-primary-100 text-sm mt-1">مدیریت گزارش‌های تولید روزانه</p>
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
          { key: 'summary', label: 'خلاصه تولید' },
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
            <h3 className="font-bold text-lg mb-4">ثبت گزارش تولید روزانه</h3>
            <div className="grid grid-cols-2 gap-4">
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
                <label className="text-sm text-gray-600 mb-1 block">نام محصول <span className="text-red-500">*</span></label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="مثال: شیشه دوجداره" value={formData.product_name} onChange={e => setFormData({ ...formData, product_name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">تعداد <span className="text-red-500">*</span></label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" type="number" placeholder="مثال: ۱۰۰" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">واحد</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="عدد" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">امتیاز کیفیت (۰-۱۰)</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" type="number" step="0.1" min="0" max="10" placeholder="مثال: ۸.۵" value={formData.quality_score} onChange={e => setFormData({ ...formData, quality_score: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">شماره ماشین</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="مثال: M-01" value={formData.machine_number} onChange={e => setFormData({ ...formData, machine_number: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="text-sm text-gray-600 mb-1 block">توضیحات</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" rows={3} placeholder="توضیحات تکمیلی..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => { setShowForm(false); setFormData({ report_date: '', product_name: '', quantity: '', unit: 'عدد', quality_score: '', description: '', machine_number: '' }); }} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">انصراف</button>
              <button onClick={submitReport} disabled={submitLoading} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">{submitLoading ? 'در حال ارسال...' : 'ثبت گزارش'}</button>
            </div>
          </div>
        </div>
      )}

      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in" dir="rtl">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg">جزئیات گزارش تولید</h3>
              <button onClick={() => { setSelectedReport(null); setRejectComment(''); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">تاریخ:</span> <span className="font-medium">{selectedReport.report_date}</span></div>
                <div><span className="text-gray-500">محصول:</span> <span className="font-medium">{selectedReport.product_name}</span></div>
                <div><span className="text-gray-500">تعداد:</span> <span className="font-medium">{selectedReport.quantity} {selectedReport.unit}</span></div>
                <div><span className="text-gray-500">کیفیت:</span> <span className="font-medium">{selectedReport.quality_score || '-'}</span></div>
                <div><span className="text-gray-500">ماشین:</span> <span className="font-medium">{selectedReport.machine_number || '-'}</span></div>
                <div><span className="text-gray-500">ثبت کننده:</span> <span className="font-medium">{selectedReport.user_name}</span></div>
                <div><span className="text-gray-500">وضعیت:</span> <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusMap[selectedReport.status]?.color || ''}`}>{statusMap[selectedReport.status]?.text || selectedReport.status}</span></div>
              </div>
              {selectedReport.description && <div><span className="text-gray-500">توضیحات:</span><p className="mt-1 bg-gray-50 p-2 rounded whitespace-pre-wrap">{selectedReport.description}</p></div>}
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

      {activeTab === 'summary' && summary.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold mb-4">خلاصه تولید بر اساس محصول</h3>
          <div className="grid grid-cols-3 gap-4">
            {summary.map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-lg font-bold text-primary-600">{parseInt(s.total_quantity).toLocaleString()}</p>
                <p className="text-sm text-gray-600">{s.product_name}</p>
                {s.avg_quality && <p className="text-xs text-gray-400 mt-1">کیفیت: {parseFloat(s.avg_quality).toFixed(1)}</p>}
              </div>
            ))}
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
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">محصول</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تعداد</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">کیفیت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">ماشین</th>
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
                  <td className="px-4 py-3 text-sm font-medium">{r.product_name}</td>
                  <td className="px-4 py-3 text-sm">{r.quantity} {r.unit}</td>
                  <td className="px-4 py-3 text-xs">{r.quality_score || '-'}</td>
                  <td className="px-4 py-3 text-xs">{r.machine_number || '-'}</td>
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
