import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalali } from '../utils/dateUtils';
import JalaliDatePicker from '../components/JalaliDatePicker';
import { printTable } from '../utils/printUtils';

export default function Repair() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [formData, setFormData] = useState({ title: '', description: '', equipment_name: '', location: '', urgency: 'normal', estimated_cost: '', desired_date: '' });
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { loadRequests(); }, [activeTab]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const url = activeTab === 'my' ? '/repair/my-requests' : '/repair';
      const res = await api.get(url);
      setRequests(res.data.requests || res.data);
    } catch (err) { toast.error('خطا در بارگذاری'); }
    finally { setLoading(false); }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 5) { toast.error('حداکثر ۵ تصویر'); return; }
    for (const f of files) {
      if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} حجم بیش از ۵ مگابایت دارد`); return; }
    }
    setImageFiles(files);
    setImagePreviews(files.map(f => URL.createObjectURL(f)));
  };

  const removeImage = (idx) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const submitRequest = async () => {
    setSubmitLoading(true);
    try {
      if (!formData.title) return toast.error('عنوان الزامی است');
      const fd = new FormData();
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      fd.append('equipment_name', formData.equipment_name);
      fd.append('location', formData.location);
      fd.append('urgency', formData.urgency);
      fd.append('estimated_cost', formData.estimated_cost);
      fd.append('desired_date', formData.desired_date);
      for (const f of imageFiles) fd.append('images', f);
      await api.post('/repair', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('درخواست ثبت شد');
      setShowForm(false);
      setFormData({ title: '', description: '', equipment_name: '', location: '', urgency: 'normal', estimated_cost: '', desired_date: '' });
      setImageFiles([]);
      setImagePreviews([]);
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
    finally { setSubmitLoading(false); }
  };

  const approveRequest = async (id) => {
    try { await api.post(`/repair/${id}/approve`, { comment: '' }); toast.success('تایید شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const rejectRequest = async (id) => {
    const comment = prompt('دلیل رد:');
    if (!comment) return;
    try { await api.post(`/repair/${id}/reject`, { comment }); toast.success('رد شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const deleteRequest = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try { await api.delete(`/repair/${id}`); toast.success('حذف شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const showDetail = async (r) => {
    setSelectedRequest(r);
    try {
      const res = await api.get(`/repair/${r.id}`);
      setDetailData(res.data);
    } catch { setDetailData(null); }
  };

  const getImages = (r) => {
    if (!r.images) return [];
    try { return JSON.parse(r.images); } catch { return []; }
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
    const columns = ['شماره', 'تاریخ', 'عنوان', 'تجهیز', 'فوریت', 'وضعیت'];
    const rows = requests.map(r => [
      r.request_number,
      r.desired_date ? toJalali(r.desired_date) : toJalali(r.created_at),
      r.title,
      r.equipment_name || '-',
      r.urgency === 'urgent' ? 'فوری' : 'عادی',
      r.status === 'pending_supervisor' ? 'در انتظار سرپرست' : r.status === 'pending_manager' ? 'در انتظار مدیر' : r.status === 'approved' ? 'تایید شده' : 'رد شده'
    ]);
    printTable('درخواست تعمیرات', columns, rows);
  };

  const parseImages = (imgStr) => {
    if (!imgStr) return [];
    try { return JSON.parse(imgStr); } catch { return []; }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* ناوبری بین تعمیرات داخلی و خارجی */}
      <div className="flex gap-2">
        <button className="bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-md">
          تعمیرات داخل کارخانه
        </button>
        <button onClick={() => navigate('/repair-external')} className="bg-white text-gray-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">
          تعمیرات خارج از کارخانه
        </button>
      </div>

      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">درخواست تعمیرات</h1>
          <p className="text-primary-100 text-sm mt-1">مدیریت درخواست‌های تعمیر و نگهداری تجهیزات</p>
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

      {/* ─── فرم درخواست جدید ─── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6">ثبت درخواست تعمیرات جدید</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">عنوان درخواست</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="عنوان درخواست" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">هزینه تقریبی</label>
                <input className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="هزینه تقریبی" value={formData.estimated_cost} onChange={e => setFormData({ ...formData, estimated_cost: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تاریخ مورد نظر</label>
                <JalaliDatePicker value={formData.desired_date} onChange={(v) => setFormData({ ...formData, desired_date: v })} placeholder="تاریخ مورد نظر" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">توضیحات</label>
                <textarea className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all" placeholder="توضیحات" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              {/* ─── آپلود تصویر ─── */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">تصاویر (اختیاری)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-primary-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                    id="repair-images"
                  />
                  <label htmlFor="repair-images" className="cursor-pointer">
                    <div className="text-3xl mb-1">📷</div>
                    <p className="text-sm text-gray-600">کلیک کنید یا تصاویر را بکشید</p>
                    <p className="text-xs text-gray-400 mt-1">حداکثر ۵ تصویر، هر کدام حداکثر ۵ مگابایت</p>
                  </label>
                </div>
                {imagePreviews.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {imagePreviews.map((src, i) => (
                      <div key={i} className="relative group">
                        <img src={src} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                        <button
                          onClick={() => removeImage(i)}
                          className="absolute -top-2 -left-2 bg-red-500 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={submitRequest} disabled={submitLoading} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">{submitLoading ? 'در حال ارسال...' : 'ثبت'}</button>
              <button onClick={() => { setShowForm(false); setImageFiles([]); setImagePreviews([]); }} className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-all">انصراف</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── جزئیات درخواست ─── */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">جزئیات درخواست {selectedRequest.request_number}</h3>
              <button onClick={() => { setSelectedRequest(null); setDetailData(null); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">عنوان:</span> <span className="font-medium">{selectedRequest.title}</span></div>
                <div><span className="text-gray-500">تجهیز:</span> <span className="font-medium">{selectedRequest.equipment_name || '-'}</span></div>
                <div><span className="text-gray-500">محل:</span> <span className="font-medium">{selectedRequest.location || '-'}</span></div>
                <div><span className="text-gray-500">فوریت:</span> <span className={`font-medium ${selectedRequest.urgency === 'urgent' ? 'text-red-600' : ''}`}>{selectedRequest.urgency === 'urgent' ? 'فوری' : 'عادی'}</span></div>
                <div><span className="text-gray-500">وضعیت:</span> {statusBadge(selectedRequest.status)}</div>
                <div><span className="text-gray-500">تاریخ:</span> <span className="font-medium">{toJalali(selectedRequest.created_at)}</span></div>
              </div>
              {selectedRequest.description && (
                <div><span className="text-gray-500">توضیحات:</span> <span className="font-medium">{selectedRequest.description}</span></div>
              )}
              {selectedRequest.estimated_cost && (
                <div><span className="text-gray-500">هزینه تقریبی:</span> <span className="font-medium">{selectedRequest.estimated_cost}</span></div>
              )}

              {/* ─── تصاویر پیوست ─── */}
              {getImages(selectedRequest).length > 0 && (
                <div>
                  <span className="text-gray-500">تصاویر:</span>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {getImages(selectedRequest).map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noopener noreferrer">
                        <img src={img} alt="" className="w-24 h-24 object-cover rounded-lg border hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {detailData?.history?.length > 0 && (
                <div className="mt-4">
                  <span className="text-gray-500 font-medium">تاریخچه:</span>
                  <div className="space-y-1 mt-2">
                    {detailData.history.map((h, i) => (
                      <div key={i} className="text-xs bg-gray-50 p-2 rounded-lg">
                        <span className="font-medium">{h.user_name}</span> — {h.action}
                        {h.comment && <span className="text-gray-500"> ({h.comment})</span>}
                        <span className="text-gray-400 mr-2">{new Date(h.created_at).toLocaleString('fa-IR')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── جدول درخواست‌ها ─── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
            <p className="text-gray-400 text-sm mt-3">در حال بارگذاری...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-300 text-5xl mb-4">🔧</div>
            <p className="text-gray-400 text-sm">درخواستی وجود ندارد</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80"><tr>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">شماره</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تاریخ</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">عنوان</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تجهیز</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">تصاویر</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">فوریت</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">وضعیت</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">عملیات</th>
            </tr></thead>
            <tbody>
              {requests.map(r => {
                const imgs = parseImages(r.images);
                return (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{r.request_number}</td>
                    <td className="px-4 py-3 text-xs">{r.desired_date ? toJalali(r.desired_date) : toJalali(r.created_at)}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <button onClick={() => showDetail(r)} className="text-primary-600 hover:underline">{r.title}</button>
                    </td>
                    <td className="px-4 py-3 text-xs">{r.equipment_name}</td>
                    <td className="px-4 py-3">
                      {imgs.length > 0 ? (
                        <div className="flex gap-1">
                          {imgs.slice(0, 3).map((img, i) => (
                            <img key={i} src={img} alt="" className="w-8 h-8 object-cover rounded border" />
                          ))}
                          {imgs.length > 3 && <span className="text-xs text-gray-400 self-center">+{imgs.length - 3}</span>}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${r.urgency === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {r.urgency === 'urgent' ? 'فوری' : 'عادی'}
                      </span>
                    </td>
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
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
