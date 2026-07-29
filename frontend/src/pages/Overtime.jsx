import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import moment from 'moment-jalaali';
import toast from 'react-hot-toast';
import JalaliCalendar from '../components/JalaliCalendar';
import Pagination from '../components/Pagination';
import { printTable } from '../utils/printUtils';

const statusMap = {
  pending_supervisor: { text: 'در انتظار سرپرست', color: 'bg-blue-100 text-blue-700' },
  pending_manager: { text: 'در انتظار مدیر', color: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'تایید شده', color: 'bg-green-100 text-green-700' },
  rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
  seen_security: { text: 'رویت شده (حراست)', color: 'bg-purple-100 text-purple-700' },
};

function formatDateTime(dt) {
  if (!dt) return null;
  const clean = dt.replace('T', ' ').replace('Z', '');
  const parts = clean.split(' ');
  const datePart = parts[0] || '';
  const timePart = parts[1] ? parts[1].substring(0, 5) : '';
  return timePart ? `${datePart} — ساعت ${timePart}` : datePart;
}

export default function Overtime() {
  const { user, hasPermission } = useAuth();
  const [tab, setTab] = useState('my');
  const [myRequests, setMyRequests] = useState([]);
  const [pendingSupervisor, setPendingSupervisor] = useState([]);
  const [pendingManager, setPendingManager] = useState([]);
  const [securityList, setSecurityList] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  const [allRequestsTotal, setAllRequestsTotal] = useState(0);
  const [allRequestsPage, setAllRequestsPage] = useState(1);
  const [allRequestsSearch, setAllRequestsSearch] = useState('');
  const [allRequestsDebounce, setAllRequestsDebounce] = useState('');
  const [balance, setBalance] = useState(null);
  const [balanceAll, setBalanceAll] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [calculation, setCalculation] = useState(null);
  const [editCalculation, setEditCalculation] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [requestFor, setRequestFor] = useState('self'); // 'self' or 'subordinate'
  const [modifyingRequest, setModifyingRequest] = useState(null);
  const [modForm, setModForm] = useState({ end_date: '', end_hour: '', hours_count: 0, reason: '', showEndCal: false });
  const [comments, setComments] = useState({}); // { [requestId]: 'some comment' }
  
  const [form, setForm] = useState({ user_id: '', start_date: '', start_hour: '', end_date: '', end_hour: '', reason: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ start_date: '', start_hour: '', end_date: '', end_hour: '', reason: '' });
  
  const [showStartCal, setShowStartCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);
  const [editShowStartCal, setEditShowStartCal] = useState(false);
  const [editShowEndCal, setEditShowEndCal] = useState(false);

  // Generate 24 hours options in 30-min intervals
  const hourOptions = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0');
    hourOptions.push(`${hh}:00`);
    hourOptions.push(`${hh}:30`);
  }
  hourOptions.push('24:00');

  useEffect(() => {
    if (user && ['admin', 'manager', 'supervisor'].includes(user.role)) {
      api.get('/overtime/subordinates')
        .then(res => setSubordinates(res.data))
        .catch(err => console.error('Error fetching subordinates', err));
    }
  }, [user]);

  useEffect(() => {
    if (form.start_date && form.start_hour && form.end_date && form.end_hour) {
      api.get('/overtime/calculate', {
        params: {
          start_date: form.start_date,
          start_time: form.start_hour,
          end_date: form.end_date,
          end_time: form.end_hour
        }
      }).then(res => setCalculation(res.data))
        .catch(err => setCalculation(null));
    } else {
      setCalculation(null);
    }
  }, [form.start_date, form.start_hour, form.end_date, form.end_hour]);

  useEffect(() => {
    if (editForm.start_date && editForm.start_hour && editForm.end_date && editForm.end_hour) {
      api.get('/overtime/calculate', {
        params: {
          start_date: editForm.start_date,
          start_time: editForm.start_hour,
          end_date: editForm.end_date,
          end_time: editForm.end_hour
        }
      }).then(res => setEditCalculation(res.data))
        .catch(err => setEditCalculation(null));
    } else {
      setEditCalculation(null);
    }
  }, [editForm.start_date, editForm.start_hour, editForm.end_date, editForm.end_hour]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('ws-update', handleUpdate);
    return () => window.removeEventListener('ws-update', handleUpdate);
  }, [tab, allRequestsPage]);

  useEffect(() => {
    const timer = setTimeout(() => setAllRequestsDebounce(allRequestsSearch), 400);
    return () => clearTimeout(timer);
  }, [allRequestsSearch]);

  useEffect(() => {
    if (tab === 'all') setAllRequestsPage(1);
  }, [allRequestsDebounce, tab]);

  const loadData = async () => {
    try {
      if (tab === 'my') {
        const [myRes, balRes] = await Promise.all([
          api.get('/overtime/my-requests'),
          api.get('/overtime/balance')
        ]);
        setMyRequests(myRes.data);
        setBalance(balRes.data);
      } else if (tab === 'supervisor') {
        const res = await api.get('/overtime/pending-supervisor');
        setPendingSupervisor(res.data);
      } else if (tab === 'manager') {
        const mgrRes = await api.get('/overtime/pending-manager');
        setPendingManager(mgrRes.data);
      } else if (tab === 'security') {
        const secRes = await api.get('/overtime/security');
        setSecurityList(secRes.data);
      } else if (tab === 'all') {
        const allRes = await api.get('/overtime/all', { params: { page: allRequestsPage, limit: 50, search: allRequestsDebounce } });
        setAllRequests(allRes.data.data);
        setAllRequestsTotal(allRes.data.total);
      } else if (tab === 'balance') {
        const balAllRes = await api.get('/overtime/balance-all');
        setBalanceAll(balAllRes.data);
      }
    } catch (err) {
      toast.error('خطا در بارگذاری اطلاعات');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setRequestFor('self');
    setForm({ user_id: '', start_date: '', start_hour: '', end_date: '', end_hour: '', reason: '' });
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    try {
      if (requestFor === 'subordinate' && !form.user_id) {
        toast.error('لطفاً یکی از پرسنل زیرمجموعه را انتخاب کنید');
        return;
      }
      if (!form.start_date || !form.start_hour || !form.end_date || !form.end_hour) {
        toast.error('پر کردن تمام فیلدهای تاریخ و ساعت الزامی است');
        return;
      }
      const today = moment().format('jYYYY/jMM/jDD');
      if (form.start_date < today && user.role !== 'admin') {
        toast.error('امکان ثبت اضافه کار برای تاریخ گذشته وجود ندارد');
        return;
      }
      await api.post('/overtime', {
        user_id: requestFor === 'subordinate' ? form.user_id : '',
        start_date: form.start_date,
        start_time: form.start_hour,
        end_date: form.end_date,
        end_time: form.end_hour,
        reason: form.reason
      });
      toast.success('درخواست اضافه کار ثبت شد');
      closeForm();
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ثبت درخواست');
    }
  };

  const openEdit = (reqItem) => {
    setEditId(reqItem.id);
    setEditForm({
      start_date: reqItem.start_date,
      end_date: reqItem.end_date,
      reason: reqItem.reason || '',
      start_hour: reqItem.start_hour || '',
      end_hour: reqItem.end_hour || '',
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    try {
      if (!editForm.start_date || !editForm.start_hour || !editForm.end_date || !editForm.end_hour) {
        toast.error('پر کردن تمام فیلدهای تاریخ و ساعت الزامی است');
        return;
      }
      await api.put(`/overtime/${editId}/edit`, {
        start_date: editForm.start_date,
        start_time: editForm.start_hour,
        end_date: editForm.end_date,
        end_time: editForm.end_hour,
        reason: editForm.reason
      });
      toast.success('درخواست ویرایش شد');
      setEditId(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ویرایش');
    }
  };

  const openModifyRequest = (reqItem) => {
    setModifyingRequest(reqItem);
    setModForm({
      end_date: reqItem.end_date,
      end_hour: reqItem.end_hour || '',
      hours_count: reqItem.hours_count || 0,
      reason: '',
      showEndCal: false,
    });
  };

  useEffect(() => {
    if (modifyingRequest && modForm.end_date && modForm.end_hour) {
      api.get('/overtime/calculate', {
        params: {
          start_date: modifyingRequest.start_date,
          start_time: modifyingRequest.start_hour,
          end_date: modForm.end_date,
          end_time: modForm.end_hour
        }
      })
      .then(res => {
        setModForm(prev => ({ ...prev, hours_count: res.data.total_hours }));
      })
      .catch(err => console.error('Error calculating hours', err));
    }
  }, [modForm.end_date, modForm.end_hour]);

  const submitRequestModification = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/overtime/${modifyingRequest.id}/edit-after-seen`, {
        end_date: modForm.end_date,
        end_time: modForm.end_hour,
        hours_count: Number(modForm.hours_count),
        reason: modForm.reason,
      });
      toast.success('اضافه کار با موفقیت اصلاح و ثبت شد');
      setModifyingRequest(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در اصلاح اضافه کار');
    }
  };

  const deleteRequest = async (id) => {
    if (!confirm('آیا از حذف درخواست مطمئن هستید؟')) return;
    try {
      await api.delete(`/overtime/${id}/delete`);
      toast.success('درخواست حذف شد');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در حذف');
    }
  };

  const adminDeleteRequest = async (id) => {
    if (!confirm('آیا از حذف این اضافه کار مطمئن هستید؟')) return;
    try {
      await api.delete(`/overtime/${id}/admin-delete`);
      toast.success('اضافه کار حذف شد');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در حذف');
    }
  };

  const approveSupervisor = async (id) => {
    try {
      const currentComment = comments[id] || '';
      await api.put(`/overtime/${id}/approve-supervisor`, { comment: currentComment });
      toast.success('تایید شد');
      setComments(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      loadData();
    } catch (err) {
      toast.error('خطا در تایید');
    }
  };

  const rejectSupervisor = async (id) => {
    try {
      const currentComment = comments[id] || '';
      await api.put(`/overtime/${id}/reject-supervisor`, { comment: currentComment || 'رد شده' });
      toast.success('رد شد');
      setComments(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      loadData();
    } catch (err) {
      toast.error('خطا در رد درخواست');
    }
  };

  const approveManager = async (id) => {
    try {
      const currentComment = comments[id] || '';
      await api.put(`/overtime/${id}/approve-manager`, { comment: currentComment });
      toast.success('تایید نهایی شد');
      setComments(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      loadData();
    } catch (err) {
      toast.error('خطا در تایید مدیر');
    }
  };

  const rejectManager = async (id) => {
    try {
      const currentComment = comments[id] || '';
      await api.put(`/overtime/${id}/reject-manager`, { comment: currentComment || 'رد شده توسط مدیر' });
      toast.success('رد شد');
      setComments(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      loadData();
    } catch (err) {
      toast.error('خطا در رد درخواست');
    }
  };

  const seenSecurity = async (id) => {
    try {
      await api.put(`/overtime/${id}/seen-security`);
      toast.success('رویت شد');
      loadData();
    } catch (err) {
      toast.error('خطا در رویت حراست');
    }
  };

  const isSecurityUser = hasPermission('overtime_security_view');

  const tabs = [
    { id: 'my', label: 'درخواست‌های من' },
    ...((user.role === 'supervisor' || user.role === 'admin') ? [{ id: 'supervisor', label: `تایید سرپرست (${pendingSupervisor.length})` }] : []),
    ...((user.role === 'manager' || user.role === 'admin') ? [
      { id: 'manager', label: `تایید مدیر (${pendingManager.length})` },
    ] : []),
    ...(isSecurityUser ? [
      { id: 'security', label: `رویت حراست (${securityList.length})` },
    ] : []),
    ...((user.role === 'supervisor' || user.role === 'manager' || user.role === 'admin' || hasPermission('overtime_edit_after_seen')) ? [
      { id: 'all', label: (user.role === 'supervisor' && !hasPermission('overtime_edit_after_seen')) ? 'وضعیت اضافه کار پرسنل واحد' : 'همه درخواست‌ها' },
    ] : []),
    ...((user.role === 'supervisor' || user.role === 'manager' || user.role === 'admin' || hasPermission('overtime_manager_approve')) ? [
      { id: 'balance', label: 'کارکرد اضافه کار پرسنل' },
    ] : []),
  ];

  const handlePrint = (data, title) => {
    const columns = [
      { key: 'user_name', label: 'نام پرسنل' },
      { key: 'user_dept', label: 'واحد' },
      { key: 'start_date', label: 'از تاریخ' },
      { key: 'start_hour', label: 'ساعت شروع' },
      { key: 'end_date', label: 'تا تاریخ' },
      { key: 'end_hour', label: 'ساعت پایان' },
      { key: 'days_count', label: 'مدت کارکرد' },
      { key: 'status', label: 'وضعیت', render: (v) => statusMap[v]?.text || v },
      { key: 'reason', label: 'علت/دلیل' }
    ];
    printTable(title, columns, data);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-800">درخواست و مدیریت اضافه کار</h2>
          <p className="text-sm text-gray-500 mt-1">ساعت‌های مجاز برای اضافه کار دقیقاً عکس ساعات و روزهای مرخصی می‌باشد.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-xl"
        >
          ➕ ثبت درخواست جدید
        </button>
      </div>

      {/* cumulative approved hours header */}
      {tab === 'my' && balance && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-6 text-white shadow-md flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">کل کارکرد اضافه کار تایید شده</p>
              <p className="text-3xl font-extrabold mt-2">
                {balance.days > 0 ? `${balance.days} روز و ` : ''}{balance.remaining_hours} ساعت
              </p>
            </div>
            <span className="text-5xl opacity-30">⏰</span>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg animate-fade-in relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6">ثبت درخواست اضافه کار جدید</h3>
            <form onSubmit={submitRequest} className="space-y-4">
              {['admin', 'manager', 'supervisor'].includes(user.role) && (
                <div>
                  <label className="block text-sm font-medium mb-1">ثبت برای</label>
                  <div className="flex gap-4 mb-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={requestFor === 'self'} onChange={() => { setRequestFor('self'); setForm({ ...form, user_id: '' }); }} />
                      خودم
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={requestFor === 'subordinate'} onChange={() => setRequestFor('subordinate')} />
                      پرسنل زیرمجموعه
                    </label>
                  </div>
                  {requestFor === 'subordinate' && (
                    <select
                      value={form.user_id}
                      onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                      className="w-full px-4 py-3 border rounded-xl"
                      required
                    >
                      <option value="">انتخاب پرسنل...</option>
                      {subordinates.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.full_name} ({sub.role === 'supervisor' ? 'سرپرست' : 'کاربر'})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">تاریخ شروع</label>
                  <button type="button" onClick={() => setShowStartCal(!showStartCal)} className="w-full px-4 py-3 border rounded-xl text-left" dir="ltr">
                    {form.start_date || 'انتخاب تاریخ'}
                  </button>
                  {showStartCal && (
                    <div className="absolute mt-1 z-10">
                      <JalaliCalendar
                        selectedDate={form.start_date}
                        onSelect={(d) => { setForm({...form, start_date: d}); setShowStartCal(false); }}
                        showPast={user.role === 'admin'}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ساعت شروع</label>
                  <select value={form.start_hour} onChange={(e) => setForm({...form, start_hour: e.target.value})} className="w-full px-4 py-3 border rounded-xl" dir="ltr">
                    <option value="">انتخاب ساعت</option>
                    {hourOptions.map(o => (
                      <option key={`start_${o}`} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">تاریخ پایان</label>
                  <button type="button" onClick={() => setShowEndCal(!showEndCal)} className="w-full px-4 py-3 border rounded-xl text-left" dir="ltr">
                    {form.end_date || 'انتخاب تاریخ'}
                  </button>
                  {showEndCal && (
                    <div className="absolute mt-1 z-10">
                      <JalaliCalendar
                        selectedDate={form.end_date}
                        onSelect={(d) => { setForm({...form, end_date: d}); setShowEndCal(false); }}
                        showPast={user.role === 'admin'}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ساعت پایان</label>
                  <select value={form.end_hour} onChange={(e) => setForm({...form, end_hour: e.target.value})} className="w-full px-4 py-3 border rounded-xl" dir="ltr">
                    <option value="">انتخاب ساعت</option>
                    {hourOptions.map(o => (
                      <option key={`end_${o}`} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              {calculation && (
                <div className="bg-primary-50 p-4 rounded-xl text-primary-700 text-sm font-medium border border-primary-100">
                  در صورت تائید، {calculation.days > 0 ? `${calculation.days} روز و ` : ''}{calculation.remaining_hours} ساعت کارکرد اضافه کار برای {requestFor === 'subordinate' ? 'پرسنل مورد نظر' : 'شما'} ثبت می‌شود.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">دلیل کارکرد / جزئیات کار محوله</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({...form, reason: e.target.value})}
                  className="w-full px-4 py-3 border rounded-xl"
                  rows="3"
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold">ثبت درخواست</button>
                <button type="button" onClick={closeForm} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg animate-fade-in relative">
            <h3 className="text-lg font-bold mb-6">ویرایش درخواست اضافه کار</h3>
            <form onSubmit={submitEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">تاریخ شروع</label>
                  <button type="button" onClick={() => setEditShowStartCal(!editShowStartCal)} className="w-full px-4 py-3 border rounded-xl text-left" dir="ltr">
                    {editForm.start_date || 'انتخاب تاریخ'}
                  </button>
                  {editShowStartCal && (
                    <div className="absolute mt-1 z-10">
                      <JalaliCalendar
                        selectedDate={editForm.start_date}
                        onSelect={(d) => { setEditForm({...editForm, start_date: d}); setEditShowStartCal(false); }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ساعت شروع</label>
                  <select value={editForm.start_hour} onChange={(e) => setEditForm({...editForm, start_hour: e.target.value})} className="w-full px-4 py-3 border rounded-xl" dir="ltr">
                    <option value="">انتخاب ساعت</option>
                    {hourOptions.map(o => (
                      <option key={`edit_start_${o}`} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">تاریخ پایان</label>
                  <button type="button" onClick={() => setEditShowEndCal(!editShowEndCal)} className="w-full px-4 py-3 border rounded-xl text-left" dir="ltr">
                    {editForm.end_date || 'انتخاب تاریخ'}
                  </button>
                  {editShowEndCal && (
                    <div className="absolute mt-1 z-10">
                      <JalaliCalendar
                        selectedDate={editForm.end_date}
                        onSelect={(d) => { setEditForm({...editForm, end_date: d}); setEditShowEndCal(false); }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ساعت پایان</label>
                  <select value={editForm.end_hour} onChange={(e) => setEditForm({...editForm, end_hour: e.target.value})} className="w-full px-4 py-3 border rounded-xl" dir="ltr">
                    <option value="">انتخاب ساعت</option>
                    {hourOptions.map(o => (
                      <option key={`edit_end_${o}`} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editCalculation && (
                <div className="bg-primary-50 p-4 rounded-xl text-primary-700 text-sm font-medium border border-primary-100">
                  در صورت تائید، {editCalculation.days > 0 ? `${editCalculation.days} روز و ` : ''}{editCalculation.remaining_hours} ساعت کارکرد اضافه کار برای شما ثبت می‌شود.
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">دلیل اضافه کار</label>
                <textarea
                  value={editForm.reason}
                  onChange={(e) => setEditForm({...editForm, reason: e.target.value})}
                  className="w-full px-4 py-3 border rounded-xl"
                  rows="3"
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold">ذخیره</button>
                <button type="button" onClick={() => setEditId(null)} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modifyingRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg animate-fade-in relative">
            <h3 className="text-lg font-bold mb-4">ویرایش و اصلاح اضافه کار (پس از رویت حراست)</h3>
            <p className="text-xs text-gray-500 mb-4">کاربر: {modifyingRequest.user_name} | شروع: {modifyingRequest.start_date} ساعت {modifyingRequest.start_hour}</p>
            <form onSubmit={submitRequestModification} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">تاریخ پایان جدید</label>
                  <button type="button" onClick={() => setModForm(prev => ({ ...prev, showEndCal: !prev.showEndCal }))} className="w-full px-4 py-3 border rounded-xl text-left" dir="ltr">
                    {modForm.end_date || 'انتخاب تاریخ'}
                  </button>
                  {modForm.showEndCal && (
                    <div className="absolute mt-1 z-10">
                      <JalaliCalendar
                        selectedDate={modForm.end_date}
                        onSelect={(d) => { setModForm(prev => ({ ...prev, end_date: d, showEndCal: false })); }}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ساعت پایان جدید</label>
                  <select value={modForm.end_hour} onChange={(e) => setModForm(prev => ({ ...prev, end_hour: e.target.value }))} className="w-full px-4 py-3 border rounded-xl" dir="ltr">
                    <option value="">انتخاب ساعت</option>
                    {hourOptions.map(o => (
                      <option key={`mod_end_${o}`} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-orange-50 p-4 rounded-xl text-orange-700 text-sm font-medium border border-orange-100">
                کارکرد نهایی محاسبه شده: {modForm.hours_count} ساعت
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">علت تغییر کارکرد</label>
                <textarea
                  value={modForm.reason}
                  onChange={(e) => setModForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-4 py-3 border rounded-xl"
                  rows="3"
                  required
                  placeholder="مثلاً: خروج زودتر از موعد به دلیل ماموریت"
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-bold">ثبت تغییرات نهایی</button>
                <button type="button" onClick={() => setModifyingRequest(null)} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              tab === t.id ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {tab === 'my' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{myRequests.length} درخواست</p>
              <button onClick={() => handlePrint(myRequests, 'اضافه کارهای من')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                🖨️ چاپ
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-right">سازه زمانی</th>
                  <th className="p-3 text-right">مدت</th>
                  <th className="p-3 text-right">وضعیت</th>
                  <th className="p-3 text-right">توضیحات و فرآیند تایید</th>
                  <th className="p-3 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map(reqItem => (
                  <tr key={reqItem.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 text-gray-700">
                      از {reqItem.start_date} ساعت {reqItem.start_hour} <br/>
                      تا {reqItem.end_date} ساعت {reqItem.end_hour}
                    </td>
                    <td className="p-3 font-bold text-gray-800">{reqItem.days_count}</td>
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusMap[reqItem.status]?.color}`}>
                        {statusMap[reqItem.status]?.text}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500 text-xs space-y-1">
                      {reqItem.reason && (
                        <div>
                          <span className="font-medium text-gray-600">علت کار:</span> {reqItem.reason}
                        </div>
                      )}
                      {reqItem.supervisor_comment && (
                        <div className="text-blue-600">
                          <span className="font-medium">سرپرست ({reqItem.supervisor_name || 'نامشخص'}):</span> {reqItem.supervisor_comment}
                        </div>
                      )}
                      {reqItem.manager_comment && (
                        <div className="text-green-600">
                          <span className="font-medium">مدیر ({reqItem.manager_name || 'نامشخص'}):</span> {reqItem.manager_comment}
                        </div>
                      )}
                      {reqItem.status === 'seen_security' && (
                        <div className="text-purple-600">
                          <span className="font-medium">رویت حراست:</span> رویت شده توسط {reqItem.security_name || 'حراست'} {reqItem.security_date ? `در ${reqItem.security_date}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      {reqItem.status === 'pending_supervisor' && (
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(reqItem)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">ویرایش</button>
                          <button onClick={() => deleteRequest(reqItem.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">حذف</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myRequests.length === 0 && <p className="text-center text-gray-400 py-8">درخواستی ثبت نشده</p>}
          </div>
        )}

        {tab === 'supervisor' && (
          <div className="p-6 space-y-4">
            {pendingSupervisor.length === 0 && <p className="text-center text-gray-400 py-8">درخواستی در انتظار تایید نیست</p>}
            {pendingSupervisor.map(reqItem => (
              <div key={reqItem.id} className="border rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{reqItem.user_name}</p>
                    <p className="text-sm text-gray-500">{reqItem.user_dept}</p>
                    <p className="text-sm mt-2">اضافه کار به مدت {reqItem.days_count} (شروع {reqItem.start_date} {reqItem.start_hour} تا {reqItem.end_date} {reqItem.end_hour})</p>
                    {reqItem.reason && <p className="text-sm text-gray-500 mt-1 font-medium">علت: {reqItem.reason}</p>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="توضیحات"
                      value={comments[reqItem.id] || ''}
                      onChange={(e) => setComments({ ...comments, [reqItem.id]: e.target.value })}
                      className="px-3 py-2 border rounded-lg text-sm w-40"
                    />
                    <button onClick={() => approveSupervisor(reqItem.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium">تایید</button>
                    <button onClick={() => rejectSupervisor(reqItem.id)} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium">رد</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'manager' && (
          <div className="p-6 space-y-4">
            {pendingManager.length === 0 && <p className="text-center text-gray-400 py-8">درخواستی در انتظار تایید مدیر نیست</p>}
            {pendingManager.map(reqItem => (
              <div key={reqItem.id} className="border rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{reqItem.user_name}</p>
                    <p className="text-sm text-gray-500">{reqItem.user_dept} | سرپرست: {reqItem.supervisor_name}</p>
                    <p className="text-sm mt-2">اضافه کار به مدت {reqItem.days_count} (شروع {reqItem.start_date} {reqItem.start_hour} تا {reqItem.end_date} {reqItem.end_hour})</p>
                    {reqItem.reason && <p className="text-sm text-gray-500 mt-1 font-medium">علت: {reqItem.reason}</p>}
                    {reqItem.supervisor_comment && (
                      <p className="text-xs text-blue-500 mt-1">
                        نظر سرپرست ({reqItem.supervisor_name || 'نامشخص'}): {reqItem.supervisor_comment}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="توضیحات" value={comments[reqItem.id] || ''} onChange={(e) => setComments({ ...comments, [reqItem.id]: e.target.value })} className="px-3 py-2 border rounded-lg text-sm w-40" />
                    <button onClick={() => approveManager(reqItem.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium">تایید</button>
                    <button onClick={() => rejectManager(reqItem.id)} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium">رد</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'security' && (
          <div className="p-6 space-y-4">
            {securityList.length === 0 && <p className="text-center text-gray-400 py-8">اضافه کار تایید شده‌ای برای رویت وجود ندارد</p>}
            {securityList.map(reqItem => (
              <div key={reqItem.id} className="border rounded-xl p-4 flex justify-between items-center bg-green-50/30">
                <div>
                  <p className="font-bold text-gray-800">{reqItem.user_name}</p>
                  <p className="text-sm text-gray-500">{reqItem.user_dept}</p>
                  <p className="text-sm mt-1">مدت کارکرد: {reqItem.days_count}</p>
                  <p className="text-xs text-gray-600 mt-0.5">شروع: {reqItem.start_date} ساعت {reqItem.start_hour} | پایان: {reqItem.end_date} ساعت {reqItem.end_hour}</p>
                </div>
                <button onClick={() => seenSecurity(reqItem.id)} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-md">
                  👁️ رویت شد
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'all' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="جستجو نام..."
                  value={allRequestsSearch}
                  onChange={(e) => setAllRequestsSearch(e.target.value)}
                  className="px-3 py-2 border rounded-xl text-sm w-64"
                />
                <p className="text-sm text-gray-500">{allRequestsTotal} درخواست</p>
              </div>
              <button onClick={() => handlePrint(allRequests, 'همه درخواست‌های اضافه کار')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                🖨️ چاپ کل گزارش
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-right">کاربر</th>
                  <th className="p-3 text-right">واحد</th>
                  <th className="p-3 text-right">زمان کاری</th>
                  <th className="p-3 text-right">مدت</th>
                  <th className="p-3 text-right">وضعیت</th>
                  <th className="p-3 text-right">فرآیند تایید و دلایل</th>
                  <th className="p-3 text-right">عملیات ادمین</th>
                </tr>
              </thead>
              <tbody>
                {allRequests.map(reqItem => (
                  <tr key={reqItem.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{reqItem.user_name}</td>
                    <td className="p-3">{reqItem.user_dept}</td>
                    <td className="p-3 text-gray-700 text-xs">
                      از {reqItem.start_date} ساعت {reqItem.start_hour} <br/>
                      تا {reqItem.end_date} ساعت {reqItem.end_hour}
                    </td>
                    <td className="p-3 font-bold">{reqItem.days_count}</td>
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusMap[reqItem.status]?.color}`}>
                        {statusMap[reqItem.status]?.text}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500 text-[11px] space-y-1">
                      {reqItem.reason && <div><span className="font-semibold text-gray-600">دلیل:</span> {reqItem.reason}</div>}
                      {reqItem.supervisor_name && <div className="text-blue-600"><span className="font-semibold">تایید سرپرست:</span> {reqItem.supervisor_name} {reqItem.supervisor_comment ? `(${reqItem.supervisor_comment})` : ''}</div>}
                      {reqItem.manager_name && <div className="text-green-600"><span className="font-semibold">تایید مدیر:</span> {reqItem.manager_name} {reqItem.manager_comment ? `(${reqItem.manager_comment})` : ''}</div>}
                      {reqItem.security_name && <div className="text-purple-600"><span className="font-semibold">رویت حراست:</span> {reqItem.security_name} {reqItem.security_date ? `(${formatDateTime(reqItem.security_date)})` : ''}</div>}
                      {reqItem.edited_by && <div className="text-orange-600 font-medium"><span className="font-semibold">اصلاح توسط:</span> {reqItem.editor_name} {reqItem.edited_at ? `(${formatDateTime(reqItem.edited_at)})` : ''} {reqItem.edit_reason ? `- علت: ${reqItem.edit_reason}` : ''}</div>}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        {user.role === 'admin' && (
                          <button onClick={() => adminDeleteRequest(reqItem.id)} className="bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded text-xs transition-colors">حذف ادمین</button>
                        )}
                        {reqItem.status === 'seen_security' && !reqItem.edited_by && (hasPermission('overtime_edit_after_seen') || user.role === 'admin') && (
                          <button onClick={() => openModifyRequest(reqItem)} className="bg-orange-50 hover:bg-orange-100 text-orange-600 px-2 py-1 rounded text-xs transition-colors">کاهش/اصلاح</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={allRequestsPage} total={allRequestsTotal} limit={50} onChange={setAllRequestsPage} />
          </div>
        )}

        {tab === 'balance' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">مجموع کارکرد اضافه کار تایید شده کل پرسنل</p>
              <button
                onClick={() => {
                  const cols = [
                    { key: 'full_name', label: 'نام پرسنل' },
                    { key: 'department_name', label: 'واحد' },
                    { key: 'total_hours', label: 'کارکرد (ساعت)' },
                    { key: 'days', label: 'کارکرد (روز و ساعت)', render: (v, r) => `${r.days} روز و ${r.remaining_hours} ساعت` }
                  ];
                  printTable('گزارش کلی کارکرد اضافه کار پرسنل', cols, balanceAll);
                }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
              >
                🖨️ چاپ لیست کارکردها
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-right">پرسنل</th>
                  <th className="p-3 text-right">واحد</th>
                  <th className="p-3 text-right">مجموع ساعت کارکرد</th>
                  <th className="p-3 text-right">معادل روز و ساعت</th>
                </tr>
              </thead>
              <tbody>
                {balanceAll.map(b => (
                  <tr key={b.user_id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{b.full_name}</td>
                    <td className="p-3">{b.department_name || '-'}</td>
                    <td className="p-3 font-bold text-green-600">{b.total_hours} ساعت</td>
                    <td className="p-3 text-gray-700">{b.days} روز و {b.remaining_hours} ساعت</td>
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
