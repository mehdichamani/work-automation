import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalaliDateTime, toJalali } from '../utils/dateUtils';
import JalaliDatePicker from '../components/JalaliDatePicker';

export default function ProjectSupply() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [items, setItems] = useState([{ name: '', quantity: 1, unit: 'عدد', specification: '' }]);
  const [formData, setFormData] = useState({ project_name: '', urgency: 'normal', description: '', estimated_cost: '', deadline: '' });

  useEffect(() => { loadRequests(); }, [activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const url = activeTab === 'my' ? '/project-supply/my-requests' : '/project-supply';
      const res = await api.get(url);
      setRequests(res.data.requests || res.data);
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const addItem = () => setItems([...items, { name: '', quantity: 1, unit: 'عدد', specification: '' }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    const newItems = [...items];
    newItems[i][field] = value;
    setItems(newItems);
  };

  const submitRequest = async () => {
    setSubmitLoading(true);
    try {
      const validItems = items.filter(it => it.name.trim());
      if (!formData.project_name) return toast.error('نام پروژه الزامی است');
      if (validItems.length === 0) return toast.error('حداقل یک کالا وارد کنید');
      await api.post('/project-supply', { items: validItems, ...formData });
      toast.success('درخواست ثبت شد');
      setShowForm(false);
      setItems([{ name: '', quantity: 1, unit: 'عدد', specification: '' }]);
      setFormData({ project_name: '', urgency: 'normal', description: '', estimated_cost: '', deadline: '' });
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
    finally { setSubmitLoading(false); }
  };

  const approveRequest = async (id) => {
    try { await api.post(`/project-supply/${id}/approve`, { comment: '' }); toast.success('تایید شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const rejectRequest = async (id) => {
    const comment = prompt('دلیل رد:');
    if (!comment) return;
    try { await api.post(`/project-supply/${id}/reject`, { comment }); toast.success('رد شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const deleteRequest = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try { await api.delete(`/project-supply/${id}`); toast.success('حذف شد'); loadRequests(); }
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
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${s2.bg} ${s2.text}`}>{s2.label}</span>;
  };

  const parsedItems = (itemsJson) => {
    try { return JSON.parse(itemsJson); } catch { return []; }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">تامین کالای پروژه</h1>
          <p className="text-primary-100 text-sm mt-1">مدیریت درخواست‌های تامین کالای پروژه</p>
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
            <h3 className="font-bold text-lg mb-4">ثبت درخواست تامین کالای پروژه</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">نام پروژه</label>
                  <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="نام پروژه" value={formData.project_name} onChange={e => setFormData({ ...formData, project_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">فوریت</label>
                  <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" value={formData.urgency} onChange={e => setFormData({ ...formData, urgency: e.target.value })}>
                    <option value="normal">عادی</option>
                    <option value="urgent">فوری</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">هزینه تقریبی</label>
                  <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="هزینه تقریبی" value={formData.estimated_cost} onChange={e => setFormData({ ...formData, estimated_cost: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">مهلت تامین</label>
                  <JalaliDatePicker value={formData.deadline} onChange={(v) => setFormData({ ...formData, deadline: v })} placeholder="مهلت تامین" />
                </div>
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">نام کالا</label>
                    <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="نام کالا" value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">تعداد</label>
                    <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" type="number" placeholder="تعداد" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">واحد</label>
                    <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="واحد" value={item.unit} onChange={e => updateItem(i, 'unit', e.target.value)} />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">مشخصات فنی</label>
                    <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="مشخصات فنی" value={item.specification} onChange={e => updateItem(i, 'specification', e.target.value)} />
                  </div>
                  {items.length > 1 && <button onClick={() => removeItem(i)} className="col-span-1 text-red-500 text-sm hover:text-red-700 transition-colors">✕</button>}
                </div>
              ))}
              <button onClick={addItem} className="text-primary-500 text-sm hover:text-primary-700 transition-colors font-medium">+ افزودن کالا</button>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">توضیحات</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="توضیحات" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">انصراف</button>
                <button onClick={submitRequest} disabled={submitLoading} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">{submitLoading ? 'در حال ارسال...' : 'ثبت'}</button>
              </div>
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
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80">
              <tr>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">شماره</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">پروژه</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">اقلام</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تاریخ</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">مهلت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">فوریت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">وضعیت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-xs">{r.request_number}</td>
                  <td className="px-4 py-3.5 text-sm font-medium">{r.project_name}</td>
                  <td className="px-4 py-3.5">
                    <div className="space-y-1">
                      {parsedItems(r.items).map((it, i) => (
                        <div key={i} className="text-xs">{it.name} - {it.quantity} {it.unit}</div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs">{toJalaliDateTime(r.created_at)}</td>
                  <td className="px-4 py-3.5 text-xs">{r.deadline ? toJalali(r.deadline) : '-'}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${r.urgency === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {r.urgency === 'urgent' ? 'فوری' : 'عادی'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex gap-1">
                      {r.status === 'pending_supervisor' && (user.role === 'supervisor' || user.role === 'admin') && (
                        <>
                          <button onClick={() => approveRequest(r.id)} className="bg-green-50 text-green-600 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-green-100 transition-all">تایید</button>
                          <button onClick={() => rejectRequest(r.id)} className="bg-red-50 text-red-600 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-red-100 transition-all">رد</button>
                        </>
                      )}
                      {r.status === 'pending_manager' && (user.role === 'manager' || user.role === 'admin') && (
                        <>
                          <button onClick={() => approveRequest(r.id)} className="bg-green-50 text-green-600 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-green-100 transition-all">تایید</button>
                          <button onClick={() => rejectRequest(r.id)} className="bg-red-50 text-red-600 px-3 py-2.5 rounded-lg text-xs font-medium hover:bg-red-100 transition-all">رد</button>
                        </>
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
          </div>
        )}
      </div>
    </div>
  );
}
