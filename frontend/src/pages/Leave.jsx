import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import moment from 'moment-jalaali';
import toast from 'react-hot-toast';
import JalaliCalendar from '../components/JalaliCalendar';
import { printLeaveAll, printTable } from '../utils/printUtils';

const statusMap = {
  pending_supervisor: { text: 'در انتظار سرپرست', color: 'bg-blue-100 text-blue-700' },
  pending_manager: { text: 'در انتظار مدیر', color: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'تایید شده', color: 'bg-green-100 text-green-700' },
  rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
  seen_security: { text: 'رویت شده (حراست)', color: 'bg-purple-100 text-purple-700' },
};

export default function Leave() {
  const { user } = useAuth();
  const [tab, setTab] = useState('my');
  const [myRequests, setMyRequests] = useState([]);
  const [pendingSupervisor, setPendingSupervisor] = useState([]);
  const [pendingManager, setPendingManager] = useState([]);
  const [securityList, setSecurityList] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [balanceAll, setBalanceAll] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [holidayForm, setHolidayForm] = useState({ holiday_date: '', title: '' });
  const [showHolidayCal, setShowHolidayCal] = useState(false);
  const [calculation, setCalculation] = useState(null);
  const [editCalculation, setEditCalculation] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState('');
  const [form, setForm] = useState({ user_id: '', start_date: '', start_hour: '', end_date: '', end_hour: '', reason: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ start_date: '', start_hour: '', end_date: '', end_hour: '', reason: '' });
  const [showStartCal, setShowStartCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);
  const [editShowStartCal, setEditShowStartCal] = useState(false);
  const [editShowEndCal, setEditShowEndCal] = useState(false);

  useEffect(() => {
    if (user && ['admin', 'manager', 'supervisor'].includes(user.role)) {
      api.get('/leave/subordinates')
        .then(res => setSubordinates(res.data))
        .catch(err => console.error('Error fetching subordinates', err));
    }
  }, [user]);

  useEffect(() => {
    if (form.start_date && form.start_hour && form.end_date && form.end_hour) {
      api.get('/leave/calculate', {
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
      api.get('/leave/calculate', {
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
  }, [tab]);

  const loadData = async () => {
    try {
      if (tab === 'my') {
        const [myRes, balRes] = await Promise.all([
          api.get('/leave/my-requests'),
          api.get('/leave/balance')
        ]);
        setMyRequests(myRes.data);
        setBalance(balRes.data);
      } else if (tab === 'supervisor') {
        const res = await api.get('/leave/pending-supervisor');
        setPendingSupervisor(res.data);
      } else if (tab === 'manager') {
        const mgrRes = await api.get('/leave/pending-manager');
        setPendingManager(mgrRes.data);
      } else if (tab === 'security') {
        const secRes = await api.get('/leave/security');
        setSecurityList(secRes.data);
      } else if (tab === 'all') {
        const allRes = await api.get('/leave/all');
        setAllLeaves(allRes.data);
      } else if (tab === 'balance') {
        const balAllRes = await api.get('/leave/balance-all');
        setBalanceAll(balAllRes.data);
      } else if (tab === 'holidays') {
        const holRes = await api.get('/leave/holidays');
        setHolidays(holRes.data);
      }
    } catch (err) {
      toast.error('خطا در بارگذاری اطلاعات');
    }
  };

  const addHoliday = async (e) => {
    e.preventDefault();
    try {
      if (!holidayForm.holiday_date) {
        toast.error('تاریخ تعطیل را انتخاب کنید');
        return;
      }
      await api.post('/leave/holidays', holidayForm);
      toast.success('تعطیلی ثبت شد');
      setHolidayForm({ holiday_date: '', title: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ثبت تعطیلی');
    }
  };

  const deleteHoliday = async (id) => {
    if (!confirm('آیا از حذف این تعطیلی مطمئن هستید؟')) return;
    try {
      await api.delete(`/leave/holidays/${id}`);
      toast.success('تعطیلی حذف شد');
      loadData();
    } catch (err) {
      toast.error('خطا در حذف تعطیلی');
    }
  };

  const handleCsvImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/);
        const holidays = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const firstCommaIdx = line.indexOf(',');
          if (firstCommaIdx === -1) continue;

          const date = line.substring(0, firstCommaIdx).trim();
          const title = line.substring(firstCommaIdx + 1).trim();

          if (date && date.includes('/')) {
            holidays.push({ holiday_date: date, title });
          }
        }

        if (holidays.length === 0) {
          toast.error('هیچ داده معتبری در فایل پیدا نشد');
          return;
        }

        const res = await api.post('/leave/holidays/import', { holidays });
        toast.success(res.data.message || 'تعطیلات با موفقیت وارد شدند');
        loadData();
      } catch (err) {
        toast.error(err.response?.data?.error || 'خطا در بارگذاری فایل CSV');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    try {
      if (!form.start_date || !form.start_hour || !form.end_date || !form.end_hour) {
        toast.error('پر کردن تمام فیلدهای تاریخ و ساعت الزامی است');
        return;
      }
      const today = moment().format('jYYYY/jMM/jDD');
      if (form.start_date < today) {
        toast.error('امکان ثبت مرخصی برای تاریخ گذشته وجود ندارد');
        return;
      }
      await api.post('/leave', {
        user_id: form.user_id,
        start_date: form.start_date,
        start_time: form.start_hour,
        end_date: form.end_date,
        end_time: form.end_hour,
        reason: form.reason
      });
      toast.success('درخواست مرخصی ثبت شد');
      setShowForm(false);
      setForm({ user_id: '', start_date: '', start_hour: '', end_date: '', end_hour: '', reason: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ثبت درخواست');
    }
  };

  const openEdit = (leave) => {
    setEditId(leave.id);
    setEditForm({
      start_date: leave.start_date,
      end_date: leave.end_date,
      reason: leave.reason || '',
      start_hour: leave.start_hour || '',
      end_hour: leave.end_hour || '',
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    try {
      if (!editForm.start_date || !editForm.start_hour || !editForm.end_date || !editForm.end_hour) {
        toast.error('پر کردن تمام فیلدهای تاریخ و ساعت الزامی است');
        return;
      }
      await api.put(`/leave/${editId}/edit`, {
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

  const deleteRequest = async (id) => {
    if (!confirm('آیا از حذف درخواست مطمئن هستید؟')) return;
    try {
      await api.delete(`/leave/${id}/delete`);
      toast.success('درخواست حذف شد');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در حذف');
    }
  };

  const adminDeleteLeave = async (id) => {
    if (!confirm('آیا از حذف این مرخصی مطمئن هستید؟\nمانده مرخصی کاربر بازگردانده می‌شود.')) return;
    try {
      await api.delete(`/leave/${id}/admin-delete`);
      toast.success('مرخصی حذف شد و مانده بازگردانده شد');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در حذف');
    }
  };

  const approveSupervisor = async (id) => {
    try {
      await api.put(`/leave/${id}/approve-supervisor`, { comment });
      toast.success('تایید شد');
      setComment('');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const rejectSupervisor = async (id) => {
    try {
      await api.put(`/leave/${id}/reject-supervisor`, { comment: comment || 'رد شده' });
      toast.success('رد شد');
      setComment('');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const approveManager = async (id) => {
    try {
      await api.put(`/leave/${id}/approve-manager`, { comment });
      toast.success('تایید نهایی شد');
      setComment('');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const rejectManager = async (id) => {
    try {
      await api.put(`/leave/${id}/reject-manager`, { comment: comment || 'رد شده توسط مدیر' });
      toast.success('رد شد');
      setComment('');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const seenSecurity = async (id) => {
    try {
      await api.put(`/leave/${id}/seen-security`);
      toast.success('رویت شد');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const tabs = [
    { id: 'my', label: 'درخواست‌های من' },
    ...((user.role === 'supervisor' || user.role === 'admin') ? [{ id: 'supervisor', label: `تایید سرپرست (${pendingSupervisor.length})` }] : []),
    ...((user.role === 'manager' || user.role === 'admin') ? [
      { id: 'manager', label: `تایید مدیر (${pendingManager.length})` },
      { id: 'security', label: `رویت حراست (${securityList.length})` },
    ] : []),
    ...((user.role === 'supervisor' || user.role === 'manager' || user.role === 'admin') ? [
      { id: 'all', label: user.role === 'supervisor' ? 'وضعیت مرخصی پرسنل واحد' : 'همه درخواست‌ها' },
      { id: 'balance', label: user.role === 'supervisor' ? 'مانده مرخصی پرسنل واحد' : 'مانده مرخصی کارکنان' },
    ] : []),
    ...((user.role === 'admin') ? [{ id: 'holidays', label: 'مدیریت تعطیلات رسمی' }] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">مدیریت مرخصی</h2>
          {balance && (
            <p className="text-sm text-gray-500 mt-1">
              مانده مرخصی شما: <span className="font-bold text-green-600">{balance.remaining_days} روز و {balance.remaining_hours_only} ساعت</span> از {balance.total_days} روز
            </p>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-xl font-medium transition-colors"
        >
          + درخواست جدید
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg animate-fade-in relative">
            <h3 className="text-lg font-bold mb-6">درخواست مرخصی جدید</h3>
            <form onSubmit={submitRequest} className="space-y-4">
              {subordinates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">پرسنل مورد نظر</label>
                  <select
                    value={form.user_id}
                    onChange={(e) => setForm({...form, user_id: e.target.value})}
                    className="w-full px-4 py-3 border rounded-xl"
                  >
                    <option value="">ثبت برای خود ({user.full_name})</option>
                    {subordinates.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
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
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ساعت شروع</label>
                  <select value={form.start_hour} onChange={(e) => setForm({...form, start_hour: e.target.value})} className="w-full px-4 py-3 border rounded-xl" dir="ltr">
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
                    <option value="17:00">17:00</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                      />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ساعت پایان</label>
                  <select value={form.end_hour} onChange={(e) => setForm({...form, end_hour: e.target.value})} className="w-full px-4 py-3 border rounded-xl" dir="ltr">
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
                    <option value="17:00">17:00</option>
                  </select>
                </div>
              </div>

              {calculation && (
                <div className="bg-primary-50 p-4 rounded-xl text-primary-700 text-sm font-medium border border-primary-100">
                  در صورت تائید این مرخصی {calculation.days} روز و {calculation.remaining_hours} ساعت از سهمیه شما کم خواهد شد
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">دلیل مرخصی</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({...form, reason: e.target.value})}
                  className="w-full px-4 py-3 border rounded-xl"
                  rows="3"
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold">ثبت درخواست</button>
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg animate-fade-in relative">
            <h3 className="text-lg font-bold mb-6">ویرایش درخواست مرخصی</h3>
            <form onSubmit={submitEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                    <option value="17:00">17:00</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                    <option value="17:00">17:00</option>
                  </select>
                </div>
              </div>

              {editCalculation && (
                <div className="bg-primary-50 p-4 rounded-xl text-primary-700 text-sm font-medium border border-primary-100">
                  در صورت تائید این مرخصی {editCalculation.days} روز و {editCalculation.remaining_hours} ساعت از سهمیه شما کم خواهد شد
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">دلیل مرخصی</label>
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
              <button onClick={() => printLeaveAll(myRequests)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                چاپ
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-right">نوع</th>
                  <th className="p-3 text-right">از تاریخ</th>
                  <th className="p-3 text-right">تا تاریخ</th>
                  <th className="p-3 text-right">روزها</th>
                  <th className="p-3 text-right">وضعیت</th>
                  <th className="p-3 text-right">توضیحات</th>
                  <th className="p-3 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map(leave => (
                  <tr key={leave.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{leave.leave_type}</td>
                    <td className="p-3" dir="ltr">{leave.start_date}</td>
                    <td className="p-3" dir="ltr">{leave.end_date}</td>
                    <td className="p-3 font-bold">{leave.days_count}</td>
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusMap[leave.status]?.color}`}>
                        {statusMap[leave.status]?.text}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500 text-xs">{leave.supervisor_comment || leave.manager_comment || leave.reason}</td>
                    <td className="p-3">
                      {leave.status === 'pending_supervisor' && (
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(leave)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">ویرایش</button>
                          <button onClick={() => deleteRequest(leave.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">حذف</button>
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
            {pendingSupervisor.map(leave => (
              <div key={leave.id} className="border rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{leave.user_name}</p>
                    <p className="text-sm text-gray-500">{leave.user_dept}</p>
                    <p className="text-sm mt-2">{leave.leave_type} - {leave.days_count} روز ({leave.start_date} تا {leave.end_date})</p>
                    {leave.reason && <p className="text-sm text-gray-500 mt-1">دلیل: {leave.reason}</p>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="توضیحات"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="px-3 py-2 border rounded-lg text-sm w-40"
                    />
                    <button onClick={() => approveSupervisor(leave.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium">تایید</button>
                    <button onClick={() => rejectSupervisor(leave.id)} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium">رد</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'manager' && (
          <div className="p-6 space-y-4">
            {pendingManager.length === 0 && <p className="text-center text-gray-400 py-8">درخواستی در انتظار تایید مدیر نیست</p>}
            {pendingManager.map(leave => (
              <div key={leave.id} className="border rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">{leave.user_name}</p>
                    <p className="text-sm text-gray-500">{leave.user_dept} | سرپرست: {leave.supervisor_name}</p>
                    <p className="text-sm mt-2">{leave.leave_type} - {leave.days_count} روز ({leave.start_date} تا {leave.end_date})</p>
                    {leave.supervisor_comment && <p className="text-xs text-blue-500 mt-1">نظر سرپرست: {leave.supervisor_comment}</p>}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="توضیحات" value={comment} onChange={(e) => setComment(e.target.value)} className="px-3 py-2 border rounded-lg text-sm w-40" />
                    <button onClick={() => approveManager(leave.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium">تایید</button>
                    <button onClick={() => rejectManager(leave.id)} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium">رد</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'security' && (
          <div className="p-6 space-y-4">
            {securityList.length === 0 && <p className="text-center text-gray-400 py-8">مرخصی تایید شده‌ای برای رویت وجود ندارد</p>}
            {securityList.map(leave => (
              <div key={leave.id} className="border rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="font-bold">{leave.user_name} - {leave.user_dept}</p>
                  <p className="text-sm text-gray-500">{leave.leave_type} ({leave.start_date} تا {leave.end_date})</p>
                </div>
                <button onClick={() => seenSecurity(leave.id)} className="bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium">رویت شد</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'all' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{allLeaves.length} درخواست</p>
              <button onClick={() => printLeaveAll(allLeaves)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                چاپ لیست
              </button>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-right">نام</th>
                  <th className="p-3 text-right">واحد</th>
                  <th className="p-3 text-right">نوع</th>
                  <th className="p-3 text-right">از</th>
                  <th className="p-3 text-right">تا</th>
                  <th className="p-3 text-right">روزها</th>
                  <th className="p-3 text-right">وضعیت</th>
                  {user.role === 'admin' && <th className="p-3 text-right">عملیات</th>}
                </tr>
              </thead>
              <tbody>
                {allLeaves.map(leave => (
                  <tr key={leave.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{leave.user_name}</td>
                    <td className="p-3">{leave.user_dept}</td>
                    <td className="p-3">{leave.leave_type}</td>
                    <td className="p-3" dir="ltr">{leave.start_date}</td>
                    <td className="p-3" dir="ltr">{leave.end_date}</td>
                    <td className="p-3 font-bold">{leave.days_count}</td>
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusMap[leave.status]?.color}`}>
                        {statusMap[leave.status]?.text}
                      </span>
                    </td>
                    {user.role === 'admin' && (
                      <td className="p-3">
                        <button onClick={() => adminDeleteLeave(leave.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">حذف</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {tab === 'balance' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{balanceAll.length} نفر</p>
              <button onClick={() => printTable('مانده مرخصی کارکنان', [
                { key: 'full_name', label: 'نام' },
                { key: 'department_name', label: 'واحد' },
                { key: 'total_days', label: 'کل روزها' },
                { key: 'used_days', label: 'استفاده شده' },
                { key: 'remaining_days', label: 'مانده' },
              ], balanceAll.map(b => ({
                ...b,
                used_days: `${b.used_days_display} روز و ${b.used_hours_display} ساعت`,
                remaining_days: `${b.remaining_days} روز و ${b.remaining_hours_only} ساعت`
              })))} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                چاپ
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-right">نام</th>
                  <th className="p-3 text-right">واحد</th>
                  <th className="p-3 text-right">کل روزها</th>
                  <th className="p-3 text-right">استفاده شده</th>
                  <th className="p-3 text-right">مانده</th>
                </tr>
              </thead>
              <tbody>
                {balanceAll.map(b => (
                  <tr key={b.user_id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-bold">{b.full_name}</td>
                    <td className="p-3">{b.department_name}</td>
                    <td className="p-3">{b.total_days}</td>
                    <td className="p-3 text-red-500">{b.used_days_display} روز و {b.used_hours_display} ساعت</td>
                    <td className="p-3 text-green-600 font-bold">{b.remaining_days} روز و {b.remaining_hours_only} ساعت</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'holidays' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">مدیریت تعطیلات رسمی</h3>
              <label className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                وارد کردن دسته جمعی (CSV)
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvImport}
                  className="hidden"
                />
              </label>
            </div>
            <form onSubmit={addHoliday} className="bg-gray-50 p-6 rounded-2xl mb-6 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px] relative">
                <label className="block text-sm font-medium mb-1">تاریخ تعطیلی</label>
                <button type="button" onClick={() => setShowHolidayCal(!showHolidayCal)} className="w-full px-4 py-3 bg-white border rounded-xl text-left" dir="ltr">
                  {holidayForm.holiday_date || 'انتخاب تاریخ'}
                </button>
                {showHolidayCal && (
                  <div className="absolute mt-1 z-10">
                    <JalaliCalendar
                      selectedDate={holidayForm.holiday_date}
                      onSelect={(d) => { setHolidayForm({...holidayForm, holiday_date: d}); setShowHolidayCal(false); }}
                    />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium mb-1">عنوان / مناسبت (اختیاری)</label>
                <input
                  type="text"
                  value={holidayForm.title}
                  onChange={(e) => setHolidayForm({...holidayForm, title: e.target.value})}
                  placeholder="مثال: عید نوروز"
                  className="w-full px-4 py-3 border rounded-xl"
                />
              </div>
              <button type="submit" className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">
                + افزودن تعطیلی
              </button>
            </form>

            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-right">تاریخ</th>
                  <th className="p-3 text-right">مناسبت</th>
                  <th className="p-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {holidays.map(h => (
                  <tr key={h.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-mono" dir="ltr">{h.holiday_date}</td>
                    <td className="p-3 text-gray-700">{h.title || 'بدون عنوان'}</td>
                    <td className="p-3 text-center">
                      <button onClick={() => deleteHoliday(h.id)} className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
                {holidays.length === 0 && (
                  <tr>
                    <td colSpan="3" className="p-4 text-center text-gray-500">هیچ روز تعطیلی ثبت نشده است</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
