import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const roleLabels = { admin: 'مدیر سیستم', manager: 'مدیر', supervisor: 'سرپرست', user: 'کاربر', applicant: 'متقاضی استخدام' };

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    api.get('/profile').then(res => {
      setProfile(res.data);
      setPhone(res.data.phone || '');
      setEmail(res.data.email || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    let hasError = false;
    if (!/^09\d{9}$/.test(phone)) {
      setPhoneError('شماره موبایل معتبر نیست');
      hasError = true;
    } else {
      setPhoneError('');
    }
    if (email && (!email.includes('@') || !email.includes('.'))) {
      setEmailError('ایمیل معتبر نیست');
      hasError = true;
    } else {
      setEmailError('');
    }
    if (hasError) return;
    setSubmitLoading(true);
    try {
      await api.put('/profile', { phone, email });
      toast.success('پروفایل بروزرسانی شد');
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    } finally {
      setSubmitLoading(false);
    }
  };

  const changePassword = async () => {
    if (!oldPw || !newPw) return toast.error('تمام فیلدها را پر کنید');
    if (newPw !== confirmPw) return toast.error('رمز جدید و تکرار آن مطابقت ندارند');
    if (newPw.length < 6) return toast.error('رمز عبور باید حداقل ۶ کاراکتر باشد');
    setSubmitLoading(true);
    try {
      await api.put('/profile/change-password', { oldPassword: oldPw, newPassword: newPw });
      toast.success('رمز عبور تغییر کرد');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  if (!profile) return <div className="text-center p-8 text-gray-400">خطا در بارگذاری</div>;

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl mx-auto">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6">
        <h1 className="text-2xl font-bold">پروفایل کاربری</h1>
        <p className="text-primary-100 text-sm mt-1">{profile.full_name}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">نام کامل</p><p className="font-medium">{profile.full_name}</p></div>
          <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">نام کاربری</p><p className="font-medium" dir="ltr">{profile.username}</p></div>
          <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">نقش</p><p className="font-medium">{roleLabels[profile.role]}</p></div>
          <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">واحد</p><p className="font-medium">{profile.department_name || '-'}</p></div>
          <div className="bg-gray-50 rounded-xl p-3"><p className="text-xs text-gray-500">آخرین ورود</p><p className="font-medium">{profile.last_login ? new Date(profile.last_login).toLocaleString('fa-IR') : '-'}</p></div>
        </div>

        <div>
          <h3 className="font-bold text-sm mb-3">اطلاعات تماس</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">شماره تلفن</label>
              <input type="text" value={phone} onChange={e => { setPhone(e.target.value); setPhoneError(''); }} placeholder="۰۹۱۴..." className={`w-full px-4 py-3 border rounded-xl text-sm ${phoneError ? 'border-red-400' : 'border-gray-200'}`} dir="ltr" />
              {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ایمیل</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setEmailError(''); }} placeholder="example@email.com" className={`w-full px-4 py-3 border rounded-xl text-sm ${emailError ? 'border-red-400' : 'border-gray-200'}`} dir="ltr" />
              {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
            </div>
            <button onClick={saveProfile} disabled={submitLoading} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all disabled:opacity-50">{submitLoading ? 'در حال ذخیره...' : 'ذخیره'}</button>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-bold text-sm mb-3">تغییر رمز عبور</h3>
          <div className="space-y-3">
            <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="رمز عبور فعلی" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="رمز عبور جدید (حداقل ۶ کاراکتر)" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="تکرار رمز عبور جدید" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
            <button onClick={changePassword} disabled={submitLoading} className="bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition-all disabled:opacity-50">{submitLoading ? 'در حال تغییر...' : 'تغییر رمز'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
