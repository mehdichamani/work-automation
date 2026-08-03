import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalali } from '../utils/dateUtils';

const emptyItem = { item_code: '', description: '', purchase_location: 'Urmia', technical_specs: '', requested_quantity: 0, approved_quantity: 0, usage_location: '', price: 0, unit: '' };

const statusMap = {
  pending_supervisor: { text: 'در انتظار سرپرست', color: 'bg-blue-100 text-blue-700' },
  pending_manager: { text: 'در انتظار مدیر', color: 'bg-yellow-100 text-yellow-700' },
  pending_warehouse: { text: 'در انتظار انبار', color: 'bg-orange-100 text-orange-700' },
  pending_factory_manager: { text: 'در انتظار مدیر کارخانه', color: 'bg-purple-100 text-purple-700' },
  pending_budget: { text: 'در انتظار بودجه', color: 'bg-indigo-100 text-indigo-700' },
  approved: { text: 'تایید شده', color: 'bg-green-100 text-green-700' },
  rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
};

function ItemCard({ item, index, readOnly, onUpdate, onRemove, canRemove }) {
  if (readOnly) {
    return (
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2.5 py-1 rounded-lg">{index + 1}</span>
          <span className="text-xs text-gray-400">{item.item_code}</span>
        </div>
        <div>
          <div className="text-sm font-bold text-gray-800">{item.description}</div>
          {item.technical_specs && <div className="text-xs text-gray-500 mt-1">مشخصات فنی: {item.technical_specs}</div>}
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-white p-2 rounded-lg">
            <span className="text-gray-400 block">محل خرید</span>
            <span className="font-medium">{item.purchase_location === 'Tehran' ? 'تهران' : 'ارومیه'}</span>
          </div>
          <div className="bg-white p-2 rounded-lg">
            <span className="text-gray-400 block">قیمت</span>
            <span className="font-medium">{item.price ? Number(item.price).toLocaleString() + ' ریال' : '-'}</span>
          </div>
          <div className="bg-white p-2 rounded-lg">
            <span className="text-gray-400 block">تعداد درخواستی</span>
            <span className="font-medium">{item.requested_quantity} {item.unit || ''}</span>
          </div>
          <div className="bg-white p-2 rounded-lg">
            <span className="text-gray-400 block">تعداد تأیید شده</span>
            <span className="font-medium">{item.approved_quantity || '-'}</span>
          </div>
          <div className="bg-white p-2 rounded-lg col-span-2">
            <span className="text-gray-400 block">محل مصرف</span>
            <span className="font-medium">{item.usage_location || '-'}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
      <div className="flex items-center justify-between">
        <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2.5 py-1 rounded-lg">ردیف {index + 1}</span>
        {canRemove && (
          <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 text-xs font-medium">حذف ردیف</button>
        )}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">شرح کالا *</label>
        <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="شرح کالا" value={item.description} onChange={e => onUpdate(index, 'description', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">کد کالا</label>
          <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500" placeholder="کد" value={item.item_code} onChange={e => onUpdate(index, 'item_code', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">محل خرید</label>
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => onUpdate(index, 'purchase_location', 'Tehran')} className={`flex-1 py-2.5 text-xs font-medium transition-all ${item.purchase_location === 'Tehran' ? 'bg-primary-500 text-white' : 'text-gray-500'}`}>تهران</button>
            <button type="button" onClick={() => onUpdate(index, 'purchase_location', 'Urmia')} className={`flex-1 py-2.5 text-xs font-medium transition-all ${item.purchase_location === 'Urmia' ? 'bg-primary-500 text-white' : 'text-gray-500'}`}>ارومیه</button>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">مشخصات فنی</label>
        <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500" placeholder="مدل، ابعاد، جنس و..." value={item.technical_specs} onChange={e => onUpdate(index, 'technical_specs', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">تعداد درخواستی</label>
          <input type="number" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500" value={item.requested_quantity || ''} onChange={e => onUpdate(index, 'requested_quantity', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">واحد *</label>
          <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500" placeholder="مثلا: عدد، لیتر، کیلوگرم" value={item.unit || ''} onChange={e => onUpdate(index, 'unit', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">محل مصرف</label>
        <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500" placeholder="محل مصرف" value={item.usage_location} onChange={e => onUpdate(index, 'usage_location', e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">قیمت (ریال)</label>
        <input type="number" min="0" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500" placeholder="قیمت" value={item.price || ''} onChange={e => onUpdate(index, 'price', Number(e.target.value))} />
      </div>
    </div>
  );
}

export default function Purchase() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [detail, setDetail] = useState(null);
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [formData, setFormData] = useState({ department: user.department_name || '', urgency: 'normal', reason: '' });

  useEffect(() => { loadRequests(); }, [activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const url = activeTab === 'my' ? '/purchase/my-requests' : '/purchase';
      const res = await api.get(url);
      setRequests(res.data.requests || res.data);
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const loadDetail = async (id) => {
    try {
      const res = await api.get(`/purchase/${id}`);
      setDetail(res.data.request);
    } catch (err) { toast.error('خطا در بارگذاری جزئیات'); }
  };

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    const newItems = [...items];
    newItems[i][field] = value;
    setItems(newItems);
  };

  const submitRequest = async () => {
    setSubmitLoading(true);
    try {
      const validItems = items.filter(it => it.description.trim());
      if (validItems.length === 0) return toast.error('حداقل یک کالا وارد کنید');
      await api.post('/purchase', { items: validItems, ...formData });
      toast.success('درخواست ثبت شد');
      setShowForm(false);
      setItems([{ ...emptyItem }]);
      setFormData({ department: user.department_name || '', urgency: 'normal', reason: '' });
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
    finally { setSubmitLoading(false); }
  };

  const approveRequest = async (id) => {
    try {
      await api.post(`/purchase/${id}/approve`, { comment: '' });
      toast.success('تایید شد');
      loadRequests();
      if (detail && detail.id === id) loadDetail(id);
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const rejectRequest = async (id) => {
    const comment = prompt('دلیل رد:');
    if (!comment) return;
    try {
      await api.post(`/purchase/${id}/reject`, { comment });
      toast.success('رد شد');
      loadRequests();
      if (detail && detail.id === id) loadDetail(id);
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const deleteRequest = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try {
      await api.delete(`/purchase/${id}`);
      toast.success('حذف شد');
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const canApprove = (r) => {
    if (r.status === 'pending_supervisor' && (user.role === 'supervisor' || user.role === 'admin')) return true;
    if (r.status === 'pending_manager' && (user.role === 'manager' || user.role === 'admin')) return true;
    if (r.status === 'pending_warehouse' && user.role === 'admin') return true;
    if (r.status === 'pending_factory_manager' && (user.role === 'manager' || user.role === 'admin')) return true;
    if (r.status === 'pending_budget' && user.role === 'admin') return true;
    return false;
  };

  return (
    <div className="animate-fade-in space-y-4 sm:space-y-6">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">درخواست خرید کالا</h1>
            <p className="text-primary-100 text-xs sm:text-sm mt-1">مدیریت درخواست‌های خرید تجهیزات و کالا</p>
          </div>
          <button onClick={() => setShowForm(true)} className="bg-white/20 hover:bg-white/30 backdrop-blur text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all self-start sm:self-auto">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center p-2 sm:p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-2 sm:my-4">
              <div className="sticky top-0 bg-white rounded-t-2xl border-b px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                <h3 className="text-base sm:text-lg font-bold">ثبت درخواست خرید جدید</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>

              <div className="px-4 sm:px-6 py-4 space-y-4">
                <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-600">
                  لطفا اقلام مشروحه زیر را جهت مصرف در قسمت تعیین شده، برای واحد <span className="font-bold text-primary-600">{formData.department || '...'}</span> خریداری نمایید.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">واحد متقاضی</label>
                    <input className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-100 text-gray-600 cursor-not-allowed" value={formData.department} readOnly />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">فوریت</label>
                    <select className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500" value={formData.urgency} onChange={e => setFormData({ ...formData, urgency: e.target.value })}>
                      <option value="normal">عادی</option>
                      <option value="urgent">فوری</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">اقلام درخواستی</span>
                    <button onClick={addItem} className="text-primary-500 text-xs font-medium hover:text-primary-600">+ افزودن ردیف</button>
                  </div>
                  {items.map((item, i) => (
                    <ItemCard key={i} item={item} index={i} readOnly={false} onUpdate={updateItem} onRemove={removeItem} canRemove={items.length > 1} />
                  ))}
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">دلیل خرید</label>
                  <textarea className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500" rows="2" placeholder="دلیل خرید" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                </div>
              </div>

              <div className="sticky bottom-0 bg-white rounded-b-2xl border-t px-4 sm:px-6 py-4 flex gap-3">
                <button onClick={submitRequest} disabled={submitLoading} className="flex-1 bg-primary-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">
                  {submitLoading ? 'در حال ارسال...' : 'ثبت درخواست'}
                </button>
                <button onClick={() => setShowForm(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-full flex items-start justify-center p-2 sm:p-4">
            <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl my-2 sm:my-4">
              <div className="sticky top-0 bg-white rounded-t-2xl border-b px-4 sm:px-6 py-4 flex items-center justify-between z-10">
                <h3 className="text-base sm:text-lg font-bold truncate">درخواست {detail.request_number}</h3>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
              </div>

              <div className="px-4 sm:px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-400 text-xs block">شماره</span>
                    <span className="font-bold font-mono">{detail.request_number}</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-400 text-xs block">تاریخ</span>
                    <span>{toJalali(detail.created_at)}</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-400 text-xs block">واحد</span>
                    <span className="font-bold">{detail.department || detail.department_name || '-'}</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-400 text-xs block">درخواست‌دهنده</span>
                    <span>{detail.user_name}</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-400 text-xs block">وضعیت</span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${(statusMap[detail.status] || statusMap.pending_supervisor).color}`}>
                      {(statusMap[detail.status] || statusMap.pending_supervisor).text}
                    </span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-400 text-xs block">فوریت</span>
                    <span className={detail.urgency === 'urgent' ? 'text-red-500 font-bold' : ''}>{detail.urgency === 'urgent' ? 'فوری' : 'عادی'}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">اقلام درخواستی</h4>
                  <div className="space-y-3">
                    {(detail.items || []).map((item, i) => (
                      <ItemCard key={i} item={item} index={i} readOnly={true} />
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">گردش کار و امضاها</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-gray-400 text-xs mb-1">درخواست‌کننده</div>
                      <div className="font-bold text-sm">{detail.user_name}</div>
                      <div className="text-xs text-gray-400 mt-1">{toJalali(detail.created_at)}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-gray-400 text-xs mb-1">تایید انبار</div>
                      <div className="font-bold text-sm">{detail.warehouse_name || <span className="text-gray-300">در انتظار</span>}</div>
                      {detail.warehouse_date && <div className="text-xs text-gray-400 mt-1">{toJalali(detail.warehouse_date)}</div>}
                      {detail.warehouse_comment && <div className="text-xs text-gray-500 mt-1 truncate">{detail.warehouse_comment}</div>}
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-gray-400 text-xs mb-1">تایید مدیر کارخانه</div>
                      <div className="font-bold text-sm">{detail.factory_manager_name || <span className="text-gray-300">در انتظار</span>}</div>
                      {detail.factory_manager_date && <div className="text-xs text-gray-400 mt-1">{toJalali(detail.factory_manager_date)}</div>}
                      {detail.factory_manager_comment && <div className="text-xs text-gray-500 mt-1 truncate">{detail.factory_manager_comment}</div>}
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl">
                      <div className="text-gray-400 text-xs mb-1">تایید واحد بودجه</div>
                      <div className="font-bold text-sm">{detail.budget_name || <span className="text-gray-300">در انتظار</span>}</div>
                      {detail.budget_date && <div className="text-xs text-gray-400 mt-1">{toJalali(detail.budget_date)}</div>}
                      {detail.budget_comment && <div className="text-xs text-gray-500 mt-1 truncate">{detail.budget_comment}</div>}
                    </div>
                  </div>
                </div>
              </div>

              {canApprove(detail) && (
                <div className="sticky bottom-0 bg-white rounded-b-2xl border-t px-4 sm:px-6 py-4 flex gap-3">
                  <button onClick={() => { approveRequest(detail.id); setDetail(null); }} className="flex-1 bg-green-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-green-600 transition-all shadow-sm">تایید</button>
                  <button onClick={() => { rejectRequest(detail.id); setDetail(null); }} className="flex-1 bg-red-500 text-white py-3 rounded-xl text-sm font-medium hover:bg-red-600 transition-all shadow-sm">رد</button>
                </div>
              )}
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
          <div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80"><tr>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase">شماره</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase">تاریخ</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase">واحد</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase">اقلام</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase">وضعیت</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase">عملیات</th>
                </tr></thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{r.request_number}</td>
                      <td className="px-4 py-3 text-xs">{toJalali(r.created_at)}</td>
                      <td className="px-4 py-3 text-xs">{r.department || r.department_name || '-'}</td>
                      <td className="px-4 py-3 text-xs">
                        <button onClick={() => loadDetail(r.id)} className="text-primary-500 hover:text-primary-700 underline">مشاهده</button>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${(statusMap[r.status] || statusMap.pending_supervisor).color}`}>
                          {(statusMap[r.status] || statusMap.pending_supervisor).text}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => loadDetail(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all">جزئیات</button>
                          {canApprove(r) && (
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
            </div>

            <div className="sm:hidden divide-y divide-gray-100">
              {requests.map(r => (
                <div key={r.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-500">{r.request_number}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${(statusMap[r.status] || statusMap.pending_supervisor).color}`}>
                      {(statusMap[r.status] || statusMap.pending_supervisor).text}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">{toJalali(r.created_at)}</div>
                  <div className="text-sm font-medium">{r.department || r.department_name || '-'}</div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => loadDetail(r.id)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">جزئیات</button>
                    {canApprove(r) && (
                      <>
                        <button onClick={() => approveRequest(r.id)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-green-500 text-white hover:bg-green-600 transition-all">تایید</button>
                        <button onClick={() => rejectRequest(r.id)} className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-all">رد</button>
                      </>
                    )}
                    {r.user_id === user.id && r.status === 'pending_supervisor' && (
                      <button onClick={() => deleteRequest(r.id)} className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 hover:text-red-600 transition-all">حذف</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
