import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import JalaliCalendar from '../components/JalaliCalendar';
import { toJalali } from '../utils/dateUtils';

const statusMap = {
  pending_supervisor: { text: 'در انتظار سرپرست', color: 'bg-blue-100 text-blue-700' },
  pending_manager: { text: 'در انتظار مدیر', color: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'تایید شده', color: 'bg-green-100 text-green-700' },
  rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
};

export default function Mission() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [formData, setFormData] = useState({ mission_date: '', start_time: '', end_time: '', destination: '', mission_type: 'internal', description: '', reason: '' });
  const [showDateCal, setShowDateCal] = useState(false);

  useEffect(() => { loadRequests(); }, [activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const url = activeTab === 'my' ? '/mission/my-requests' : '/mission';
      const res = await api.get(url);
      setRequests(res.data.requests || res.data);
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const submitRequest = async () => {
    setSubmitLoading(true);
    try {
      if (!formData.mission_date || !formData.destination) return toast.error('تاریخ و مقصد الزامی است');
      await api.post('/mission', formData);
      toast.success('درخواست ثبت شد');
      setShowForm(false);
      setFormData({ mission_date: '', start_time: '', end_time: '', destination: '', mission_type: 'internal', description: '', reason: '' });
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
    finally { setSubmitLoading(false); }
  };

  const approveRequest = async (id) => {
    try { await api.post(`/mission/${id}/approve`, { comment: '' }); toast.success('تایید شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const rejectRequest = async (id) => {
    const comment = prompt('دلیل رد:');
    if (!comment) return;
    try { await api.post(`/mission/${id}/reject`, { comment }); toast.success('رد شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const deleteRequest = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try { await api.delete(`/mission/${id}`); toast.success('حذف شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  return (
    <div className="animate-fade-in space-y-6" dir="rtl">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">درخواست ماموریت</h1>
          <p className="text-primary-100 text-sm mt-1">مدیریت درخواست‌های ماموریت کاری</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-white/20 hover:bg-white/30 backdrop-blur text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
          + درخواست جدید
        </button>
      </div>

      <div className="flex gap-2">
        {['my', 'all'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-primary-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {tab === 'my' ? 'درخواست‌های من' : 'همه درخواست‌ها'}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">ثبت درخواست ماموریت جدید</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاریخ ماموریت <span className="text-red-500">*</span></label>
                <button type="button" onClick={() => setShowDateCal(!showDateCal)} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-left focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" dir="ltr">
                  {formData.mission_date || 'انتخاب تاریخ'}
                </button>
                {showDateCal && (
                  <div className="absolute mt-1 z-10">
                    <JalaliCalendar
                      selectedDate={formData.mission_date}
                      onSelect={(d) => { setFormData({...formData, mission_date: d}); setShowDateCal(false); }}
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">مقصد <span className="text-red-500">*</span></label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="مثال: ارومیه" value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ساعت شروع</label>
                <select value={formData.start_time} onChange={(e) => setFormData({...formData, start_time: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" dir="ltr">
                  <option value="">انتخاب ساعت</option>
                  <option value="08:00">08:00</option>
                  <option value="08:30">08:30</option>
                  <option value="09:00">09:00</option>
                  <option value="09:30">09:30</option>
                  <option value="10:00">10:00</option>
                  <option value="10:30">10:30</option>
                  <option value="11:00">11:00</option>
                  <option value="11:30">11:30</option>
                  <option value="12:00">12:00</option>
                  <option value="12:30">12:30</option>
                  <option value="13:00">13:00</option>
                  <option value="13:30">13:30</option>
                  <option value="14:00">14:00</option>
                  <option value="14:30">14:30</option>
                  <option value="15:00">15:00</option>
                  <option value="15:30">15:30</option>
                  <option value="16:00">16:00</option>
                  <option value="16:30">16:30</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ساعت پایان</label>
                <select value={formData.end_time} onChange={(e) => setFormData({...formData, end_time: e.target.value})} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" dir="ltr">
                  <option value="">انتخاب ساعت</option>
                  <option value="08:00">08:00</option>
                  <option value="08:30">08:30</option>
                  <option value="09:00">09:00</option>
                  <option value="09:30">09:30</option>
                  <option value="10:00">10:00</option>
                  <option value="10:30">10:30</option>
                  <option value="11:00">11:00</option>
                  <option value="11:30">11:30</option>
                  <option value="12:00">12:00</option>
                  <option value="12:30">12:30</option>
                  <option value="13:00">13:00</option>
                  <option value="13:30">13:30</option>
                  <option value="14:00">14:00</option>
                  <option value="14:30">14:30</option>
                  <option value="15:00">15:00</option>
                  <option value="15:30">15:30</option>
                  <option value="16:00">16:00</option>
                  <option value="16:30">16:30</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع ماموریت</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" value={formData.mission_type} onChange={e => setFormData({ ...formData, mission_type: e.target.value })}>
                  <option value="internal">داخل مجتمع</option>
                  <option value="external">خارج از مجتمع</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">دلیل ماموریت</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="مثال: جلسه هماهنگی" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">توضیحات</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" rows={3} placeholder="توضیحات تکمیلی..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => { setShowForm(false); setFormData({ mission_date: '', start_time: '', end_time: '', destination: '', mission_type: 'internal', description: '', reason: '' }); }} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">انصراف</button>
              <button onClick={submitRequest} disabled={submitLoading} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">{submitLoading ? 'در حال ارسال...' : 'ثبت درخواست'}</button>
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
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-300 text-5xl mb-4">📋</div>
            <p className="text-gray-400">درخواستی وجود ندارد</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">شماره</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تاریخ</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">ساعت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">مقصد</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">نوع</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">دلیل</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">وضعیت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const s = statusMap[r.status] || statusMap.pending_supervisor;
                return (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-xs">{r.request_number}</td>
                  <td className="px-4 py-3.5 text-xs">{r.mission_date}</td>
                  <td className="px-4 py-3.5 text-xs" dir="ltr">{r.start_time && r.end_time ? `${r.start_time} - ${r.end_time}` : '-'}</td>
                  <td className="px-4 py-3.5 text-sm">{r.destination}</td>
                  <td className="px-4 py-3.5 text-xs">{r.mission_type === 'internal' ? 'داخل مجتمع' : 'خارج از مجتمع'}</td>
                  <td className="px-4 py-3.5 text-xs">{r.reason || '-'}</td>
                  <td className="px-4 py-3.5"><span className={`px-3 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.text}</span></td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1">
                      {r.status === 'pending_supervisor' && (user.role === 'supervisor' || user.role === 'admin') && (
                        <>
                          <button onClick={() => approveRequest(r.id)} className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100 transition-all">تایید</button>
                          <button onClick={() => rejectRequest(r.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100 transition-all">رد</button>
                        </>
                      )}
                      {r.status === 'pending_manager' && (user.role === 'manager' || user.role === 'admin') && (
                        <>
                          <button onClick={() => approveRequest(r.id)} className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-100 transition-all">تایید</button>
                          <button onClick={() => rejectRequest(r.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100 transition-all">رد</button>
                        </>
                      )}
                      {r.user_id === user.id && r.status === 'pending_supervisor' && (
                        <button onClick={() => deleteRequest(r.id)} className="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100 transition-all">حذف</button>
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
