import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalali, toJalaliDateTime } from '../utils/dateUtils';
import JalaliDatePicker from '../components/JalaliDatePicker';
import RepairExternalPrintView from '../components/RepairExternalPrintView';

const STATUS_MAP = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'پیش‌نویس' },
  pending_dept_manager: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'در انتظار تایید مسئول واحد' },
  pending_pm: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'در انتظار تایید PM' },
  pending_tech_manager: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'در انتظار تایید برق/فنی' },
  pending_warehouse: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'در انتظار تایید انبار' },
  pending_factory_manager: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'در انتظار تایید مدیر' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'تکمیل شده' },
  rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'رد شده' },
};

const SIGNERS = [
  { key: 'dept_manager', label: 'مسئول واحد', role: 'supervisor' },
  { key: 'pm', label: 'PM برنامه‌ریزی', role: 'manager' },
  { key: 'tech_manager', label: 'برق/فنی', role: 'manager' },
  { key: 'warehouse', label: 'انبار', role: 'manager' },
  { key: 'factory_manager', label: 'مدیر کارخانه', role: 'admin' },
];

const DESTINATIONS = ['تهران', 'سایر ۱', 'سایر ۲'];
const WORK_TYPES = ['تعمیر', 'تعمیر مجدد', 'کالیبره', 'جهت تست'];

const todayJalali = () => toJalali(new Date());

export default function RepairExternal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('my');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPrint, setShowPrint] = useState(false);


  const emptyForm = {
    doc_code: 'PM_01', edit_date: '۱۴۰۴/۰۹/۲۶', revision_number: '', form_date: todayJalali(),
    from_unit: '', to_unit: 'واحد PM', manager_name: user?.full_name || '',
    repair_speed: 'urgent', deadline: '', work_type: 'تعمیر',
    tech_description: '', estimated_cost: '', fault_description: '',
    fault_reason: 'کارکرد زیاد / استهلاک قطعات داخلی',
    warehouse_stock: 0, warehouse_stock_status: 'سالم',
    equipment_name: '',
    delivery_date: todayJalali(), send_date: '', send_serial: '', destination: '',
    contractor_name: '', contractor_address: '', repair_description: '',
    repair_cost: '', supporter_name: '',
    return_date: '', return_serial: '', quality_status: '', quality_notes: '',
    items: [{ item_name: '', tech_specs: '', serial_number: '', quantity: 1, attachments_desc: '' }],
    images: [],
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadRequests(); loadDepartments(); }, [activeTab]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const url = activeTab === 'my' ? '/repair-external/my-requests' : '/repair-external';
      const res = await api.get(url);
      setRequests(res.data.requests || res.data);
    } catch { toast.error('خطا در بارگذاری'); }
    setLoading(false);
  };

  const loadDepartments = async () => {
    try { const res = await api.get('/admin/departments'); setDepartments(res.data); } catch {}
  };

  const loadDetail = async (id) => {
    try {
      const res = await api.get(`/repair-external/${id}`);
      setDetailData(res.data);
      setSelectedRequest(res.data.request);
    } catch { toast.error('خطا در بارگذاری جزئیات'); }
  };

  const handleSubmit = async () => {
    if (!form.from_unit) return toast.error('از واحد الزامی است');
    setSubmitting(true);
    try {
      const fd = new FormData();
      const fields = [
        'doc_code', 'edit_date', 'revision_number', 'form_date',
        'from_unit', 'to_unit', 'manager_name', 'repair_speed', 'deadline', 'work_type',
        'tech_description', 'estimated_cost', 'fault_description', 'fault_reason',
        'warehouse_stock', 'warehouse_stock_status', 'equipment_name',
        'delivery_date', 'send_date', 'send_serial', 'destination',
        'contractor_name', 'contractor_address', 'repair_description', 'repair_cost', 'supporter_name',
        'return_date', 'return_serial', 'quality_status', 'quality_notes',
      ];
      for (const f of fields) fd.append(f, form[f] ?? '');
      fd.append('items', JSON.stringify(form.items));
      for (const f of form.images) fd.append('images', f);

      if (selectedRequest) {
        await api.put(`/repair-external/${selectedRequest.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('درخواست بروزرسانی شد');
      } else {
        await api.post('/repair-external', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('درخواست ثبت شد');
      }
      setShowForm(false);
      setSelectedRequest(null);
      setDetailData(null);
      setForm(emptyForm);
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
    setSubmitting(false);
  };

  const handleApprove = async (id, step) => {
    try {
      await api.post(`/repair-external/${id}/approve`, { step, comment: '' });
      toast.success('تایید شد');
      setSelectedRequest(null); setDetailData(null);
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const handleReject = async (id, step) => {
    const comment = prompt('دلیل رد:');
    if (!comment) return;
    try {
      await api.post(`/repair-external/${id}/reject`, { step, comment });
      toast.success('رد شد');
      setSelectedRequest(null); setDetailData(null);
      loadRequests();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try { await api.delete(`/repair-external/${id}`); toast.success('حذف شد'); loadRequests(); }
    catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { item_name: '', tech_specs: '', serial_number: '', quantity: 1, attachments_desc: '' }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, val) => {
    const items = [...form.items]; items[i] = { ...items[i], [field]: val }; setForm({ ...form, items });
  };

  const badge = (s) => {
    const m = STATUS_MAP[s] || STATUS_MAP.draft;
    return <span className={`px-3 py-1 rounded-full text-xs font-medium ${m.bg} ${m.text}`}>{m.label}</span>;
  };

  const canApprove = (request) => {
    if (!request || request.status === 'completed' || request.status === 'rejected') return false;
    const s = request.status;
    if (s === 'pending_dept_manager' && (user.role === 'supervisor' || user.role === 'admin')) return true;
    if (s === 'pending_pm' && (user.role === 'manager' || user.role === 'admin')) return true;
    if (s === 'pending_tech_manager' && (user.role === 'manager' || user.role === 'admin')) return true;
    if (s === 'pending_warehouse' && (user.role === 'manager' || user.role === 'admin')) return true;
    if (s === 'pending_factory_manager' && user.role === 'admin') return true;
    return false;
  };

  const getApproveStep = (status) => ({
    pending_dept_manager: 'dept_manager',
    pending_pm: 'pm',
    pending_tech_manager: 'tech_manager',
    pending_warehouse: 'warehouse',
    pending_factory_manager: 'factory_manager',
  }[status]);

  const toggleWorkType = (wt) => {
    const current = form.work_type ? form.work_type.split(',').map(s => s.trim()) : [];
    const next = current.includes(wt) ? current.filter(w => w !== wt) : [...current, wt];
    setForm({ ...form, work_type: next.join(', ') });
  };

  const toggleDestination = (dest) => {
    const current = form.destination ? form.destination.split(',').map(s => s.trim()) : [];
    const next = current.includes(dest) ? current.filter(d => d !== dest) : [...current, dest];
    setForm({ ...form, destination: next.join(', ') });
  };


  // ─── Detail Modal ───
  if (selectedRequest && detailData) {
    const r = detailData.request;
    const items = detailData.items || [];
    const history = detailData.history || [];
    return (
      <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl p-6 w-full max-w-5xl shadow-2xl my-4 max-h-[96vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <div>
              <h3 className="text-lg font-bold">درخواست تعمیرات / کالیبراسیون خارج از کارخانه</h3>
              <span className="text-xs text-gray-400">شماره: {r.request_number}</span>
            </div>
            <div className="flex items-center gap-3">
              {badge(r.status)}
              <button onClick={() => setShowPrint(true)} className="bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-600 transition-all">چاپ</button>
              <button onClick={() => { setSelectedRequest(null); setDetailData(null); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
          </div>

          {/* ─── بخش ۱: سربرگ ─── */}
          <div className="border-2 border-gray-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-primary-700 border-b pb-2">۱. سربرگ و اطلاعات پایه</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm bg-gray-50 rounded-lg p-3">
              <div><span className="text-gray-500 text-xs">کد سند:</span><div className="font-medium">{r.doc_code || 'PM_01'}</div></div>
              <div><span className="text-gray-500 text-xs">تاریخ ویرایش:</span><div className="font-medium">{r.edit_date || '۱۴۰۴/۰۹/۲۶'}</div></div>
              <div><span className="text-gray-500 text-xs">شماره ویرایش:</span><div className="font-medium">{r.revision_number || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">شماره درخواست:</span><div className="font-mono font-bold">{r.request_number}</div></div>
              <div><span className="text-gray-500 text-xs">تاریخ فرم:</span><div className="font-medium">{r.form_date || '-'}</div></div>
            </div>
          </div>

          {/* ─── بخش ۲: واحد متقاضی ─── */}
          <div className="border-2 border-gray-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-primary-700 border-b pb-2">۲. واحد متقاضی</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><span className="text-gray-500 text-xs">از واحد:</span><div className="font-medium">{r.from_unit}</div></div>
              <div><span className="text-gray-500 text-xs">به واحد:</span><div className="font-medium">{r.to_unit}</div></div>
              <div><span className="text-gray-500 text-xs">نام مسئول واحد:</span><div className="font-medium">{r.manager_name}</div></div>
            </div>
          </div>

          {/* ─── بخش ۳: مشخصات کالا ─── */}
          <div className="border-2 border-gray-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-primary-700 border-b pb-2">۳. مشخصات کالا</h4>
            {items.length === 0 ? <p className="text-gray-400 text-sm">آیتمی ثبت نشده</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100"><tr>
                    <th className="p-2 text-right">ردیف</th><th className="p-2 text-right">نام تجهیز/قطعه/کالا</th>
                    <th className="p-2 text-right">مشخصات فنی</th><th className="p-2 text-right">سریال</th>
                    <th className="p-2 text-right">تعداد</th><th className="p-2 text-right">متعلقات دستگاه</th>
                  </tr></thead>
                  <tbody>{items.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-center">{i + 1}</td>
                      <td className="p-2">{it.item_name}</td><td className="p-2">{it.tech_specs}</td>
                      <td className="p-2">{it.serial_number}</td><td className="p-2 text-center">{it.quantity}</td>
                      <td className="p-2">{it.attachments_desc}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── بخش ۴: اطلاعات فنی ─── */}
          <div className="border-2 border-gray-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-primary-700 border-b pb-2">۴. اطلاعات فنی و شرح خرابی</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500 text-xs">شرح داده‌های فنی:</span><div>{r.tech_description || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">قیمت حدودی:</span><div>{r.estimated_cost ? `${Number(r.estimated_cost).toLocaleString('fa-IR')} ریال` : '-'}</div></div>
              <div><span className="text-gray-500 text-xs">شرح اشکال:</span><div>{r.fault_description || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">شرح علت بروز مشکل:</span><div>{r.fault_reason || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">نوع تعمیر:</span><div><span className={`px-2 py-0.5 rounded text-xs ${r.repair_speed === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>{r.repair_speed === 'urgent' ? 'فوری' : 'عادی'}</span></div></div>
              <div><span className="text-gray-500 text-xs">تا تاریخ (مهلت):</span><div>{r.deadline || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">نوع کار:</span><div>{r.work_type || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">تعداد موجودی انبار:</span><div>{r.warehouse_stock ?? 0}</div></div>
              <div><span className="text-gray-500 text-xs">وضعیت انبار:</span><div>{r.warehouse_stock_status || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">تجهیز اصلی:</span><div>{r.equipment_name || '-'}</div></div>
            </div>
            {r.images && (
              <div className="mt-3"><span className="text-gray-500 text-xs">کروکی / عکس:</span>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {JSON.parse(r.images).map((img, i) => (
                    <a key={i} href={img} target="_blank" rel="noopener noreferrer"><img src={img} alt="" className="w-24 h-24 object-cover rounded-lg border" /></a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ─── بخش ۵: خروج و تاییدات ─── */}
          <div className="border-2 border-gray-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-primary-700 border-b pb-2">۵. خروج از شرکت و تاییدات</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
              <div><span className="text-gray-500 text-xs">تاریخ تحویل:</span><div>{r.delivery_date || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">تاریخ ارسال به تهران:</span><div>{r.send_date || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">شماره سریال خروجی:</span><div className="font-mono">{r.send_serial || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">جهت ارسال:</span><div>{r.destination || '-'}</div></div>
            </div>
{/* امضاها */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h5 className="text-xs font-bold text-gray-600 mb-2">امضاها و تاییدات</h5>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                {SIGNERS.map(s => {
                  const approved = s.key === 'dept_manager' ? r.dept_manager_approved
                    : s.key === 'pm' ? r.pm_approved
                    : s.key === 'tech_manager' ? r.tech_manager_approved
                    : s.key === 'warehouse' ? r.warehouse_approved
                    : s.key === 'factory_manager' ? r.factory_manager_approved
                    : false;
                  const sigData = detailData?.signatures?.[s.key];
                  const sigImg = sigData?.scanned_signature || sigData?.signature_data || null;
                  return (
                    <div key={s.key} className={`p-2 rounded-lg border flex flex-col items-center justify-center min-h-[80px] ${approved ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
                      <div className="font-medium text-[10px]">{s.label}</div>
                      {sigImg ? (
                        <img src={sigImg} alt={s.label} className="h-12 mt-1 object-contain" style={{ maxWidth: '100%' }} />
                      ) : approved ? (
                        <div className="text-green-600 mt-1">✓ تایید شده</div>
                      ) : (
                        <div className="text-gray-400 mt-1">○ در انتظار</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── بخش ۶: پشتیبانی ─── */}
          <div className="border-2 border-gray-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-primary-700 border-b pb-2">۶. واحد پشتیبانی (تعمیرگاه)</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500 text-xs">نام شرکت ارسال شده:</span><div>{r.contractor_name || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">آدرس تعمیرگاه و تلفن:</span><div>{r.contractor_address || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">شرح تعمیرات:</span><div>{r.repair_description || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">هزینه تعمیرات بعد از تخفیف:</span><div>{r.repair_cost ? `${Number(r.repair_cost).toLocaleString('fa-IR')} ریال` : '-'}</div></div>
              <div><span className="text-gray-500 text-xs">نام و امضاء مسئول پیگیری:</span><div>{r.supporter_name || '-'}</div></div>
              <div className={r.support_completed ? 'text-green-600' : 'text-gray-400'}>
                {r.support_completed ? '✓ تکمیل شده' : '○ در انتظار'}
              </div>
            </div>
          </div>

          {/* ─── بخش ۷: کنترل کیفی ─── */}
          <div className="border-2 border-gray-200 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-primary-700 border-b pb-2">۷. انبار و کنترل کیفی (بازگشت کالا)</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500 text-xs">تاریخ ورود به انبار:</span><div>{r.return_date || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">شماره سریال وارده انبار:</span><div className="font-mono">{r.return_serial || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">وضعیت کیفی:</span><div>{r.quality_status || '-'}</div></div>
              <div><span className="text-gray-500 text-xs">توضیحات:</span><div>{r.quality_notes || '-'}</div></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mt-3">
              {[
                { key: 'quality', label: 'کنترل کیفی', approved: r.quality_approved },
                { key: 'pm', label: 'مسئول PM', approved: r.pm_approved },
                { key: 'final_warehouse', label: 'مسئول انبار', approved: r.final_warehouse_approved },
              ].map(item => {
                const sigData = detailData?.signatures?.[item.key] || null;
                const sigImg = sigData?.scanned_signature || sigData?.signature_data || null;
                return (
                  <div key={item.key} className={`p-2 rounded-lg border flex flex-col items-center justify-center min-h-[70px] ${item.approved ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200'}`}>
                    <span className="font-medium text-[10px]">{item.label}</span>
                    {sigImg ? (
                      <img src={sigImg} alt={item.label} className="h-10 mt-1 object-contain" style={{ maxWidth: '100%' }} />
                    ) : item.approved ? (
                      <div className="text-green-600 mt-1 text-[10px]">✓ تایید شده</div>
                    ) : (
                      <div className="text-gray-400 mt-1 text-[10px]">○ در انتظار</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Approve/Reject */}
          {canApprove(r) && (
            <div className="flex gap-2 mt-4 border-t pt-4">
              <button onClick={() => handleApprove(r.id, getApproveStep(r.status))} className="bg-green-500 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-green-600">تایید</button>
              <button onClick={() => handleReject(r.id, getApproveStep(r.status))} className="bg-red-500 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-red-600">رد</button>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="font-bold text-sm mb-2">تاریخچه</h4>
              <div className="space-y-1">
                {history.map((h, i) => (
                  <div key={i} className="text-xs bg-gray-50 p-2 rounded-lg">
                    <span className="font-medium">{h.user_name}</span> — {h.action}
                    {h.comment && <span className="text-gray-500"> ({h.comment})</span>}
                    <span className="text-gray-400 mr-2">{toJalaliDateTime(h.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4 border-t pt-4">
            <button onClick={() => { setSelectedRequest(null); setDetailData(null); }} className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium">بستن</button>
          </div>
        </div>
      </div>
      {showPrint && (
        <RepairExternalPrintView
          request={detailData.request}
          items={detailData.items}
          history={detailData.history}
          signatures={detailData.signatures}
          onClose={() => setShowPrint(false)}
        />
      )}
      </>
    );
  }

  // ─── Create/Edit Form (PM_01) ───
  if (showForm) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto">
        <div className="bg-white rounded-2xl p-6 w-full max-w-5xl shadow-2xl my-4 max-h-[96vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 border-b pb-4">
            <div>
              <h3 className="text-lg font-bold">درخواست تعمیرات / کالیبراسیون خارج از کارخانه</h3>
              <p className="text-xs text-gray-400 mt-1">فرم شماره PM_01</p>
            </div>
            <button onClick={() => { setShowForm(false); setSelectedRequest(null); setForm(emptyForm); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>

          {/* ─── بخش ۱: سربرگ ─── */}
          <div className="border-2 border-blue-200 bg-blue-50/30 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-blue-700 border-b border-blue-200 pb-2">۱. سربرگ و اطلاعات پایه</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">کد سند</label>
                <input value={form.doc_code} onChange={e => setForm({ ...form, doc_code: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" readOnly />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">تاریخ ویرایش</label>
                <input value={form.edit_date} onChange={e => setForm({ ...form, edit_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" readOnly />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">شماره ویرایش</label>
                <input value={form.revision_number} onChange={e => setForm({ ...form, revision_number: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="مثلاً ۱" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">شماره درخواست</label>
                <input value="خودکار" className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-100 text-gray-400" readOnly />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">تاریخ فرم</label>
                <input value={form.form_date} onChange={e => setForm({ ...form, form_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
          </div>

          {/* ─── بخش ۲: واحد متقاضی ─── */}
          <div className="border-2 border-green-200 bg-green-50/30 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-green-700 border-b border-green-200 pb-2">۲. واحد متقاضی</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">از واحد *</label>
                <select value={form.from_unit} onChange={e => setForm({ ...form, from_unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">انتخاب واحد</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">به واحد</label>
                <input value={form.to_unit} onChange={e => setForm({ ...form, to_unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">نام مسئول واحد</label>
                <input value={form.manager_name} onChange={e => setForm({ ...form, manager_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
          </div>

          {/* ─── بخش ۳: مشخصات کالا ─── */}
          <div className="border-2 border-purple-200 bg-purple-50/30 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3 border-b border-purple-200 pb-2">
              <h4 className="font-bold text-sm text-purple-700">۳. مشخصات کالا</h4>
              <button onClick={addItem} className="bg-purple-500 text-white px-3 py-1 rounded-lg text-xs hover:bg-purple-600">+ افزودن ردیف</button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="bg-white rounded-lg border p-3 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500">ردیف {i + 1}</span>
                  {form.items.length > 1 && <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 text-xs">حذف</button>}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <input placeholder="نام تجهیز/قطعه/کالا" value={item.item_name} onChange={e => updateItem(i, 'item_name', e.target.value)} className="px-2 py-1.5 border rounded-lg text-xs" />
                  <input placeholder="مشخصات فنی" value={item.tech_specs} onChange={e => updateItem(i, 'tech_specs', e.target.value)} className="px-2 py-1.5 border rounded-lg text-xs" />
                  <input placeholder="سریال" value={item.serial_number} onChange={e => updateItem(i, 'serial_number', e.target.value)} className="px-2 py-1.5 border rounded-lg text-xs" />
                  <input type="number" min="1" placeholder="تعداد" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} className="px-2 py-1.5 border rounded-lg text-xs" />
                  <input placeholder="متعلقات دستگاه" value={item.attachments_desc} onChange={e => updateItem(i, 'attachments_desc', e.target.value)} className="px-2 py-1.5 border rounded-lg text-xs" />
                </div>
              </div>
            ))}
          </div>

          {/* ─── بخش ۴: اطلاعات فنی ─── */}
          <div className="border-2 border-amber-200 bg-amber-50/30 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-amber-700 border-b border-amber-200 pb-2">۴. اطلاعات فنی و شرح خرابی</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">شرح داده‌های فنی</label>
                <textarea rows={2} value={form.tech_description} onChange={e => setForm({ ...form, tech_description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">قیمت حدودی (ریال)</label>
                <input value={form.estimated_cost} onChange={e => setForm({ ...form, estimated_cost: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="مثلاً ۵۰۰۰۰۰۰" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">نوع کار</label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {WORK_TYPES.map(wt => (
                    <label key={wt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.work_type.split(',').map(s=>s.trim()).includes(wt)} onChange={() => toggleWorkType(wt)} className="rounded" />
                      {wt}
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">شرح اشکال</label>
                <textarea rows={2} value={form.fault_description} onChange={e => setForm({ ...form, fault_description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">شرح علت بروز مشکل</label>
                <input value={form.fault_reason} onChange={e => setForm({ ...form, fault_reason: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">نوع تعمیر</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="repairSpeed" checked={form.repair_speed === 'urgent'} onChange={() => setForm({ ...form, repair_speed: 'urgent' })} /> فوری
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="repairSpeed" checked={form.repair_speed === 'normal'} onChange={() => setForm({ ...form, repair_speed: 'normal' })} /> عادی
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">تا تاریخ (مهلت)</label>
                <JalaliDatePicker value={form.deadline} onChange={v => setForm({ ...form, deadline: v })} placeholder="تا تاریخ" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">تعداد موجودی انبار</label>
                <input type="number" min="0" value={form.warehouse_stock} onChange={e => setForm({ ...form, warehouse_stock: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">وضعیت انبار</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="stockStatus" checked={form.warehouse_stock_status === 'سالم'} onChange={() => setForm({ ...form, warehouse_stock_status: 'سالم' })} /> سالم
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="stockStatus" checked={form.warehouse_stock_status === 'معیوب'} onChange={() => setForm({ ...form, warehouse_stock_status: 'معیوب' })} /> معیوب
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">تجهیز اصلی (نام تجهیز)</label>
                <input value={form.equipment_name} onChange={e => setForm({ ...form, equipment_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="نام تجهیز" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">کروکی / عکس (حداکثر ۱۰ فایل)</label>
                <input type="file" multiple accept="image/*,.pdf" onChange={e => setForm({ ...form, images: Array.from(e.target.files) })} className="w-full text-sm border rounded-lg p-2" />
                {form.images.length > 0 && <p className="text-xs text-gray-500 mt-1">{form.images.length} فایل انتخاب شده</p>}
              </div>
            </div>
          </div>

          {/* ─── بخش ۵: خروج و تاییدات ─── */}
          <div className="border-2 border-indigo-200 bg-indigo-50/30 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-indigo-700 border-b border-indigo-200 pb-2">۵. خروج از شرکت و تاییدات</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">تاریخ تحویل از واحد</label>
                <input value={form.delivery_date} onChange={e => setForm({ ...form, delivery_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">تاریخ ارسال به تهران</label>
                <JalaliDatePicker value={form.send_date} onChange={v => setForm({ ...form, send_date: v })} placeholder="تاریخ ارسال" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">شماره سریال خروجی</label>
                <input value={form.send_serial} onChange={e => setForm({ ...form, send_serial: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">جهت ارسال</label>
                <div className="flex flex-wrap gap-3 mt-2">
                  {DESTINATIONS.map(dest => (
                    <label key={dest} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <input type="checkbox" checked={form.destination.split(',').map(s=>s.trim()).includes(dest)} onChange={() => toggleDestination(dest)} className="rounded" />
                      {dest}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            {/* امضاها */}
            <div className="bg-white rounded-lg border p-3">
              <h5 className="text-xs font-bold text-gray-600 mb-2">بخش امضاها (تایید سیستمی)</h5>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                {SIGNERS.map(s => (
                  <div key={s.key} className="p-2 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="font-medium">{s.label}</div>
                    <div className="text-gray-400 mt-1">○ در انتظار تایید</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── بخش ۶: پشتیبانی ─── */}
          <div className="border-2 border-cyan-200 bg-cyan-50/30 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-cyan-700 border-b border-cyan-200 pb-2">۶. واحد پشتیبانی (تعمیرگاه)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">نام شرکت ارسال شده</label>
                <input value={form.contractor_name} onChange={e => setForm({ ...form, contractor_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">نام و امضاء مسئول پیگیری</label>
                <input value={form.supporter_name} onChange={e => setForm({ ...form, supporter_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">آدرس تعمیرگاه و تلفن</label>
                <textarea rows={2} value={form.contractor_address} onChange={e => setForm({ ...form, contractor_address: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">شرح تعمیرات</label>
                <textarea rows={2} value={form.repair_description} onChange={e => setForm({ ...form, repair_description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">هزینه تعمیرات بعد از تخفیف (ریال)</label>
                <input value={form.repair_cost} onChange={e => setForm({ ...form, repair_cost: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">💡 اگر پشتیبانی دفتر تهران باشد، بخش ۶ توسط تهران وگرنه توسط مامور خرید پر می‌شود.</p>
          </div>

          {/* ─── بخش ۷: کنترل کیفی ─── */}
          <div className="border-2 border-teal-200 bg-teal-50/30 rounded-xl p-4 mb-4">
            <h4 className="font-bold text-sm mb-3 text-teal-700 border-b border-teal-200 pb-2">۷. انبار و کنترل کیفی (بازگشت کالا)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">تاریخ ورود به انبار</label>
                <JalaliDatePicker value={form.return_date} onChange={v => setForm({ ...form, return_date: v })} placeholder="تاریخ ورود" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">شماره سریال وارده انبار</label>
                <input value={form.return_serial} onChange={e => setForm({ ...form, return_serial: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">وضعیت کیفی</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="qcStatus" checked={form.quality_status === 'مورد تایید می‌باشد'} onChange={() => setForm({ ...form, quality_status: 'مورد تایید می‌باشد' })} /> مورد تایید می‌باشد
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="qcStatus" checked={form.quality_status === 'مورد تایید نمی‌باشد'} onChange={() => setForm({ ...form, quality_status: 'مورد تایید نمی‌باشد' })} /> نمی‌باشد
                  </label>
                </div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">توضیحات</label>
                <textarea rows={2} value={form.quality_notes} onChange={e => setForm({ ...form, quality_notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <button onClick={handleSubmit} disabled={submitting} className="bg-primary-500 text-white px-8 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 disabled:opacity-50">
              {submitting ? 'در حال ارسال...' : selectedRequest ? 'بروزرسانی درخواست' : 'ثبت درخواست'}
            </button>
            <button onClick={() => { setShowForm(false); setSelectedRequest(null); setDetailData(null); setForm(emptyForm); }} className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-xl text-sm font-medium">انصراف</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main List ───
  return (
    <div className="animate-fade-in space-y-6">
      {/* ناوبری */}
      <div className="flex gap-2">
        <button onClick={() => navigate('/repair')} className="bg-white text-gray-600 px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">تعمیرات داخل کارخانه</button>
        <button className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-md">تعمیرات خارج از کارخانه</button>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-l from-orange-500 to-orange-700 text-white rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">درخواست تعمیرات / کالیبراسیون خارج از کارخانه</h1>
          <p className="text-orange-100 text-sm mt-1">فرم PM_01 — مدیریت درخواست‌های تعمیر خارج از مجموعه</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(true)} className="bg-white/20 hover:bg-white/30 backdrop-blur text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all">
            + درخواست جدید
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {['my', 'all'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {tab === 'my' ? 'درخواست‌های من' : 'همه درخواست‌ها'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div></div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center"><div className="text-gray-300 text-5xl mb-4">🔧</div><p className="text-gray-400 text-sm">درخواستی وجود ندارد</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80"><tr>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500">شماره</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500">تاریخ</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500">از واحد</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500">تجهیز</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500">نوع کار</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500">فوریت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500">وضعیت</th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold text-gray-500">عملیات</th>
              </tr></thead>
              <tbody>
                {requests.map(r => (
                  <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{r.request_number}</td>
                    <td className="px-4 py-3 text-xs">{r.form_date || toJalali(r.created_at)}</td>
                    <td className="px-4 py-3 text-xs">{r.from_unit}</td>
                    <td className="px-4 py-3 text-xs max-w-[120px] truncate">{r.equipment_name || '-'}</td>
                    <td className="px-4 py-3 text-xs">{r.work_type || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${r.repair_speed === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {r.repair_speed === 'urgent' ? 'فوری' : 'عادی'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{badge(r.status)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => loadDetail(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100">مشاهده</button>
                        {r.user_id === user.id && (r.status === 'draft' || r.status === 'pending_dept_manager' || r.status === 'pending_pm') && (
                          <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600">حذف</button>
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
