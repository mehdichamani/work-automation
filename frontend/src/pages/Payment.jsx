import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalali } from '../utils/dateUtils';
import JalaliDatePicker from '../components/JalaliDatePicker';
import { printTable } from '../utils/printUtils';

export default function Payment() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [formData, setFormData] = useState({ amount: '', payment_type: '', description: '', reason: '', recipient_name: '', bank_name: '', card_number: '', payment_date: '' });

  useEffect(() => { loadRequests(); }, [activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const url = activeTab === 'my' ? '/payment/my-requests' : '/payment';
      const res = await api.get(url);
      setRequests(res.data.requests || res.data);
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const submitRequest = async () => {
    setSubmitLoading(true);
    try {
      if (!formData.amount || !formData.payment_type) return toast.error('مبلغ و نوع پرداخت الزامی است');
      await api.post('/payment', formData);
      toast.success('درخواست ثبت شد');
      setShowForm(false);
      setFormData({ amount: '', payment_type: '', description: '', reason: '', recipient_name: '', bank_name: '', card_number: '', payment_date: '' });
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
    finally { setSubmitLoading(false); }
  };

  const approveRequest = async (id) => {
    try { await api.post(`/payment/${id}/approve`, { comment: '' }); toast.success('تایید شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const rejectRequest = async (id) => {
    const comment = prompt('دلیل رد:');
    if (!comment) return;
    try { await api.post(`/payment/${id}/reject`, { comment }); toast.success('رد شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const deleteRequest = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try { await api.delete(`/payment/${id}`); toast.success('حذف شد'); loadRequests(); }
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

  const printAll = () => {
    const columns = ['شماره', 'تاریخ', 'مبلغ', 'نوع', 'دریافت کننده', 'وضعیت'];
    const paymentTypes = { cash: 'نقدی', bank_transfer: 'انتقال بانکی', check: 'چک', card_to_card: 'کارت به کارت' };
    const rows = requests.map(r => [
      r.request_number,
      r.payment_date ? toJalali(r.payment_date) : toJalali(r.created_at),
      parseInt(r.amount).toLocaleString() + ' تومان',
      paymentTypes[r.payment_type] || r.payment_type,
      r.recipient_name,
      r.status === 'pending_supervisor' ? 'در انتظار سرپرست' : r.status === 'pending_manager' ? 'در انتظار مدیر' : r.status === 'approved' ? 'تایید شده' : 'رد شده'
    ]);
    printTable('درخواست وجه', columns, rows);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">درخواست وجه</h1>
          <p className="text-primary-100 text-sm mt-1">مدیریت درخواست‌های پرداخت و وجه</p>
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-6">ثبت درخواست وجه جدید</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">مبلغ (تومان)</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" type="number" placeholder="مبلغ (تومان)" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نوع پرداخت</label>
                <select className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" value={formData.payment_type} onChange={e => setFormData({ ...formData, payment_type: e.target.value })}>
                  <option value="">نوع پرداخت</option>
                  <option value="cash">نقدی</option>
                  <option value="bank_transfer">انتقال بانکی</option>
                  <option value="check">چک</option>
                  <option value="card_to_card">کارت به کارت</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نام دریافت کننده</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="نام دریافت کننده" value={formData.recipient_name} onChange={e => setFormData({ ...formData, recipient_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">نام بانک</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="نام بانک" value={formData.bank_name} onChange={e => setFormData({ ...formData, bank_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاریخ پرداخت</label>
                <JalaliDatePicker value={formData.payment_date} onChange={(v) => setFormData({ ...formData, payment_date: v })} placeholder="تاریخ پرداخت" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">شماره کارت</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="شماره کارت" value={formData.card_number} onChange={e => setFormData({ ...formData, card_number: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">دلیل پرداخت</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="دلیل پرداخت" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">توضیحات</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="توضیحات" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={submitRequest} disabled={submitLoading} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">{submitLoading ? 'در حال ارسال...' : 'ثبت'}</button>
              <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">انصراف</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
            <p className="text-gray-400 text-sm mt-3">در حال بارگذاری...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-300 text-5xl mb-4">📋</div>
            <p className="text-gray-400 text-sm">درخواستی وجود ندارد</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80"><tr>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">شماره</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تاریخ</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">مبلغ</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">نوع</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">دریافت کننده</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">وضعیت</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">عملیات</th>
            </tr></thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{r.request_number}</td>
                  <td className="px-4 py-3 text-xs">{r.payment_date ? toJalali(r.payment_date) : toJalali(r.created_at)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-green-600">{parseInt(r.amount).toLocaleString()} تومان</td>
                  <td className="px-4 py-3 text-xs">{r.payment_type}</td>
                  <td className="px-4 py-3 text-sm">{r.recipient_name}</td>
                  <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {r.status === 'pending_supervisor' && (user.role === 'supervisor' || user.role === 'admin') && (
                        <>
                          <button onClick={() => approveRequest(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500 text-white hover:bg-green-600 transition-all shadow-sm">تایید</button>
                          <button onClick={() => rejectRequest(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-all shadow-sm">رد</button>
                        </>
                      )}
                      {r.status === 'pending_manager' && (user.role === 'manager' || user.role === 'admin') && (
                        <>
                          <button onClick={() => approveRequest(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500 text-white hover:bg-green-600 transition-all shadow-sm">تایید</button>
                          <button onClick={() => rejectRequest(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-all shadow-sm">رد</button>
                        </>
                      )}
                      {r.user_id === user.id && r.status === 'pending_supervisor' && (
                        <button onClick={() => deleteRequest(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all">حذف</button>
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
