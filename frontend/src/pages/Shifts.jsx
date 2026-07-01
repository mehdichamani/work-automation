import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Shifts() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [myShift, setMyShift] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ name: '', start_time: '', end_time: '', description: '', color: '#3b82f6' });
  const [requestForm, setRequestForm] = useState({ requested_shift_id: '', reason: '', requested_date: '' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const isManager = useMemo(() => ['admin', 'manager', 'supervisor'].includes(user?.role), [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [shiftsRes, myRes, assignmentsRes, reqRes] = await Promise.all([
        api.get('/shifts'),
        api.get('/shifts/my'),
        isManager ? api.get('/shifts/assignments') : Promise.resolve({ data: [] }),
        api.get('/shifts/requests/my')
      ]);
      setShifts(shiftsRes.data || []);
      setMyShift(myRes.data?.current_shift || null);
      setAssignments(assignmentsRes.data || []);
      setRequests(reqRes.data || []);
    } catch (err) {
      toast.error('خطا در بارگذاری شیفت‌ها');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!isManager) return;
    try {
      if (editingId) {
        await api.put(`/shifts/${editingId}`, form);
        toast.success('شیفت ویرایش شد');
      } else {
        await api.post('/shifts', form);
        toast.success('شیفت ایجاد شد');
      }
      setForm({ name: '', start_time: '', end_time: '', description: '', color: '#3b82f6' });
      setEditingId(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ذخیره شیفت');
    }
  };

  const startEdit = (shift) => {
    setEditingId(shift.id);
    setForm({ name: shift.name, start_time: shift.start_time || '', end_time: shift.end_time || '', description: shift.description || '', color: shift.color || '#3b82f6' });
  };

  const deleteShift = async (id) => {
    if (!isManager) return;
    if (!window.confirm('آیا از غیرفعال کردن این شیفت مطمئن هستید؟')) return;
    try {
      await api.delete(`/shifts/${id}`);
      toast.success('شیفت غیرفعال شد');
      loadData();
    } catch (err) {
      toast.error('خطا در حذف شیفت');
    }
  };

  const assignShift = async (userId, shiftId) => {
    if (!isManager) return;
    try {
      await api.post('/shifts/assignments', { user_id: userId, shift_id: shiftId });
      toast.success('شیفت کاربر تنظیم شد');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در تنظیم شیفت');
    }
  };

  const submitChangeRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post('/shifts/requests', requestForm);
      toast.success('درخواست تغییر شیفت ثبت شد');
      setRequestForm({ requested_shift_id: '', reason: '', requested_date: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ثبت درخواست');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">مدیریت شیفت‌های کاری</h1>
        <p className="text-primary-100 mt-1">تعریف شیفت‌های جدید، انتساب به کارمندان و ثبت درخواست تغییر شیفت</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">شیفت فعلی شما</h2>
          </div>
          {myShift ? (
            <div className="rounded-xl border p-4" style={{ borderColor: myShift.color || '#3b82f6' }}>
              <p className="font-bold text-lg">{myShift.name}</p>
              <p className="text-sm text-gray-600 mt-1">{myShift.description || 'شیفت تعیین شده'}</p>
              <p className="text-sm text-gray-500 mt-2">ساعت شروع: {myShift.start_time || '—'} | ساعت پایان: {myShift.end_time || '—'}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">هنوز شیفتی به شما اختصاص داده نشده است.</p>
          )}

          <form onSubmit={submitChangeRequest} className="mt-6 space-y-3">
            <h3 className="font-bold text-gray-800">درخواست تغییر شیفت</h3>
            <select value={requestForm.requested_shift_id} onChange={(e) => setRequestForm({ ...requestForm, requested_shift_id: e.target.value })} className="w-full border rounded-xl px-3 py-2" required>
              <option value="">شیفت درخواستی را انتخاب کنید</option>
              {shifts.map(shift => (
                <option key={shift.id} value={shift.id}>{shift.name}</option>
              ))}
            </select>
            <input type="text" value={requestForm.requested_date} onChange={(e) => setRequestForm({ ...requestForm, requested_date: e.target.value })} className="w-full border rounded-xl px-3 py-2" placeholder="تاریخ مورد نظر (اختیاری)" />
            <textarea value={requestForm.reason} onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })} className="w-full border rounded-xl px-3 py-2" placeholder="دلیل درخواست" rows="3" />
            <button className="w-full bg-primary-500 text-white py-2 rounded-xl font-medium">ثبت درخواست</button>
          </form>
        </div>

        {isManager && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">تعریف / ویرایش شیفت</h2>
            <form onSubmit={handleCreateOrUpdate} className="space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-xl px-3 py-2" placeholder="نام شیفت" required />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full border rounded-xl px-3 py-2" placeholder="ساعت شروع" />
                <input value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full border rounded-xl px-3 py-2" placeholder="ساعت پایان" />
              </div>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full border rounded-xl px-3 py-2" placeholder="توضیح" rows="2" />
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">رنگ</label>
                <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
              <button className="w-full bg-primary-500 text-white py-2 rounded-xl font-medium">{editingId ? 'ذخیره تغییرات' : 'افزودن شیفت'}</button>
            </form>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4">لیست شیفت‌ها</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {shifts.map(shift => (
            <div key={shift.id} className="rounded-xl border p-4" style={{ borderColor: shift.color || '#3b82f6' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-lg">{shift.name}</p>
                  <p className="text-sm text-gray-600">{shift.description || 'بدون توضیح'}</p>
                </div>
                {isManager && (
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(shift)} className="text-xs text-blue-600">ویرایش</button>
                    <button onClick={() => deleteShift(shift.id)} className="text-xs text-red-600">حذف</button>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-3">ساعت شروع: {shift.start_time || '—'} | ساعت پایان: {shift.end_time || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {isManager && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">اختصاص شیفت به کارمندان</h2>
          <div className="space-y-3">
            {assignments.map(item => (
              <div key={item.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border rounded-xl p-3">
                <div>
                  <p className="font-bold">{item.full_name}</p>
                  <p className="text-sm text-gray-500">{item.department_name || 'بدون واحد'} | شیفت فعلی: {item.shift_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select defaultValue={item.shift_id || ''} onChange={(e) => assignShift(item.user_id, e.target.value)} className="border rounded-xl px-3 py-2 text-sm">
                    {shifts.map(shift => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4">درخواست‌های من</h2>
        <div className="space-y-2">
          {requests.length === 0 ? (
            <p className="text-sm text-gray-500">درخواستی ثبت نشده است.</p>
          ) : (
            requests.map(req => (
              <div key={req.id} className="border rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="font-bold">{req.requested_shift_name}</p>
                  <p className="text-sm text-gray-500">{req.reason || 'بدون توضیح'}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${req.status === 'approved' ? 'bg-green-100 text-green-700' : req.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {req.status === 'approved' ? 'تایید شده' : req.status === 'rejected' ? 'رد شده' : 'در انتظار'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
