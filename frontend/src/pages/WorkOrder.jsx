import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalali } from '../utils/dateUtils';
import JalaliDatePicker from '../components/JalaliDatePicker';

export default function WorkOrder() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [formData, setFormData] = useState({ title: '', description: '', work_type: '', priority: 'normal', estimated_cost: '', deadline: '' });

  useEffect(() => { loadRequests(); }, [activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const url = activeTab === 'my' ? '/work-order/my-requests' : '/work-order';
      const res = await api.get(url);
      setRequests(res.data.requests || res.data);
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const submitRequest = async () => {
    try {
      if (!formData.title) return toast.error('عنوان کار الزامی است');
      await api.post('/work-order', formData);
      toast.success('درخواست ثبت شد');
      setShowForm(false);
      setFormData({ title: '', description: '', work_type: '', priority: 'normal', estimated_cost: '', deadline: '' });
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const approveRequest = async (id) => {
    try { await api.post(`/work-order/${id}/approve`, { comment: '' }); toast.success('تایید شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const rejectRequest = async (id) => {
    const comment = prompt('دلیل رد:');
    if (!comment) return;
    try { await api.post(`/work-order/${id}/reject`, { comment }); toast.success('رد شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const deleteRequest = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try { await api.delete(`/work-order/${id}`); toast.success('حذف شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const statusBadge = (s) => {
    const map = {
      pending_supervisor: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'در انتظار سرپرست' },
      pending_manager: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'در انتظار مدیر' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'تایید شده' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'رد شده' },
    };
    const s2 = map[s] || map.pending_supervisor;
    return <span className={`px-2 py-0.5 rounded text-xs ${s2.bg} ${s2.text}`}>{s2.label}</span>;
  };

  const priorityBadge = (p) => {
    const map = { high: 'بالا', normal: 'متوسط', low: 'پایین' };
    const colorMap = { high: 'text-red-500', normal: 'text-yellow-500', low: 'text-green-500' };
    return <span className={`text-xs ${colorMap[p] || ''}`}>{map[p] || p}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">درخواست کار داخلی</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary-500 text-white px-4 py-2 min-h-[44px] rounded-lg hover:bg-primary-600">
          + درخواست جدید
        </button>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {['my', 'all'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 min-h-[44px] rounded-t-lg text-sm ${activeTab === tab ? 'bg-primary-500 text-white' : 'bg-gray-100'}`}>
            {tab === 'my' ? 'درخواست‌های من' : 'همه درخواست‌ها'}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="font-bold mb-4">ثبت درخواست کار جدید</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input className="w-full border rounded-lg p-2 text-sm" placeholder="عنوان کار" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
            <input className="w-full border rounded-lg p-2 text-sm" placeholder="نوع کار" value={formData.work_type} onChange={e => setFormData({ ...formData, work_type: e.target.value })} />
            <textarea className="col-span-2 w-full border rounded-lg p-2 text-sm" placeholder="توضیحات" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            <select className="w-full border rounded-lg p-2 text-sm" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
              <option value="low">اولویت پایین</option>
              <option value="normal">اولویت متوسط</option>
              <option value="high">اولویت بالا</option>
            </select>
            <input className="w-full border rounded-lg p-2 text-sm" placeholder="هزینه تقریبی" value={formData.estimated_cost} onChange={e => setFormData({ ...formData, estimated_cost: e.target.value })} />
            <JalaliDatePicker value={formData.deadline} onChange={(v) => setFormData({ ...formData, deadline: v })} placeholder="مهلت اجرا" />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={submitRequest} className="bg-green-500 text-white px-4 py-2 min-h-[44px] rounded-lg text-sm">ثبت</button>
            <button onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 min-h-[44px] rounded-lg text-sm">انصراف</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? <div className="p-8 text-center">در حال بارگذاری...</div> : requests.length === 0 ? (
          <div className="p-8 text-center text-gray-400">درخواستی وجود ندارد</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="p-3 text-right">شماره</th>
                <th className="p-3 text-right">عنوان</th>
                <th className="p-3 text-right">نوع</th>
                <th className="p-3 text-right">اولویت</th>
                <th className="p-3 text-right">مهلت</th>
                <th className="p-3 text-right">وضعیت</th>
                <th className="p-3 text-right">عملیات</th>
              </tr></thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-mono text-xs">{r.request_number}</td>
                    <td className="p-3 text-sm font-medium">{r.title}</td>
                    <td className="p-3 text-xs">{r.work_type}</td>
                    <td className="p-3">{priorityBadge(r.priority)}</td>
                    <td className="p-3 text-xs">{r.deadline ? toJalali(r.deadline) : '-'}</td>
                    <td className="p-3">{statusBadge(r.status)}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {r.status === 'pending_supervisor' && (user.role === 'supervisor' || user.role === 'admin') && (
                          <>
                            <button onClick={() => approveRequest(r.id)} className="text-green-600 text-xs hover:underline px-3 py-2 min-h-[44px]">تایید</button>
                            <button onClick={() => rejectRequest(r.id)} className="text-red-600 text-xs hover:underline px-3 py-2 min-h-[44px]">رد</button>
                          </>
                        )}
                        {r.status === 'pending_manager' && (user.role === 'manager' || user.role === 'admin') && (
                          <>
                            <button onClick={() => approveRequest(r.id)} className="text-green-600 text-xs hover:underline px-3 py-2 min-h-[44px]">تایید</button>
                            <button onClick={() => rejectRequest(r.id)} className="text-red-600 text-xs hover:underline px-3 py-2 min-h-[44px]">رد</button>
                          </>
                        )}
                        {r.user_id === user.id && r.status === 'pending_supervisor' && (
                          <button onClick={() => deleteRequest(r.id)} className="text-red-400 text-xs hover:underline px-3 py-2 min-h-[44px]">حذف</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
