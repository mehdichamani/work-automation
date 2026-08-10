import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalali, toJalaliDateTime } from '../utils/dateUtils';

const CATEGORIES = {
  general: 'عمومی', hardware: 'سخت‌افزار', software: 'نرم‌افزار',
  network: 'شبکه', security: 'امنیت', other: 'سایر'
};
const PRIORITIES = { low: 'پایین', normal: 'عادی', high: 'بالا', urgent: 'فوری' };
const STATUSES = {
  pending: 'باز', in_progress: 'در حال بررسی', completed: 'حل شده', rejected: 'رد شده', closed: 'بسته شده'
};
const STATUS_COLORS = {
  pending: 'bg-blue-100 text-blue-700', in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', closed: 'bg-gray-100 text-gray-500'
};
const PRIORITY_COLORS = {
  low: 'bg-gray-100 text-gray-500', normal: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600', urgent: 'bg-red-100 text-red-600 animate-pulse'
};

export default function ITRequest() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [responses, setResponses] = useState([]);
  const [responseText, setResponseText] = useState('');
  const [filter, setFilter] = useState({ status: '', priority: '' });
  const [formData, setFormData] = useState({
    title: '', description: '', request_type: 'general', urgency: 'normal', device_info: ''
  });

  useEffect(() => { loadRequests(); loadStats(); }, [filter]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.priority) params.priority = filter.priority;
      const res = await api.get('/it', { params });
      setRequests(res.data.requests || res.data);
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const loadStats = async () => {
    try {
      const res = await api.get('/it/stats');
      setStats(res.data);
    } catch (err) { toast.error('خطا در بارگذاری آمار'); }
  };

  const submitRequest = async () => {
    if (!formData.title) return toast.error('عنوان الزامی است');
    try {
      await api.post('/it', formData);
      toast.success('تیکت ثبت شد');
      setShowForm(false);
      setFormData({ title: '', description: '', request_type: 'general', urgency: 'normal', device_info: '' });
      loadRequests();
      loadStats();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const selectRequest = async (req) => {
    setSelected(req);
    try {
      const res = await api.get(`/it/${req.id}`);
      setResponses(res.data.history || res.data.responses || []);
    } catch (err) { setResponses([]); }
  };

  const sendResponse = async () => {
    if (!responseText.trim() || !selected) return;
    try {
      await api.post(`/it/${selected.id}/respond`, { comment: responseText });
      setResponseText('');
      selectRequest(selected);
      toast.success('پاسخ ارسال شد');
    } catch (err) {
      try {
        await api.post(`/it/${selected.id}/complete`, { comment: responseText });
        setResponseText('');
        selectRequest(selected);
        toast.success('پاسخ ارسال شد');
      } catch (e) { toast.error('خطا'); }
    }
  };

  const changeStatus = async (id, action) => {
    try {
      if (action === 'accept') await api.post(`/it/${id}/accept`);
      else if (action === 'complete') {
        const comment = prompt('توضیحات تکمیلی:');
        if (comment === null) return;
        await api.post(`/it/${id}/complete`, { comment });
      } else if (action === 'reject') {
        const comment = prompt('دلیل رد:');
        if (!comment) return;
        await api.post(`/it/${id}/reject`, { comment });
      }
      toast.success('وضعیت تغییر کرد');
      loadRequests();
      loadStats();
      if (selected?.id === id) selectRequest({ ...selected, status: action === 'accept' ? 'in_progress' : action === 'complete' ? 'completed' : 'rejected' });
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const assignRequest = async (id) => {
    const userId = prompt('کد پرسنلی مسئول را وارد کنید:');
    if (!userId) return;
    try {
      await api.put(`/it/${id}/assign`, { assigned_to: parseInt(userId) });
      toast.success('تیکت واگذار شد');
      loadRequests();
    } catch (err) { toast.error('خطا'); }
  };

  const deleteRequest = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try { await api.delete(`/it/${id}`); toast.success('حذف شد'); loadRequests(); setSelected(null); }
    catch (err) { toast.error('خطا'); }
  };

  const filteredReqs = requests;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🎫 ثبت تیکت</h1>
          <p className="text-primary-100 text-sm mt-1">مدیریت درخواست‌ها و پشتیبانی</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-white/20 hover:bg-white/30 backdrop-blur text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
          {showForm ? 'انصراف' : '+ تیکت جدید'}
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-blue-600">{stats.pending || 0}</p>
            <p className="text-xs text-gray-500">باز</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-yellow-600">{stats.in_progress || 0}</p>
            <p className="text-xs text-gray-500">در حال بررسی</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{stats.completed || 0}</p>
            <p className="text-xs text-gray-500">حل شده</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-red-600">{stats.urgent || 0}</p>
            <p className="text-xs text-gray-500">فوری</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-600">{stats.total || 0}</p>
            <p className="text-xs text-gray-500">کل</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-800">تیکت جدید</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" placeholder="عنوان تیکت *" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" value={formData.request_type} onChange={e => setFormData({ ...formData, request_type: e.target.value })}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" value={formData.urgency} onChange={e => setFormData({ ...formData, urgency: e.target.value })}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" placeholder="اطلاعات دستگاه" value={formData.device_info} onChange={e => setFormData({ ...formData, device_info: e.target.value })} />
            <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm md:col-span-2 h-24" placeholder="توضیحات..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={submitRequest} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600">ثبت تیکت</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200">انصراف</button>
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} className="px-3 py-1.5 border rounded-lg text-xs">
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filter.priority} onChange={e => setFilter({ ...filter, priority: e.target.value })} className="px-3 py-1.5 border rounded-lg text-xs">
          <option value="">همه اولویت‌ها</option>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${selected ? 'hidden lg:block' : ''} lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto`}>
          {loading ? (
            <div className="text-center py-8 text-gray-400">در حال بارگذاری...</div>
          ) : filteredReqs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">تیکتی وجود ندارد</div>
          ) : filteredReqs.map(r => (
            <div key={r.id} onClick={() => selectRequest(r)}
              className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md border-r-4 ${
                selected?.id === r.id ? 'border-primary-500 ring-2 ring-primary-200' :
                r.urgency === 'urgent' ? 'border-red-500' : 'border-gray-200'
              }`}>
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-bold text-sm text-gray-800 line-clamp-1">{r.title}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${PRIORITY_COLORS[r.urgency || r.priority]}`}>
                  {PRIORITIES[r.urgency || r.priority] || 'عادی'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>#{r.request_number || r.id}</span>
                <span>{CATEGORIES[r.request_type] || r.request_type}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-[10px] px-2 py-0.5 rounded ${STATUS_COLORS[r.status]}`}>
                  {STATUSES[r.status] || r.status}
                </span>
                <span className="text-[10px] text-gray-400">{toJalali(r.created_at)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className={`${!selected ? 'hidden lg:block' : ''} lg:col-span-2`}>
          {selected ? (
            <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{selected.title}</h3>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[selected.status]}`}>
                      {STATUSES[selected.status]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded ${PRIORITY_COLORS[selected.urgency || selected.priority]}`}>
                      {PRIORITIES[selected.urgency || selected.priority] || 'عادی'}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {CATEGORIES[selected.request_type]}
                    </span>
                    <span className="text-xs text-gray-400">#{selected.request_number || selected.id}</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              {selected.description && (
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">{selected.description}</div>
              )}
              {selected.device_info && (
                <div className="text-xs text-gray-500">اطلاعات دستگاه: {selected.device_info}</div>
              )}

              <div className="flex gap-2 flex-wrap">
                {selected.status === 'pending' && (user.role !== 'user' || selected.user_id === user.id) && (
                  <button onClick={() => changeStatus(selected.id, 'accept')} className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg text-xs hover:bg-yellow-200">
                    شروع بررسی
                  </button>
                )}
                {selected.status === 'in_progress' && user.role !== 'user' && (
                  <>
                    <button onClick={() => changeStatus(selected.id, 'complete')} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-xs hover:bg-green-200">
                      حل شد
                    </button>
                    <button onClick={() => assignRequest(selected.id)} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs hover:bg-blue-200">
                      واگذاری
                    </button>
                    <button onClick={() => changeStatus(selected.id, 'reject')} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs hover:bg-red-200">
                      رد
                    </button>
                  </>
                )}
                {selected.user_id === user.id && ['pending', 'in_progress'].includes(selected.status) && (
                  <button onClick={() => deleteRequest(selected.id)} className="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg text-xs hover:bg-red-50 hover:text-red-600">
                    حذف
                  </button>
                )}
              </div>

              <div className="border-t pt-4 space-y-3 max-h-64 overflow-y-auto">
                {responses.length > 0 ? responses.map((r, i) => (
                  <div key={i} className={`p-3 rounded-xl text-sm ${
                    (r.user_id || r.actor_id) === selected.user_id ? 'bg-blue-50 mr-8' : 'bg-gray-50 ml-8'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs">{r.user_name || r.actor_name || 'سیستم'}</span>
                      <span className="text-[10px] text-gray-400">{toJalaliDateTime(r.created_at || r.action_date)}</span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{r.comment || r.action || ''}</p>
                  </div>
                )) : (
                  <p className="text-center text-gray-400 text-xs py-4">پاسخی ثبت نشده</p>
                )}
              </div>

              {selected.status !== 'closed' && selected.status !== 'rejected' && (
                <div className="flex gap-2 pt-4 border-t">
                  <input value={responseText} onChange={e => setResponseText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendResponse())}
                    className="flex-1 px-4 py-2 border rounded-xl text-sm" placeholder="پاسخ..." />
                  <button onClick={sendResponse} className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm hover:bg-primary-600">ارسال</button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400">
              <p className="text-4xl mb-4">🎫</p>
              <p>یک تیکت را انتخاب کنید</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
