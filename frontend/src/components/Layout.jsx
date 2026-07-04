import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { io } from 'socket.io-client';

const menuItems = [
  { path: '/', label: 'داشبورد', icon: '📊', roles: ['admin','manager','supervisor','user'] },
  { path: '/leave', label: 'مرخصی', icon: '🏖️', roles: ['admin','manager','supervisor','user'] },
  { path: '/letters', label: 'نامه‌ها', icon: '📨', roles: ['admin','manager','supervisor','user'] },
  { path: '/inventory', label: 'کارتکس انبار', icon: '📦', roles: ['admin','manager','supervisor','user'] },
  { path: '/restaurant', label: 'رستوران', icon: '🍽️', roles: ['admin','manager','supervisor','user'] },
  { path: '/shifts', label: 'شیفت‌های کاری', icon: '🕒', permission: 'shifts_manage' },
  { path: '/job-application', label: 'پرسشنامه استخدامی', icon: '📋', permission: 'job_application_fill' },
  { path: '/admin', label: 'پنل مدیریت', icon: '⚙️', roles: ['admin'] },
];

const roleLabels = {
  admin: 'مدیر سیستم',
  manager: 'مدیر',
  supervisor: 'سرپرست',
  user: 'کاربر',
  applicant: 'متقاضی استخدام'
};

export default function Layout({ children }) {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [activeAnnouncements, setActiveAnnouncements] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({ leave: 0, letters: 0, inventory: 0, jobApplication: 0 });

  const fetchPendingCounts = async () => {
    try {
      const res = await api.get('/notifications/pending-counts');
      setPendingCounts(res.data);
    } catch (err) {
      console.error('Error fetching pending counts:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.slice(0, 10));
      const countRes = await api.get('/notifications/unread-count');
      setUnreadCount(countRes.data.count);
      const annRes = await api.get('/announcements/active');
      setActiveAnnouncements(annRes.data.slice(0, 5));
      fetchPendingCounts();
    } catch (err) {}
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchPendingCounts();

      const socket = io();

      socket.on('connect', () => {
        console.log('Socket.IO connected');
      });

      socket.on('update', () => {
        console.log('Socket.IO update event received');
        fetchNotifications();
        fetchPendingCounts();
        window.dispatchEvent(new CustomEvent('ws-update'));
      });

      const interval = setInterval(() => {
        fetchNotifications();
        fetchPendingCounts();
      }, 30000);

      return () => {
        clearInterval(interval);
        socket.disconnect();
      };
    }
  }, [user]);

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
    if (item.roles && !item.roles.includes(user?.role)) return false;
    return true;
  }).map(item => {
    let count = 0;
    if (item.path === '/leave') count = pendingCounts.leave;
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
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-primary-600 to-primary-800 text-white transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b border-primary-500">
          {sidebarOpen && (
            <div className="flex flex-col items-center">
              <img src="/logo.png" alt="لوگو" className="w-28 h-28 object-contain mb-2 rotate-3d" />
              <h1 className="text-lg font-bold">اروم شیشه ساچی</h1>
              <p className="text-xs text-primary-200 mt-1">سیستم اتوماسیون اداری</p>
            </div>
          )}
          {!sidebarOpen && (
            <div className="flex justify-center">
              <img src="/logo.png" alt="لوگو" className="w-12 h-12 object-contain" />
            </div>
          )}
        </div>
        
        <nav className="flex-1 py-4 overflow-y-auto">
          {filteredMenu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
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

        <div className="p-4 border-t border-primary-500">
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
              <div className="text-left">
                <p className="text-sm font-bold text-gray-800">{user?.full_name}</p>
                <p className="text-xs text-gray-500">{roleLabels[user?.role]} • {user?.department_name}</p>
              </div>
              <div className="w-10 h-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                {user?.full_name?.charAt(0)}
              </div>
            </div>
            <button 
              onClick={() => { logout(); navigate('/login'); }}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              خروج
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
