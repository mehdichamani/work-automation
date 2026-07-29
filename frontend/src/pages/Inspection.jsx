import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalaliDateTime, toJalali } from '../utils/dateUtils';
import JalaliDatePicker from '../components/JalaliDatePicker';
import { printTable } from '../utils/printUtils';

export default function Inspection() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [formData, setFormData] = useState({ title: '', description: '', equipment_name: '', location: '', inspection_type: '', urgency: 'normal', deadline: '' });

  useEffect(() => { loadRequests(); }, [activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const url = activeTab === 'my' ? '/inspection/my-requests' : '/inspection';
      const res = await api.get(url);
      setRequests(res.data.requests || res.data);
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const submitRequest = async () => {
    setSubmitLoading(true);
    try {
      if (!formData.title || !formData.inspection_type) return toast.error('عنوان و نوع بازرسی الزامی است');
      await api.post('/inspection', formData);
      toast.success('درخواست ثبت شد');
      setShowForm(false);
      setFormData({ title: '', description: '', equipment_name: '', location: '', inspection_type: '', urgency: 'normal', deadline: '' });
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
    finally { setSubmitLoading(false); }
  };

  const approveRequest = async (id) => {
    try { await api.post(`/inspection/${id}/approve`, { comment: '' }); toast.success('تایید شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const inspectRequest = async (id) => {
    const result = prompt('نتیجه بازرسی (خوب/بد/نیاز به تعمیر):');
    if (!result) return;
    const desc = prompt('توضیحات بازرسی:');
    try { await api.post(`/inspection/${id}/inspect`, { result, description: desc }); toast.success('بازرسی ثبت شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const rejectRequest = async (id) => {
    const comment = prompt('دلیل رد:');
    if (!comment) return;
    try { await api.post(`/inspection/${id}/reject`, { comment }); toast.success('رد شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const deleteRequest = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try { await api.delete(`/inspection/${id}`); toast.success('حذف شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const statusBadge = (s) => {
    const map = {
      pending_supervisor: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'در انتظار سرپرست' },
      pending_manager: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'در انتظار مدیر' },
      in_progress: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'در حال بازرسی' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'تکمیل شده' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'رد شده' },
    };
    const s2 = map[s] || map.pending_supervisor;
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${s2.bg} ${s2.text}`}>{s2.label}</span>;
  };

  const typeLabels = {
    periodic: 'دوره‌ای', requested: 'درخواستی', emergency: 'فوری', quality: 'کیفی'
  };

  const printAll = () => {
    const columns = ['شماره', 'عنوان', 'نوع', 'تجهیز', 'مهلت', 'وضعیت'];
    const rows = requests.map(r => [
      r.request_number, r.title,
      typeLabels[r.inspection_type] || r.inspection_type,
      r.equipment_name || '-',
      r.deadline ? toJalali(r.deadline) : '-',
      r.status === 'pending_supervisor' ? 'در انتظار سرپرست' : r.status === 'pending_manager' ? 'در انتظار مدیر' : r.status === 'in_progress' ? 'در حال بازرسی' : r.status === 'completed' ? 'تکمیل شده' : 'رد شده'
    ]);
    printTable('درخواست بازرسی فنی', columns, rows);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">درخواست بازرسی فنی</h1>
          <p className="text-primary-100 text-sm mt-1">مدیریت درخواست‌های بازرسی فنی تجهیزات</p>
        </div>
        <div className="flex gap-2">
          <button onClick={printAll} className="bg-white/20 hover:bg-white/30 backdrop-blur text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all">🖨️ چاپ</button>
          <button onClick={() => setShowForm(true)} className="bg-white/20 hover:bg-white/30 backdrop-blur text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
            + درخواست جدید
          </button>
        </div>
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
            <h3 className="font-bold text-lg mb-4">ثبت درخواست بازرسی فنی</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">عنوان درخواست</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="عنوان درخواست" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع بازرسی</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" value={formData.inspection_type} onChange={e => setFormData({ ...formData, inspection_type: e.target.value })}>
                  <option value="">نوع بازرسی</option>
                  <option value="periodic">دوره‌ای</option>
                  <option value="requested">درخواستی</option>
                  <option value="emergency">فوری</option>
                  <option value="quality">کیفی</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نام تجهیز</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="نام تجهیز" value={formData.equipment_name} onChange={e => setFormData({ ...formData, equipment_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">محل تجهیز</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="محل تجهیز" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">فوریت</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" value={formData.urgency} onChange={e => setFormData({ ...formData, urgency: e.target.value })}>
                  <option value="normal">عادی</option>
                  <option value="urgent">فوری</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">مهلت بازرسی</label>
                <JalaliDatePicker value={formData.deadline} onChange={(v) => setFormData({ ...formData, deadline: v })} placeholder="مهلت بازرسی" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">توضیحات</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="توضیحات" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">انصراف</button>
              <button onClick={submitRequest} disabled={submitLoading} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">{submitLoading ? 'در حال ارسال...' : 'ثبت'}</button>
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
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">عنوان</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">نوع</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تجهیز</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تاریخ</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">مهلت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">وضعیت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-xs">{r.request_number}</td>
                  <td className="px-4 py-3.5 text-sm font-medium">{r.title}</td>
                  <td className="px-4 py-3.5 text-xs">{typeLabels[r.inspection_type] || r.inspection_type}</td>
                  <td className="px-4 py-3.5 text-xs">{r.equipment_name || '-'}</td>
                  <td className="px-4 py-3.5 text-xs">{toJalaliDateTime(r.created_at)}</td>
                  <td className="px-4 py-3.5 text-xs">{r.deadline ? toJalali(r.deadline) : '-'}</td>
                  <td className="px-4 py-3.5">{statusBadge(r.status)}</td>
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
                      {r.status === 'in_progress' && (user.role === 'admin' || user.department_name?.includes('فنی')) && (
                        <button onClick={() => inspectRequest(r.id)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100 transition-all">ثبت بازرسی</button>
                      )}
                      {r.user_id === user.id && r.status === 'pending_supervisor' && (
                        <button onClick={() => deleteRequest(r.id)} className="bg-red-50 text-red-500 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100 transition-all">حذف</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
