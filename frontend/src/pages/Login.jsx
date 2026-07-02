import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
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

  return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center opacity-100">
        <img src="/background.png" alt="" className="w-full h-full object-contain" />
      </div>
      <div className="w-full max-w-md">
        <div className="glass-card rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-primary-100 rounded-2xl mx-auto flex items-center justify-center mb-4 overflow-hidden">
              <img src="/logo.png" alt="لوگو" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-primary-700">اروم شیشه ساچی</h1>
            <p className="text-gray-500 text-sm mt-1">سیستم اتوماسیون اداری</p>
          </div>
          <h2 className="text-xl font-bold text-center mb-6 text-gray-800">ورود به سیستم</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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

        </div>
      </div>
    </div>
  );
}
