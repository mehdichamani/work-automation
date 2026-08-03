import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalali } from '../utils/dateUtils';

const emptyItem = { item_code: '', description: '', purchase_location: 'Urmia', technical_specs: '', requested_quantity: 0, approved_quantity: 0, usage_location: '', price: 0 };

const statusMap = {
  pending_supervisor: { text: 'در انتظار سرپرست', color: 'bg-blue-100 text-blue-700' },
  pending_manager: { text: 'در انتظار مدیر', color: 'bg-yellow-100 text-yellow-700' },
  pending_warehouse: { text: 'در انتظار انبار', color: 'bg-orange-100 text-orange-700' },
  pending_factory_manager: { text: 'در انتظار مدیر کارخانه', color: 'bg-purple-100 text-purple-700' },
  pending_budget: { text: 'در انتظار بودجه', color: 'bg-indigo-100 text-indigo-700' },
  approved: { text: 'تایید شده', color: 'bg-green-100 text-green-700' },
  rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
};

export default function Purchase() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [detail, setDetail] = useState(null);
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [formData, setFormData] = useState({ department: '', urgency: 'normal', reason: '' });

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
      setFormData({ department: '', urgency: 'normal', reason: '' });
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

  const renderItemsTable = (itemsList, readOnly = false, onUpdate = null) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border border-gray-300 px-2 py-2 text-center text-xs">ردیف</th>
            <th className="border border-gray-300 px-2 py-2 text-center text-xs">کد کالا</th>
            <th className="border border-gray-300 px-2 py-2 text-center text-xs">شرح کالا</th>
            <th className="border border-gray-300 px-2 py-2 text-center text-xs" colSpan="2">محل خرید</th>
            <th className="border border-gray-300 px-2 py-2 text-center text-xs">مشخصات فنی</th>
            <th className="border border-gray-300 px-2 py-2 text-center text-xs">تعداد درخواستی</th>
            <th className="border border-gray-300 px-2 py-2 text-center text-xs">تعداد تأیید شده</th>
            <th className="border border-gray-300 px-2 py-2 text-center text-xs">محل مصرف</th>
            <th className="border border-gray-300 px-2 py-2 text-center text-xs">قیمت</th>
            {!readOnly && <th className="border border-gray-300 px-2 py-2 text-center text-xs">عملیات</th>}
          </tr>
          <tr>
            <th className="border border-gray-300 px-2 py-1"></th>
            <th className="border border-gray-300 px-2 py-1"></th>
            <th className="border border-gray-300 px-2 py-1"></th>
            <th className="border border-gray-300 px-2 py-1 text-center text-[10px]">تهران</th>
            <th className="border border-gray-300 px-2 py-1 text-center text-[10px]">ارومیه</th>
            <th className="border border-gray-300 px-2 py-1"></th>
            <th className="border border-gray-300 px-2 py-1"></th>
            <th className="border border-gray-300 px-2 py-1"></th>
            <th className="border border-gray-300 px-2 py-1"></th>
            <th className="border border-gray-300 px-2 py-1"></th>
            {!readOnly && <th className="border border-gray-300 px-2 py-1"></th>}
          </tr>
        </thead>
        <tbody>
          {itemsList.map((item, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="border border-gray-300 px-2 py-1.5 text-center text-xs font-bold">{i + 1}</td>
              <td className="border border-gray-300 px-1 py-1">
                {readOnly ? (
                  <span className="text-xs block text-center">{item.item_code}</span>
                ) : (
                  <input className="w-full px-1 py-1 text-xs border-0 bg-transparent text-center focus:ring-1 focus:ring-primary-500 rounded" value={item.item_code} onChange={e => onUpdate(i, 'item_code', e.target.value)} />
                )}
              </td>
              <td className="border border-gray-300 px-1 py-1">
                {readOnly ? (
                  <span className="text-xs block">{item.description}</span>
                ) : (
                  <input className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:ring-1 focus:ring-primary-500 rounded" value={item.description} onChange={e => onUpdate(i, 'description', e.target.value)} />
                )}
              </td>
              <td className="border border-gray-300 px-1 py-1 text-center">
                {readOnly ? (
                  <span className="text-xs">{item.purchase_location === 'Tehran' ? '✓' : ''}</span>
                ) : (
                  <input type="radio" name={`loc_${i}`} checked={item.purchase_location === 'Tehran'} onChange={() => onUpdate(i, 'purchase_location', 'Tehran')} className="w-3 h-3" />
                )}
              </td>
              <td className="border border-gray-300 px-1 py-1 text-center">
                {readOnly ? (
                  <span className="text-xs">{item.purchase_location === 'Urmia' ? '✓' : ''}</span>
                ) : (
                  <input type="radio" name={`loc_${i}`} checked={item.purchase_location === 'Urmia'} onChange={() => onUpdate(i, 'purchase_location', 'Urmia')} className="w-3 h-3" />
                )}
              </td>
              <td className="border border-gray-300 px-1 py-1">
                {readOnly ? (
                  <span className="text-xs block">{item.technical_specs}</span>
                ) : (
                  <input className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:ring-1 focus:ring-primary-500 rounded" value={item.technical_specs} onChange={e => onUpdate(i, 'technical_specs', e.target.value)} />
                )}
              </td>
              <td className="border border-gray-300 px-1 py-1">
                {readOnly ? (
                  <span className="text-xs block text-center">{item.requested_quantity}</span>
                ) : (
                  <input type="number" min="0" className="w-full px-1 py-1 text-xs border-0 bg-transparent text-center focus:ring-1 focus:ring-primary-500 rounded" value={item.requested_quantity} onChange={e => onUpdate(i, 'requested_quantity', Number(e.target.value))} />
                )}
              </td>
              <td className="border border-gray-300 px-1 py-1">
                {readOnly ? (
                  <span className="text-xs block text-center">{item.approved_quantity}</span>
                ) : (
                  <input type="number" min="0" className="w-full px-1 py-1 text-xs border-0 bg-transparent text-center focus:ring-1 focus:ring-primary-500 rounded" value={item.approved_quantity} onChange={e => onUpdate(i, 'approved_quantity', Number(e.target.value))} />
                )}
              </td>
              <td className="border border-gray-300 px-1 py-1">
                {readOnly ? (
                  <span className="text-xs block">{item.usage_location}</span>
                ) : (
                  <input className="w-full px-1 py-1 text-xs border-0 bg-transparent focus:ring-1 focus:ring-primary-500 rounded" value={item.usage_location} onChange={e => onUpdate(i, 'usage_location', e.target.value)} />
                )}
              </td>
              <td className="border border-gray-300 px-1 py-1">
                {readOnly ? (
                  <span className="text-xs block text-center">{item.price ? Number(item.price).toLocaleString() : '-'}</span>
                ) : (
                  <input type="number" min="0" className="w-full px-1 py-1 text-xs border-0 bg-transparent text-center focus:ring-1 focus:ring-primary-500 rounded" value={item.price} onChange={e => onUpdate(i, 'price', Number(e.target.value))} />
                )}
              </td>
              {!readOnly && (
                <td className="border border-gray-300 px-1 py-1 text-center">
                  {itemsList.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">درخواست خرید کالا</h1>
          <p className="text-primary-100 text-sm mt-1">مدیریت درخواست‌های خرید تجهیزات و کالا</p>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-5xl shadow-2xl mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">ثبت درخواست خرید جدید</h3>
              <div className="text-left text-xs text-gray-500">
                <div>تاریخ: {toJalali(new Date().toISOString())}</div>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">
                لطفا اقلام مشروحه زیر را جهت مصرف در قسمت تعیین شده، برای واحد <span className="font-bold text-primary-600">{formData.department || '...'}</span> خریداری نمایید.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">واحد متقاضی</label>
                <input className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500" placeholder="نام واحد سازمانی" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">فوریت</label>
                <select className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500" value={formData.urgency} onChange={e => setFormData({ ...formData, urgency: e.target.value })}>
                  <option value="normal">عادی</option>
                  <option value="urgent">فوری</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              {renderItemsTable(items, false, updateItem)}
              <button onClick={addItem} className="mt-2 text-primary-500 text-sm font-medium hover:text-primary-600 transition-all">+ افزودن ردیف</button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">دلیل خرید</label>
              <textarea className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500" rows="2" placeholder="دلیل خرید" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
            </div>

            <div className="flex gap-3 pt-2 border-t">
              <button onClick={submitRequest} disabled={submitLoading} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">
                {submitLoading ? 'در حال ارسال...' : 'ثبت درخواست'}
              </button>
              <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">انصراف</button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto py-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-5xl shadow-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">جزئیات درخواست خرید شماره {detail.request_number}</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
              <div><span className="text-gray-500">شماره:</span> <span className="font-bold">{detail.request_number}</span></div>
              <div><span className="text-gray-500">تاریخ:</span> <span>{toJalali(detail.created_at)}</span></div>
              <div><span className="text-gray-500">واحد:</span> <span className="font-bold">{detail.department || detail.department_name}</span></div>
              <div><span className="text-gray-500">درخواست‌دهنده:</span> <span>{detail.user_name}</span></div>
              <div><span className="text-gray-500">وضعیت:</span> <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(statusMap[detail.status] || statusMap.pending_supervisor).color}`}>{(statusMap[detail.status] || statusMap.pending_supervisor).text}</span></div>
              <div><span className="text-gray-500">فوریت:</span> <span>{detail.urgency === 'urgent' ? 'فوری' : 'عادی'}</span></div>
            </div>

            {renderItemsTable(detail.items || [], true)}

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 p-3 rounded-xl">
                <div className="text-gray-500 text-xs mb-1">امضای درخواست‌کننده</div>
                <div className="font-bold">{detail.user_name}</div>
                <div className="text-xs text-gray-400">{toJalali(detail.created_at)}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl">
                <div className="text-gray-500 text-xs mb-1">تایید انبار</div>
                <div className="font-bold">{detail.warehouse_name || '-'}</div>
                <div className="text-xs text-gray-400">{detail.warehouse_date ? toJalali(detail.warehouse_date) : 'در انتظار'}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl">
                <div className="text-gray-500 text-xs mb-1">تایید مدیر کارخانه</div>
                <div className="font-bold">{detail.factory_manager_name || '-'}</div>
                <div className="text-xs text-gray-400">{detail.factory_manager_date ? toJalali(detail.factory_manager_date) : 'در انتظار'}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl">
                <div className="text-gray-500 text-xs mb-1">تایید واحد بودجه</div>
                <div className="font-bold">{detail.budget_name || '-'}</div>
                <div className="text-xs text-gray-400">{detail.budget_date ? toJalali(detail.budget_date) : 'در انتظار'}</div>
              </div>
            </div>

            {canApprove(detail) && (
              <div className="flex gap-3 mt-4 pt-4 border-t">
                <button onClick={() => { approveRequest(detail.id); setDetail(null); }} className="bg-green-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-green-600 transition-all shadow-sm">تایید</button>
                <button onClick={() => { rejectRequest(detail.id); setDetail(null); }} className="bg-red-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition-all shadow-sm">رد</button>
              </div>
            )}
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
                    <button onClick={() => loadDetail(r.id)} className="text-primary-500 hover:text-primary-700 underline">مشاهده اقلام</button>
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
        )}
      </div>
    </div>
  );
}
