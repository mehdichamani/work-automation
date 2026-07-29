import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import JalaliCalendar from '../components/JalaliCalendar';
import { toJalali } from '../utils/dateUtils';

const statusMap = {
  pending_manager: { text: 'در انتظار تایید مدیر', color: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'تایید شده', color: 'bg-green-100 text-green-700' },
  rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
  cancelled: { text: 'لغو شده', color: 'bg-gray-100 text-gray-700' },
};

export default function Conference() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [formData, setFormData] = useState({ meeting_date: '', start_time: '', end_time: '', title: '', description: '', attendees_count: '' });
  const [showDateCal, setShowDateCal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingHistory, setBookingHistory] = useState([]);
  const [rejectComment, setRejectComment] = useState('');

  useEffect(() => { loadBookings(); }, [activeTab]);

  useEffect(() => {
    if (formData.meeting_date) loadAvailableSlots(formData.meeting_date);
  }, [formData.meeting_date]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      let res;
      if (activeTab === 'my') {
        res = await api.get('/conference/my-bookings');
        setBookings(res.data || []);
      } else if (activeTab === 'pending') {
        res = await api.get('/conference/pending-manager');
        setBookings(res.data || []);
      } else {
        res = await api.get('/conference');
        setBookings(res.data.bookings || []);
      }
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const loadAvailableSlots = async (date) => {
    try {
      const res = await api.get(`/conference/available?date=${date}`);
      setAvailableSlots(res.data.available || []);
    } catch (err) { toast.error('خطا'); }
  };

  const submitBooking = async () => {
    setSubmitLoading(true);
    try {
      if (!formData.meeting_date || !formData.start_time || !formData.end_time || !formData.title) {
        return toast.error('فیلدهای الزامی را پر کنید');
      }
      await api.post('/conference', formData);
      toast.success('درخواست رزرو ثبت شد و منتظر تایید مدیر است');
      setShowForm(false);
      setFormData({ meeting_date: '', start_time: '', end_time: '', title: '', description: '', attendees_count: '' });
      loadBookings();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
    finally { setSubmitLoading(false); }
  };

  const approveBooking = async (id) => {
    try {
      await api.post(`/conference/${id}/approve`, { comment: '' });
      toast.success('رزرو تایید شد');
      setSelectedBooking(null);
      loadBookings();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const rejectBooking = async (id) => {
    if (!rejectComment) return toast.error('دلیل رد الزامی است');
    try {
      await api.post(`/conference/${id}/reject`, { comment: rejectComment });
      toast.success('رزرو رد شد');
      setSelectedBooking(null);
      setRejectComment('');
      loadBookings();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const cancelBooking = async (id) => {
    if (!confirm('آیا از لغو رزرو مطمئن هستید؟')) return;
    try {
      await api.post(`/conference/${id}/cancel`);
      toast.success('رزرو لغو شد');
      loadBookings();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const viewBooking = async (id) => {
    try {
      const res = await api.get(`/conference/${id}`);
      setSelectedBooking(res.data.booking);
      setBookingHistory(res.data.history || []);
    } catch (err) { toast.error('خطا در بارگذاری جزئیات'); }
  };

  const timeSlots = [
    { start: '08:00', end: '09:30', label: '۰۸:۰۰ - ۰۹:۳۰' },
    { start: '09:30', end: '11:00', label: '۰۹:۳۰ - ۱۱:۰۰' },
    { start: '11:00', end: '12:30', label: '۱۱:۰۰ - ۱۲:۳۰' },
    { start: '13:30', end: '15:00', label: '۱۳:۳۰ - ۱۵:۰۰' },
    { start: '15:00', end: '16:30', label: '۱۵:۰۰ - ۱۶:۳۰' },
    { start: '16:30', end: '18:00', label: '۱۶:۳۰ - ۱۸:۰۰' },
  ];

  return (
    <div className="animate-fade-in space-y-6" dir="rtl">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">رزرو سالن کنفرانس</h1>
          <p className="text-primary-100 text-sm mt-1">مدیریت رزرو سالن کنفرانس</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-white/20 hover:bg-white/30 backdrop-blur text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
          + رزرو جدید
        </button>
      </div>

      <div className="flex gap-2">
        {[
          { key: 'my', label: 'رزروهای من' },
          { key: 'pending', label: 'در انتظار تایید', role: 'manager' },
          { key: 'all', label: 'همه رزروها' },
        ].filter(t => !t.role || t.role === user.role || user.role === 'admin').map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-primary-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="font-bold text-lg mb-4">رزرو سالن کنفرانس</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="text-sm text-gray-600 mb-1 block">تاریخ جلسه <span className="text-red-500">*</span></label>
                <button type="button" onClick={() => setShowDateCal(!showDateCal)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-left focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" dir="ltr">
                  {formData.meeting_date || 'انتخاب تاریخ'}
                </button>
                {showDateCal && (
                  <div className="absolute mt-1 z-10">
                    <JalaliCalendar
                      selectedDate={formData.meeting_date}
                      onSelect={(d) => { setFormData({...formData, meeting_date: d, start_time: '', end_time: ''}); setShowDateCal(false); }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">عنوان جلسه <span className="text-red-500">*</span></label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="مثال: جلسه هماهنگی" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">ساعت شروع <span className="text-red-500">*</span></label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} dir="ltr">
                  <option value="">انتخاب کنید</option>
                  {timeSlots.map(s => (
                    <option key={s.start} value={s.start} disabled={availableSlots.some(a => a.start === s.start)}>
                      {s.label} {availableSlots.some(a => a.start === s.start) ? '(رزرو شده)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">ساعت پایان <span className="text-red-500">*</span></label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} dir="ltr">
                  <option value="">انتخاب کنید</option>
                  {timeSlots.map(s => (
                    <option key={s.end} value={s.end}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">تعداد شرکت کنندگان</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" type="number" placeholder="مثال: ۱۰" value={formData.attendees_count} onChange={e => setFormData({ ...formData, attendees_count: e.target.value })} />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">توضیحات</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" rows={2} placeholder="توضیحات جلسه..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => { setShowForm(false); setFormData({ meeting_date: '', start_time: '', end_time: '', title: '', description: '', attendees_count: '' }); }} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">انصراف</button>
              <button onClick={submitBooking} disabled={submitLoading} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">{submitLoading ? 'در حال ارسال...' : 'ثبت درخواست'}</button>
            </div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in" dir="rtl">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="font-bold text-lg">جزئیات رزرو - {selectedBooking.title}</h3>
              <button onClick={() => { setSelectedBooking(null); setRejectComment(''); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">شماره:</span> <span className="font-mono font-bold">{selectedBooking.request_number}</span></div>
                <div><span className="text-gray-500">تاریخ:</span> <span className="font-medium">{selectedBooking.meeting_date}</span></div>
                <div><span className="text-gray-500">زمان:</span> <span className="font-medium">{selectedBooking.start_time} - {selectedBooking.end_time}</span></div>
                <div><span className="text-gray-500">تعداد شرکت کنندگان:</span> <span className="font-medium">{selectedBooking.attendees_count || '-'}</span></div>
                <div><span className="text-gray-500">درخواست کننده:</span> <span className="font-medium">{selectedBooking.user_name}</span></div>
                <div><span className="text-gray-500">وضعیت:</span> <span className={`px-2 py-0.5 rounded text-xs ${statusMap[selectedBooking.status]?.color || ''}`}>{statusMap[selectedBooking.status]?.text || selectedBooking.status}</span></div>
              </div>
              {selectedBooking.description && <div><span className="text-gray-500">توضیحات:</span><p className="mt-1 bg-gray-50 p-2 rounded">{selectedBooking.description}</p></div>}
              {selectedBooking.manager_name && <div><span className="text-gray-500">بررسی کننده:</span> <span className="font-medium">{selectedBooking.manager_name}</span></div>}
              {selectedBooking.manager_comment && <div><span className="text-gray-500">نظر مدیر:</span> <span className="font-medium">{selectedBooking.manager_comment}</span></div>}

              {bookingHistory.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-bold text-primary-700 text-sm border-b border-primary-100 pb-1 mb-2">تاریخچه</h4>
                  <div className="space-y-2">
                    {bookingHistory.map((h, i) => (
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

              {selectedBooking.status === 'pending_manager' && (user.role === 'manager' || user.role === 'admin') && (
                <div className="border-t pt-4 mt-4">
                  <label className="text-sm font-medium mb-1 block">نظر (برای رد الزامی است)</label>
                  <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm mb-3" placeholder="دلیل رد..." />
                  <div className="flex gap-2">
                    <button onClick={() => approveBooking(selectedBooking.id)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-bold">تایید</button>
                    <button onClick={() => rejectBooking(selectedBooking.id)} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl text-sm font-bold">رد</button>
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
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-300 text-5xl mb-4">📋</div>
            <p className="text-gray-400 text-sm">رزروی وجود ندارد</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">شماره</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تاریخ</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">زمان</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">عنوان</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">درخواست کننده</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">وضعیت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.map(b => {
                const s = statusMap[b.status] || statusMap.pending_manager;
                return (
                <tr key={b.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{b.request_number}</td>
                  <td className="px-4 py-3 text-xs">{b.meeting_date}</td>
                  <td className="px-4 py-3 text-xs" dir="ltr">{b.start_time} - {b.end_time}</td>
                  <td className="px-4 py-3 text-sm font-medium">{b.title}</td>
                  <td className="px-4 py-3 text-xs">{b.user_name}</td>
                  <td className="px-4 py-3"><span className={`px-3 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.text}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => viewBooking(b.id)} className="bg-primary-50 text-primary-600 hover:bg-primary-100 px-3 py-1 rounded-lg text-xs font-medium transition-all">مشاهده</button>
                      {b.status === 'pending_manager' && (user.role === 'manager' || user.role === 'admin') && (
                        <>
                          <button onClick={() => { setSelectedBooking(b); viewBooking(b.id); }} className="bg-green-50 text-green-600 hover:bg-green-100 px-3 py-1 rounded-lg text-xs font-medium transition-all">تایید</button>
                        </>
                      )}
                      {b.status === 'pending_manager' && b.user_id === user.id && (
                        <button onClick={() => cancelBooking(b.id)} className="bg-red-50 text-red-500 hover:bg-red-100 px-3 py-1 rounded-lg text-xs font-medium transition-all">لغو</button>
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
