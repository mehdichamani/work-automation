import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Login() {
  const [mode, setMode] = useState('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast.success('ورود موفقیت‌آمیز');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ورود');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = async () => {
    if (!/^09\d{9}$/.test(phone)) {
      toast.error('شماره موبایل معتبر نیست');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/sms/send-code', { phone });
      setCodeSent(true);
      setCountdown(60);
      toast.success('کد تأیید ارسال شد');
      if (res.data._dev_code) {
        toast(`(Dev) کد: ${res.data._dev_code}`, { icon: '🔑', duration: 10000 });
      }
      const timer = setInterval(() => {
        setCountdown(p => { if (p <= 1) { clearInterval(timer); return 0; } return p - 1; });
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ارسال کد');
    } finally {
      setLoading(false);
    }
  };

  const handleSmsLogin = async (e) => {
    e.preventDefault();
    if (!smsCode || smsCode.length !== 6) {
      toast.error('کد تأیید ۶ رقمی وارد کنید');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/sms/verify-code', { phone, code: smsCode });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      toast.success('ورود موفقیت‌آمیز');
      window.location.href = '/';
    } catch (err) {
      toast.error(err.response?.data?.error || 'کد نامعتبر است');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-100">
        <img src="/background.webp" alt="" className="w-full h-full object-contain" />
      </div>
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-primary-100 rounded-2xl mx-auto flex items-center justify-center mb-4 overflow-hidden">
              <img src="/logo.webp" alt="لوگو" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-primary-700">اروم شیشه ساچی</h1>
            <p className="text-gray-500 text-sm mt-1">سیستم اتوماسیون اداری</p>
          </div>

          <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setMode('password')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'password' ? 'bg-primary-500 text-white shadow' : 'text-gray-600'}`}
            >
              رمز عبور
            </button>
            <button
              type="button"
              onClick={() => setMode('sms')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'sms' ? 'bg-primary-500 text-white shadow' : 'text-gray-600'}`}
            >
              کد پیامکی
            </button>
          </div>

          {mode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">کد پرسنلی</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-lg"
                  placeholder="کد پرسنلی"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رمز عبور</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-lg"
                  placeholder="رمز عبور"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-bold text-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'در حال ورود...' : 'ورود'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSmsLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">شماره موبایل</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-lg"
                  placeholder="09141234567"
                  dir="ltr"
                  required
                />
              </div>
              {codeSent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">کد تأیید</label>
                  <input
                    type="text"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl tracking-[0.5em]"
                    placeholder="------"
                    maxLength={6}
                    dir="ltr"
                    required
                  />
                </div>
              )}
              {codeSent ? (
                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-bold text-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? 'در حال تأیید...' : 'ورود'}
                  </button>
                  <button
                    type="button"
                    disabled={countdown > 0}
                    onClick={handleSendCode}
                    className="w-full text-primary-600 hover:text-primary-700 py-2 text-sm disabled:text-gray-400"
                  >
                    {countdown > 0 ? `ارسال مجدد (${countdown} ثانیه)` : 'ارسال مجدد کد'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={loading || !phone}
                  onClick={handleSendCode}
                  className="w-full bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-bold text-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'در حال ارسال...' : 'ارسال کد تأیید'}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
