import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import ErrorBoundary from './ErrorBoundary';

const menuGroups = [
  {
    id: 'workspace',
    title: 'میز کار و ارتباطات',
    icon: '📊',
    items: [
      { path: '/', label: 'داشبورد عمومی', icon: '🏠' },
      { path: '/chat', label: 'چت داخلی', icon: '💬', permission: 'chat_view' },
      { path: '/learning', label: 'آموزش', icon: '📚', permission: 'learning_view' },
      { path: '/letters', label: 'نامه‌ها', icon: '📨', permission: 'letters_send' },
      { path: '/conference', label: 'سالن کنفرانس', icon: '🏛️', permission: 'conference_booking' },
    ]
  },
  {
    id: 'hr_services',
    title: 'خدمات پرسنلی و رفاهی',
    icon: '📝',
    items: [
      { path: '/leave', label: 'مرخصی', icon: '🏖️', permission: 'leave_request' },
      { path: '/overtime', label: 'اضافه کار', icon: '⏰', permission: 'overtime_request' },
      { path: '/mission', label: 'ماموریت', icon: '🚗', permission: 'mission_request' },
      { path: '/payment', label: 'درخواست وجه', icon: '💰', permission: 'payment_request' },
      { path: '/restaurant', label: 'رستوران', icon: '🍽️', permission: 'restaurant_view' },
      { path: '/shifts', label: 'شیفت‌های کاری', icon: '🕒', permission: 'shifts_manage' },
      { path: '/job-application', label: 'پرسشنامه استخدامی', icon: '📋', permission: 'job_application_fill' },
    ]
  },
  {
    id: 'operations_technical',
    title: 'عملیات، تولید و فنی',
    icon: '🔧',
    items: [
      { path: '/work-order', label: 'کار داخلی', icon: '🔧', permission: 'work_order_request' },
      { path: '/purchase', label: 'درخواست خرید', icon: '🛒', permission: 'purchase_request' },
      { path: '/repair', label: 'تعمیرات', icon: '🛠️', permission: 'repair_request' },
      { path: '/repair-external', label: 'تعمیرات خارج از کارخانه', icon: '🏭', permission: 'repair_external_create' },
      { path: '/inspection', label: 'بازرسی فنی', icon: '🔍', permission: 'inspection_request' },
      { path: '/project-supply', label: 'تامین کالای پروژه', icon: '🏗️', permission: 'project_supply' },
      { path: '/daily-output', label: 'آمار تولید', icon: '📈', permission: 'daily_output_view' },
      { path: '/inventory', label: 'کارتکس انبار', icon: '📦', permission: 'inventory_view' },
    ]
  },
  {
    id: 'office_security',
    title: 'اداری، گزارش‌ها و امنیت',
    icon: '🏢',
    items: [
      { path: '/it', label: 'ثبت تیکت IT', icon: '🎫', permission: 'it_ticket' },
      { path: '/daily-work-report', label: 'گزارش کار روزانه', icon: '📝', permission: 'daily_work_report' },
      { path: '/security', label: 'گزارش حراست', icon: '🛡️', permission: 'security_report' },
    ]
  },
  {
    id: 'admin_management',
    title: 'مدیریت و نظارت',
    icon: '⚙️',
    items: [
      { path: '/admin-dashboard', label: 'داشبورد مدیریتی', icon: '📊', roles: ['admin', 'manager'] },
      { path: '/admin', label: 'پنل مدیریت', icon: '⚙️', permission: 'admin_panel' },
      { path: '/reports', label: 'گزارش‌گیری جامع', icon: '📈', permission: 'reports_view' },
      { path: '/workflow', label: 'گردش کار', icon: '🔄', permission: 'workflow_view' },
      { path: '/signature', label: 'امضای دیجیتال', icon: '✍️', permission: 'signature_view' },
      { path: '/audit-log', label: 'لاگ فعالیت‌ها', icon: '📜', permission: 'audit_log_view' },
      { path: '/admin/import-users', label: 'ورود و خروج کاربران', icon: '👥', permission: 'user_import_csv' },
    ]
  }
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
  const [searchQuery, setSearchQuery] = useState('');
  const getActiveGroupId = (pathname) => {
    const currentGroup = menuGroups.find(g => g.items.some(item => item.path === pathname));
    return currentGroup ? currentGroup.id : null;
  };

  const [openGroupId, setOpenGroupId] = useState(() => getActiveGroupId(location.pathname));

  const toggleGroup = (groupId) => {
    setOpenGroupId(prev => (prev === groupId ? null : groupId));
  };

  // Automatically expand group containing active path on route change
  useEffect(() => {
    const currentId = getActiveGroupId(location.pathname);
    if (currentId) {
      setOpenGroupId(currentId);
    }
  }, [location.pathname]);

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
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [changePasswordForm, setChangePasswordForm] = useState({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);

  const userMenuRef = useRef(null);
  const notifMenuRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowUserMenu(false);
        setShowNotifPanel(false);
      }
    };
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) {
        setShowNotifPanel(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (changePasswordForm.newPassword !== changePasswordForm.confirmNewPassword) {
      toast.error('رمز جدید و تکرار آن یکسان نیستند');
      return;
    }
    if (changePasswordForm.newPassword.length < 5) {
      toast.error('رمز عبور جدید باید حداقل ۵ کاراکتر باشد');
      return;
    }
    setChangePasswordLoading(true);
    try {
      await api.post('/auth/change-password', {
        oldPassword: changePasswordForm.oldPassword,
        newPassword: changePasswordForm.newPassword
      });
      toast.success('رمز عبور با موفقیت تغییر کرد');
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
  const [browserNotifPerm, setBrowserNotifPerm] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const prevNotificationsRef = useRef(null);

  const requestBrowserNotifPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserNotifPerm(perm);
        if (perm === 'granted') {
          toast.success('اعلان مرورگر فعال شد');
        } else if (perm === 'denied') {
          toast.error('دسترسی اعلان توسط مرورگر مسدود شده است');
        }
      } catch (err) {
        console.error('Error requesting notification permission:', err);
      }
    }
  };

  const showBrowserNotification = useCallback((notif) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const title = notif.title || 'پیام جدید در اتوماسیون';
        const options = {
          body: notif.body || '',
          icon: '/favicon.ico',
          tag: `notif-${notif.id || Date.now()}`,
          renotify: true,
          requireInteraction: false
        };

        const n = new Notification(title, options);
        n.onclick = () => {
          window.focus();
          if (notif.link) {
            navigate(notif.link);
          }
          n.close();
        };
      } catch (e) {
        console.error('Failed to trigger browser notification:', e);
      }
    }
  }, [navigate]);

  const fetchPendingCounts = async () => {
    try {
      const res = await api.get('/notifications/pending-counts');
      setPendingCounts(res.data);
    } catch (err) { /* non-critical */ }
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      const latestList = res.data.slice(0, 10);

      // Check for new incoming unread notifications to trigger browser notification
      if (prevNotificationsRef.current !== null) {
        const prevIds = new Set(prevNotificationsRef.current.map(n => n.id));
        const newUnread = latestList.filter(n => !n.is_read && !prevIds.has(n.id));
        newUnread.forEach(n => {
          showBrowserNotification(n);
        });
      }
      prevNotificationsRef.current = latestList;

      setNotifications(latestList);
      const countRes = await api.get('/notifications/unread-count');
      setUnreadCount(countRes.data.count);
      const annRes = await api.get('/announcements/active');
      setActiveAnnouncements(annRes.data.slice(0, 5));
      fetchPendingCounts();
    } catch (err) { /* non-critical */ }
  }, [showBrowserNotification]);

  const socketRef = useRef(null);
  const debounceNotifRef = useRef(null);

  useEffect(() => {
    if (user) {
      refreshPermissions();
      fetchNotifications();
      fetchPendingCounts();

      // Automatically request browser notification permission if default/prompt
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(perm => setBrowserNotifPerm(perm)).catch(() => {});
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      const socket = io();
      socketRef.current = socket;

      socket.emit('user:register', user.id);

      socket.on('update', () => {
        if (debounceNotifRef.current) clearTimeout(debounceNotifRef.current);
        debounceNotifRef.current = setTimeout(() => {
          fetchNotifications();
          fetchPendingCounts();
        }, 300);
        window.dispatchEvent(new CustomEvent('ws-update'));
      });

      socket.on('chat:notification', (data) => {
        fetchPendingCounts();
        // If not in the chat page or in a different room, play sound and notify
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        } catch (_) {}

        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          showBrowserNotification({
            title: `پیام جدید از ${data.senderName}`,
            body: data.message,
            link: '/chat'
          });
        }
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

  // Update browser tab title based on unread counts
  useEffect(() => {
    const totalUnread = (notifications.filter(n => !n.is_read).length) + (pendingCounts.chat || 0);
    const baseTitle = 'سیستم اتوماسیون اداری اروین شیشه ساچی';
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [notifications, pendingCounts]);

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    fetchNotifications();
  };

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    fetchNotifications();
  };

  const processedGroups = menuGroups.map(group => {
    const visibleItems = group.items.filter(item => {
      if (item.roles && (!user || !item.roles.includes(user.role))) return false;
      if (item.permission && !hasPermission(item.permission)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesLabel = item.label.toLowerCase().includes(q);
        const matchesGroup = group.title.toLowerCase().includes(q);
        return matchesLabel || matchesGroup;
      }
      return true;
    }).map(item => {
      let count = 0;
      if (item.path === '/leave') count = pendingCounts.leave;
      if (item.path === '/overtime') count = pendingCounts.overtime;
      if (item.path === '/letters') count = pendingCounts.letters;
      if (item.path === '/inventory') count = pendingCounts.inventory;
      if (item.path === '/job-application') count = pendingCounts.jobApplication;
      if (item.path === '/chat') count = pendingCounts.chat;

      return {
        ...item,
        pendingCount: count,
        labelWithBadge: count > 0 ? `${item.label} (${count})` : item.label
      };
    });

    const totalGroupPending = visibleItems.reduce((acc, curr) => acc + (curr.pendingCount || 0), 0);

    return {
      ...group,
      visibleItems,
      totalPending: totalGroupPending
    };
  }).filter(group => group.visibleItems.length > 0);


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
              <img src="/logo.webp" alt="لوگو" className="w-24 h-24 object-contain mb-2 rotate-3d" />
              <h1 className="text-base font-bold">اروم شیشه ساچی</h1>
              <p className="text-xs text-primary-200 mt-0.5">سیستم اتوماسیون اداری</p>
            </div>
          ) : (
            <div className="flex justify-center">
              <img src="/logo.webp" alt="لوگو" className="w-10 h-10 object-contain" />
            </div>
          )}
        </div>

        {/* Quick Search in Sidebar (when open) */}
        {sidebarOpen && (
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی منو..."
                className="w-full bg-primary-700/60 border border-primary-400/40 rounded-xl px-3 py-1.5 pr-8 text-xs text-white placeholder-primary-300 focus:outline-none focus:bg-primary-700 focus:border-white transition-colors"
              />
              <span className="absolute right-2.5 top-2 text-xs text-primary-300">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1.5 text-xs text-primary-300 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}
        
        <nav className="flex-1 py-2 px-2 overflow-y-auto space-y-1.5 custom-scrollbar">
          {processedGroups.map((group) => {
            const isExpanded = searchQuery.trim() ? true : openGroupId === group.id;
            const hasActiveChild = group.visibleItems.some(i => location.pathname === i.path);

            return (
              <div key={group.id} className="rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.06]">
                {/* Group Header Button */}
                <button
                  type="button"
                  onClick={() => sidebarOpen ? toggleGroup(group.id) : setSidebarOpen(true)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold transition-colors ${
                    hasActiveChild ? 'text-white bg-white/10' : 'text-primary-200 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{group.icon}</span>
                    {sidebarOpen && <span>{group.title}</span>}
                  </div>
                  {sidebarOpen && (
                    <div className="flex items-center gap-1.5">
                      {group.totalPending > 0 && (
                        <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                          {group.totalPending}
                        </span>
                      )}
                      <span className={`text-[10px] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </div>
                  )}
                </button>

                {/* Submenu Items */}
                {(isExpanded || !sidebarOpen) && (
                  <div className={`space-y-0.5 pb-1 ${sidebarOpen ? 'pt-0.5 px-1' : ''}`}>
                    {group.visibleItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => {
                            if (window.innerWidth <= 768) {
                              setSidebarOpen(false);
                            }
                          }}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all ${
                            isActive
                              ? 'bg-white text-primary-800 font-bold shadow-md'
                              : 'text-primary-100 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <span className="text-sm">{item.icon}</span>
                            {sidebarOpen && <span className="truncate">{item.label}</span>}
                          </div>
                          {sidebarOpen && item.pendingCount > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                              isActive ? 'bg-red-500 text-white' : 'bg-red-500/90 text-white'
                            }`}>
                              {item.pendingCount}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-primary-500 md:block hidden">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full py-1.5 text-xs bg-primary-500/50 rounded-lg hover:bg-primary-500 transition-colors flex items-center justify-center gap-1 text-primary-100 hover:text-white"
          >
            <span>{sidebarOpen ? 'بستن سایدبار' : ''}</span>
            <span>{sidebarOpen ? '◀' : '▶'}</span>
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
              {menuGroups.flatMap(g => g.items).find(m => m.path === location.pathname)?.label || 'داشبورد'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Menu */}
            <div className="relative" ref={notifMenuRef}>
              <button 
                onClick={() => {
                  setShowNotifPanel(!showNotifPanel);
                  if (!showNotifPanel) setShowUserMenu(false);
                }}
                className={`relative p-2.5 rounded-xl text-gray-600 hover:text-primary-600 hover:bg-primary-50/80 transition-all duration-200 ${
                  showNotifPanel ? 'bg-primary-50 text-primary-600 ring-2 ring-primary-200' : ''
                }`}
                title="اعلانات و پیام‌ها"
              >
                <span className="text-lg leading-none">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-md animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifPanel && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-black/20 md:hidden" 
                    onClick={() => setShowNotifPanel(false)} 
                  />
                  <div className="fixed md:absolute left-4 right-4 md:left-auto md:right-0 top-16 md:top-full mt-2 w-auto md:w-88 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100/80 z-50 animate-fade-in overflow-hidden">
                    {activeAnnouncements.length > 0 && (
                      <div className="border-b bg-amber-50/70">
                        <div className="p-3 border-b border-amber-100/80 flex justify-between items-center bg-amber-100/40">
                          <span className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
                            <span>📢</span> اطلاعیه‌ها
                          </span>
                        </div>
                        <div className="max-h-40 overflow-y-auto divide-y divide-amber-100/60">
                          {activeAnnouncements.map(a => (
                            <div key={a.id} className="p-3 hover:bg-amber-100/60 transition-colors cursor-pointer">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-bold text-xs text-amber-950">{a.title}</p>
                                {a.priority === 'urgent' && <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">فوری</span>}
                                {a.priority === 'important' && <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">مهم</span>}
                              </div>
                              {a.body && <p className="text-[11px] text-amber-800 line-clamp-2 leading-relaxed">{a.body}</p>}
                              {a.image_path && (
                                <img src={a.image_path} alt={a.title} className="mt-2 w-full h-20 object-cover rounded-xl border border-amber-200" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/70">
                      <span className="font-bold text-xs text-gray-700">اعلانات سیستم</span>
                      <div className="flex items-center gap-2">
                        {typeof window !== 'undefined' && 'Notification' in window && browserNotifPerm !== 'granted' && (
                          <button
                            onClick={requestBrowserNotifPermission}
                            className="text-[10px] sm:text-[11px] bg-primary-50 text-primary-600 hover:bg-primary-100 px-2 py-0.5 rounded-lg border border-primary-200 transition-colors whitespace-nowrap"
                            title="فعال‌سازی دریافت نوتیفیکیشن روی دسکتاپ و مرورگر"
                          >
                            فعال‌سازی اعلان
                          </button>
                        )}
                        <button onClick={markAllRead} className="text-xs text-primary-600 hover:text-primary-800 hover:underline whitespace-nowrap font-medium">خواندن همه</button>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <span className="text-2xl block mb-1 text-gray-300">🔕</span>
                          <p className="text-xs text-gray-400">اعلانی وجود ندارد</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => { markRead(n.id); if(n.link) navigate(n.link); setShowNotifPanel(false); }}
                            className={`p-3.5 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-primary-50/40' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-xs ${!n.is_read ? 'font-bold text-primary-950' : 'font-semibold text-gray-700'}`}>{n.title}</p>
                              {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0"></span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{n.body}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative border-r border-gray-200 pr-3 mr-1" ref={userMenuRef}>
              <button
                onClick={() => {
                  setShowUserMenu(!showUserMenu);
                  if (!showUserMenu) setShowNotifPanel(false);
                }}
                className={`flex items-center gap-3 p-1.5 pl-2.5 rounded-2xl transition-all duration-200 border ${
                  showUserMenu 
                    ? 'bg-primary-50/60 border-primary-200 shadow-sm' 
                    : 'bg-gray-50/60 hover:bg-gray-100/80 border-transparent hover:border-gray-200'
                }`}
              >
                <div className="w-9 h-9 bg-gradient-to-tr from-primary-700 to-primary-500 text-white rounded-xl flex items-center justify-center font-bold text-sm shadow-sm">
                  {user?.full_name?.charAt(0) || '👤'}
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-gray-800 leading-tight truncate max-w-[130px]">{user?.full_name}</p>
                  <p className="text-[11px] text-gray-500 leading-tight mt-0.5 truncate max-w-[130px]">
                    {roleLabels[user?.role] || 'کاربر'}
                  </p>
                </div>
                <span className={`text-[10px] text-gray-400 transition-transform duration-200 mr-0.5 ${showUserMenu ? 'rotate-180 text-primary-600' : ''}`}>
                  ▼
                </span>
              </button>

              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40 bg-black/20 md:hidden" 
                    onClick={() => setShowUserMenu(false)} 
                  />
                  <div className="fixed md:absolute left-4 right-4 md:left-0 md:right-auto top-16 md:top-full mt-2 w-auto md:w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 animate-fade-in overflow-hidden">
                    {/* User Header Summary Card */}
                    <div className="p-4 bg-gradient-to-br from-primary-50 to-blue-50/30 border-b border-primary-100/50">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-primary-600 text-white rounded-2xl flex items-center justify-center font-bold text-base shadow-sm">
                          {user?.full_name?.charAt(0) || '👤'}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-bold text-gray-900 truncate">{user?.full_name}</p>
                          <p className="text-xs text-primary-700 font-medium truncate mt-0.5">{roleLabels[user?.role] || 'کاربر'}</p>
                          {user?.department_name && (
                            <p className="text-[11px] text-gray-500 truncate mt-0.5">واحد: {user.department_name}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions List */}
                    <div className="p-2 space-y-1">
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-700 hover:text-primary-700 hover:bg-primary-50/60 transition-colors group"
                      >
                        <span className="text-base p-1 rounded-lg bg-gray-100 group-hover:bg-primary-100 transition-colors">👤</span>
                        <div className="flex flex-col">
                          <span>پروفایل کاربری</span>
                          <span className="text-[10px] text-gray-400 font-normal">مشاهده مشخصات و تغییر رمز</span>
                        </div>
                      </Link>

                      <div className="my-1 border-t border-gray-100" />

                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                          navigate('/login');
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors group text-right"
                      >
                        <span className="text-base p-1 rounded-lg bg-red-50 group-hover:bg-red-100 transition-colors">🚪</span>
                        <span>خروج از حساب</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
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

    </div>
  );
}
