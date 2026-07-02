import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import moment from 'moment-jalaali';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [balance, setBalance] = useState(null);
  const [todayReservations, setTodayReservations] = useState([]);
  const [activeAnnouncements, setActiveAnnouncements] = useState([]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('ws-update', handleUpdate);
    return () => window.removeEventListener('ws-update', handleUpdate);
  }, []);

  const loadData = async () => {
    try {
      if (user.role === 'admin' || user.role === 'manager') {
        const statsRes = await api.get('/admin/stats');
        setStats(statsRes.data);
      }
      const leavesRes = await api.get('/leave/my-requests');
      setRecentLeaves(leavesRes.data.slice(0, 5));
      const balanceRes = await api.get('/leave/balance');
      setBalance(balanceRes.data);
      const menuRes = await api.get('/restaurant/menu');
      const today = moment().format('jYYYY/jMM/jDD');
      setTodayReservations(menuRes.data.filter(m => m.food_date === today));
      const annRes = await api.get('/announcements/active');
      setActiveAnnouncements(annRes.data.slice(0, 5));
    } catch (err) {}
  };

  const colorClasses = {
    blue: { border: 'border-blue-500', text: 'text-blue-600' },
    green: { border: 'border-green-500', text: 'text-green-600' },
    yellow: { border: 'border-yellow-500', text: 'text-yellow-600' },
    purple: { border: 'border-purple-500', text: 'text-purple-600' },
    red: { border: 'border-red-500', text: 'text-red-600' },
  };

  const card = (title, value, color, icon, link) => {
    const c = colorClasses[color] || colorClasses.blue;
    return (
      <Link to={link} className={`bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all border-r-4 ${c.border} animate-fade-in`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className={`text-3xl font-bold mt-2 ${c.text}`}>{value}</p>
          </div>
          <span className="text-4xl">{icon}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">خوش آمدید {user.full_name}</h1>
        <p className="text-primary-200 mt-1">{moment().format('jYYYY/jMM/jDD - dddd')}</p>
      </div>

      {activeAnnouncements.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">📢 اطلاعیه‌ها</h3>
          {activeAnnouncements.map(a => {
            const priorityColors = {
              normal: 'border-gray-300 bg-white',
              important: 'border-yellow-400 bg-yellow-50',
              urgent: 'border-red-500 bg-red-50'
            };
            const priorityBadges = {
              normal: null,
              important: <span className="text-[10px] bg-yellow-500 text-white px-2 py-0.5 rounded-full font-bold">مهم</span>,
              urgent: <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">فوری</span>
            };
            const audienceLabels = { all: 'همه', manager: 'مدیریت', supervisor: 'سرپرستان' };
            return (
              <div key={a.id} className={`rounded-xl border-r-4 p-4 shadow-sm ${priorityColors[a.priority] || priorityColors.normal}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-gray-800">{a.title}</h4>
                    {priorityBadges[a.priority]}
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{audienceLabels[a.target_audience]}</span>
                  </div>
                  <span className="text-[10px] text-gray-400">{new Date(a.created_at).toLocaleDateString('fa-IR')}</span>
                </div>
                {a.body && <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.body}</p>}
                {a.image_path && (
                  <img src={a.image_path} alt={a.title} className="mt-2 w-full max-h-48 object-cover rounded-xl" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {stats && (user.role === 'admin' || user.role === 'manager') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {card('کل کارکنان', stats.totalUsers, 'blue', '👥', '/admin')}
          {card('واحدها', stats.totalDepts, 'green', '🏢', '/admin')}
          {card('مرخصی در انتظار', stats.pendingLeaves, 'yellow', '🏖️', '/leave')}
          {card('نامه در انتظار', stats.pendingLetters, 'purple', '📨', '/letters')}
          {card('کارتکس در انتظار', stats.pendingCardex, 'red', '📦', '/inventory')}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">🏖️ مانده مرخصی</h3>
          {balance && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>کل سهمیه:</span>
                <span className="font-bold">{balance.total_days} روز ({balance.total_days * 8} ساعت)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>استفاده شده:</span>
                <span className="font-bold text-red-500">
                  {balance.used_days_display} روز و {balance.used_hours_display} ساعت
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div className="bg-primary-500 h-3 rounded-full" style={{ width: `${balance.total_days > 0 ? ((balance.total_days * 8 - balance.used_hours) / (balance.total_days * 8)) * 100 : 0}%` }}></div>
              </div>
              <div className="flex justify-between text-sm">
                <span>مانده:</span>
                <span className="font-bold text-green-600">
                  {balance.remaining_days} روز و {balance.remaining_hours_only} ساعت
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">📨 آخرین درخواست‌های مرخصی</h3>
          <div className="space-y-2">
            {recentLeaves.length === 0 ? (
              <p className="text-sm text-gray-400">درخواستی وجود ندارد</p>
            ) : (
              recentLeaves.map(leave => (
                <div key={leave.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                  <span>{leave.leave_type}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    leave.status === 'approved' ? 'bg-green-100 text-green-700' :
                    leave.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    leave.status === 'pending_manager' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {leave.status === 'approved' ? 'تایید شده' :
                     leave.status === 'rejected' ? 'رد شده' :
                     leave.status === 'pending_manager' ? 'در انتظار مدیر' :
                     'در انتظار سرپرست'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">🍽️ منوی امروز</h3>
          <div className="space-y-2">
            {todayReservations.length === 0 ? (
              <p className="text-sm text-gray-400">منویی ثبت نشده</p>
            ) : (
              todayReservations.map(food => (
                <div key={food.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                  <span>{food.food_name}</span>
                  <span className="text-xs text-gray-500">{food.price ? `${food.price.toLocaleString()} تومان` : 'رایگان'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {stats && stats.deptStats && (user.role === 'admin' || user.role === 'manager') && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">📊 تعداد کارکنان هر واحد</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.deptStats.map(d => (
              <div key={d.name} className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-primary-600">{d.user_count}</p>
                <p className="text-sm text-gray-600 mt-1">{d.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
