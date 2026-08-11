import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import PWAInstall from './PWAInstall';
import ErrorBoundary from './ErrorBoundary';

const menuItems = [
  { path: '/', label: 'داشبورد', icon: '📊', permission: 'dashboard_view' },
  { path: '/leave', label: 'مرخصی', icon: '🏖️', permission: 'leave_request' },
  { path: '/overtime', label: 'اضافه کار', icon: '⏰', permission: 'overtime_request' },
  { path: '/purchase', label: 'درخواست خرید', icon: '🛒', permission: 'purchase_request' },
  { path: '/mission', label: 'ماموریت', icon: '🚗', permission: 'mission_request' },
  { path: '/work-order', label: 'کار داخلی', icon: '🔧', permission: 'work_order_request' },
  { path: '/payment', label: 'درخواست وجه', icon: '💰', permission: 'payment_request' },
  { path: '/repair', label: 'تعمیرات', icon: '🛠️', permission: 'repair_request' },
  { path: '/repair-external', label: 'تعمیرات خارج از کارخانه', icon: '🏭', permission: 'repair_external_create' },
  { path: '/it', label: 'ثبت تیکت', icon: '🎫', permission: 'it_ticket' },
  { path: '/conference', label: 'سالن کنفرانس', icon: '🏛️', permission: 'conference_booking' },
  { path: '/security', label: 'گزارش حراست', icon: '🛡️', permission: 'security_report' },
  { path: '/daily-output', label: 'آمار تولید', icon: '📈', permission: 'daily_output_view' },
  { path: '/project-supply', label: 'تامین کالای پروژه', icon: '🏗️', permission: 'project_supply' },
  { path: '/inspection', label: 'بازرسی فنی', icon: '🔍', permission: 'inspection_request' },
  { path: '/daily-work-report', label: 'گزارش کار روزانه', icon: '📝', permission: 'daily_work_report' },
  { path: '/letters', label: 'نامه‌ها', icon: '📨', permission: 'letters_send' },
  { path: '/inventory', label: 'کارتکس انبار', icon: '📦', permission: 'inventory_view' },
  { path: '/restaurant', label: 'رستوران', icon: '🍽️', permission: 'restaurant_view' },
  { path: '/shifts', label: 'شیفت‌های کاری', icon: '🕒', permission: 'shifts_manage' },
  { path: '/job-application', label: 'پرسشنامه استخدامی', icon: '📋', permission: 'job_application_fill' },
  { path: '/reports', label: 'گزارش‌گیری', icon: '📈', permission: 'reports_view' },
  { path: '/audit-log', label: 'لاگ فعالیت‌ها', icon: '📜', permission: 'audit_log_view' },
  { path: '/admin/import-users', label: 'ورود گروهی کاربران', icon: '👥', permission: 'user_import_csv' },
  { path: '/profile', label: 'پروفایل', icon: '👤', permission: 'profile_view' },
  { path: '/admin', label: 'پنل مدیریت', icon: '⚙️', permission: 'admin_panel' },
  { path: '/workflow', label: 'گردش کار', icon: '🔄', permission: 'workflow_view' },
  { path: '/signature', label: 'امضای دیجیتال', icon: '✍️', permission: 'signature_view' },
  { path: '/chat', label: 'چت داخلی', icon: '💬', permission: 'chat_view' },
  { path: '/learning', label: 'آموزش', icon: '📚', permission: 'learning_view' },
];

const roleLabels = {
  admin: 'مدیر سیستم',
  manager: 'مدیر',
  supervisor: 'سرپرست',
  user: 'کاربر',
  applicant: 'متقاضی استخدام'
};

export default function Layout({ children }) {
  const { user, logout, hasPermission, updateUserFields, refreshPermissions } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth > 768 : false;
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showChangePasswordModal) {
          setShowChangePasswordModal(false);
          setChangePasswordForm({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showChangePasswordModal]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (changePasswordForm.newPassword !== changePasswordForm.confirmNewPassword) {
      toast.error('رمز جدید و تکرار آن یکسان نیستند');
      return;
    }
    if (changePasswordForm.newPassword.length < 8) {
      toast.error('رمز عبور جدید باید حداقل ۸ کاراکتر باشد');
      return;
    }
    setChangePasswordLoading(true);
    try {
      await api.post('/auth/change-password', {
        oldPassword: changePasswordForm.oldPassword,
        newPassword: changePasswordForm.newPassword
      });
      toast.success('رمز عبور با موفقیت تغییر کرد');
      setShowChangePasswordModal(false);
      setChangePasswordForm({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
      if (user?.must_change_password) {
        updateUserFields({ must_change_password: 0 });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در تغییر رمز عبور');
    } finally {
      setChangePasswordLoading(false);
    }
  };
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [activeAnnouncements, setActiveAnnouncements] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({ leave: 0, overtime: 0, letters: 0, inventory: 0, jobApplication: 0 });

  const fetchPendingCounts = async () => {
    try {
      const res = await api.get('/notifications/pending-counts');
      setPendingCounts(res.data);
    } catch (err) { /* non-critical */ }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.slice(0, 10));
      const countRes = await api.get('/notifications/unread-count');
      setUnreadCount(countRes.data.count);
      const annRes = await api.get('/announcements/active');
      setActiveAnnouncements(annRes.data.slice(0, 5));
      fetchPendingCounts();
    } catch (err) { /* non-critical */ }
  }, []);

  const socketRef = useRef(null);
  const debounceNotifRef = useRef(null);

  useEffect(() => {
    if (user) {
      refreshPermissions();
      fetchNotifications();
      fetchPendingCounts();

      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      const socket = io();
      socketRef.current = socket;

      socket.on('update', () => {
        if (debounceNotifRef.current) clearTimeout(debounceNotifRef.current);
        debounceNotifRef.current = setTimeout(() => {
          fetchNotifications();
          fetchPendingCounts();
        }, 300);
        window.dispatchEvent(new CustomEvent('ws-update'));
      });

      const interval = setInterval(() => {
        fetchNotifications();
        fetchPendingCounts();
      }, 30000);

      return () => {
        clearInterval(interval);
        if (debounceNotifRef.current) clearTimeout(debounceNotifRef.current);
        socket.disconnect();
        socketRef.current = null;
      };
    }
  }, [user, fetchNotifications]);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    fetchNotifications();
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    fetchNotifications();
  };

  const filteredMenu = menuItems.filter(item => {
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
  }).map(item => {
    let count = 0;
    if (item.path === '/leave') count = pendingCounts.leave;
    if (item.path === '/overtime') count = pendingCounts.overtime;
    if (item.path === '/letters') count = pendingCounts.letters;
    if (item.path === '/inventory') count = pendingCounts.inventory;
    if (item.path === '/job-application') count = pendingCounts.jobApplication;

    return {
      ...item,
      label: count > 0 ? `${item.label} (${count})` : item.label
    };
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 right-0 z-50 w-64 bg-gradient-to-b from-primary-600 to-primary-800 text-white transition-all duration-300 flex flex-col
        md:relative md:translate-x-0
        ${sidebarOpen ? 'translate-x-0 md:w-64' : 'translate-x-full md:w-20'}
      `}>
        <div className="p-4 border-b border-primary-500">
          {sidebarOpen ? (
            <div className="flex flex-col items-center">
              <img src="/logo.webp" alt="لوگو" className="w-28 h-28 object-contain mb-2 rotate-3d" />
              <h1 className="text-lg font-bold">اروم شیشه ساچی</h1>
              <p className="text-xs text-primary-200 mt-1">سیستم اتوماسیون اداری</p>
            </div>
          ) : (
            <div className="flex justify-center">
              <img src="/logo.webp" alt="لوگو" className="w-12 h-12 object-contain" />
            </div>
          )}
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto">
          {filteredMenu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => {
                if (window.innerWidth <= 768) {
                  setSidebarOpen(false);
                }
              }}
              className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-all ${
                location.pathname === item.path 
                  ? 'bg-white/20 shadow-lg' 
                  : 'hover:bg-white/10'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-500 md:block hidden">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full py-2 text-xs bg-primary-500/50 rounded-lg hover:bg-primary-500 transition-colors"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -mr-2 text-gray-600 hover:text-primary-500 md:hidden text-xl"
            >
              ☰
            </button>
            <h2 className="text-lg font-bold text-gray-800">
              {filteredMenu.find(m => m.path === location.pathname)?.label || 'داشبورد'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => setShowNotifPanel(!showNotifPanel)}
                className="relative p-2 text-gray-600 hover:text-primary-500 transition-colors"
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifPanel && (
                <div className="absolute left-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border z-50 animate-fade-in">
                  {activeAnnouncements.length > 0 && (
                    <div className="border-b bg-orange-50">
                      <div className="p-3 border-b flex justify-between items-center">
                        <span className="font-bold text-sm text-orange-700">📢 اطلاعیه‌ها</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {activeAnnouncements.map(a => (
                            <div key={a.id} className="p-3 border-b border-orange-100 hover:bg-orange-100 cursor-pointer">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-xs text-orange-800">{a.title}</p>
                              {a.priority === 'urgent' && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">فوری</span>}
                              {a.priority === 'important' && <span className="text-[9px] bg-yellow-500 text-white px-1.5 py-0.5 rounded-full">مهم</span>}
                            </div>
                            {a.body && <p className="text-[11px] text-orange-600 line-clamp-2">{a.body}</p>}
                            {a.image_path && (
                              <img src={a.image_path} alt={a.title} className="mt-1 w-full h-20 object-cover rounded-lg" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="p-3 border-b flex justify-between items-center">
                    <span className="font-bold text-sm">اعلانات</span>
                    <button onClick={markAllRead} className="text-xs text-primary-500 hover:underline">خواندن همه</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-sm text-gray-400 text-center">اعلانی وجود ندارد</p>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => { markRead(n.id); if(n.link) navigate(n.link); setShowNotifPanel(false); }}
                          className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50' : ''}`}
                        >
                          <p className="font-bold text-xs">{n.title}</p>
                          <p className="text-xs text-gray-600 mt-1">{n.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 border-r pr-4">
              <div className="text-left hidden sm:block">
                <p className="text-sm font-bold text-gray-800">{user?.full_name}</p>
                <p className="text-xs text-gray-500">{roleLabels[user?.role]} • {user?.department_name}</p>
              </div>
              <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                {user?.full_name?.charAt(0)}
              </div>
            </div>
            <button 
              onClick={() => setShowChangePasswordModal(true)}
              className="text-xs text-blue-500 hover:text-blue-700 font-medium ml-3 flex items-center gap-1"
            >
              🔑 تغییر رمز
            </button>
            <button 
              onClick={() => { logout(); navigate('/login'); }}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              خروج
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </div>
      </main>

      {/* Forced Password Change Modal (must_change_password === 1) */}
      {user?.must_change_password === 1 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-red-100 text-right">
            <h3 className="text-lg font-bold text-red-600 mb-2 font-vazir">⚠️ تغییر رمز عبور اجباری</h3>
            <p className="text-sm text-gray-500 mb-6 leading-6">
              به دلیل استفاده از رمز عبور پیش‌فرض (کد پرسنلی)، جهت حفظ امنیت حساب کاربری خود، لطفاً ابتدا رمز عبور جدیدی تعیین نمایید.
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">رمز عبور فعلی (کد پرسنلی)</label>
                <input
                  type="password"
                  value={changePasswordForm.oldPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, oldPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl text-center focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">رمز عبور جدید</label>
                <input
                  type="password"
                  value={changePasswordForm.newPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl text-center focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">تکرار رمز عبور جدید</label>
                <input
                  type="password"
                  value={changePasswordForm.confirmNewPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, confirmNewPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl text-center focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div className="pt-2 flex gap-4">
                <button
                  type="submit"
                  disabled={changePasswordLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-md shadow-red-500/20"
                >
                  {changePasswordLoading ? 'در حال ثبت...' : 'تغییر رمز و ورود'}
                </button>
                <button
                  type="button"
                  onClick={() => { logout(); navigate('/login'); }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-bold transition-colors"
                >
                  خروج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Optional Password Change Modal */}
      {showChangePasswordModal && (
        <div
          onClick={() => { setShowChangePasswordModal(false); setChangePasswordForm({ oldPassword: '', newPassword: '', confirmNewPassword: '' }); }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[5000] p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-100 text-right relative"
          >
            <button
              onClick={() => { setShowChangePasswordModal(false); setChangePasswordForm({ oldPassword: '', newPassword: '', confirmNewPassword: '' }); }}
              className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-all text-xs"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-6 font-vazir">🔑 تغییر رمز عبور</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">رمز عبور فعلی</label>
                <input
                  type="password"
                  value={changePasswordForm.oldPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, oldPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">رمز عبور جدید</label>
                <input
                  type="password"
                  value={changePasswordForm.newPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">تکرار رمز عبور جدید</label>
                <input
                  type="password"
                  value={changePasswordForm.confirmNewPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, confirmNewPassword: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl text-center focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
              </div>
              <div className="pt-2 flex gap-4">
                <button
                  type="submit"
                  disabled={changePasswordLoading}
                  className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-md shadow-primary-500/20"
                >
                  {changePasswordLoading ? 'در حال ثبت...' : 'تغییر رمز'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowChangePasswordModal(false); setChangePasswordForm({ oldPassword: '', newPassword: '', confirmNewPassword: '' }); }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold transition-colors"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <PWAInstall />
    </div>
  );
}
