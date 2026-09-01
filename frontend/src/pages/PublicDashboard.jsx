import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import moment from 'moment-jalaali';
import { toJalali } from '../utils/dateUtils';
import toast from 'react-hot-toast';
import OnboardingChecklist from '../components/OnboardingChecklist';

export default function PublicDashboard() {
  const { user, hasPermission } = useAuth();
  const [balance, setBalance] = useState(null);
  const [todayReservations, setTodayReservations] = useState([]);
  const [activeAnnouncements, setActiveAnnouncements] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);
  const debounceRef = useRef(null);

  const canViewLeave = hasPermission('leave_request');
  const canViewRestaurant = hasPermission('restaurant_view');
  const canViewLetters = hasPermission('letters_send');
  const canViewChat = hasPermission('chat_view');

  const loadData = useCallback(async () => {
    if (canViewLeave) {
      try {
        const balanceRes = await api.get('/leave/balance');
        setBalance(balanceRes.data);
      } catch { /* non-critical */ }

      try {
        const leavesRes = await api.get('/leave/my-requests');
        setRecentLeaves(leavesRes.data.slice(0, 5));
      } catch { /* non-critical */ }
    }

    if (canViewRestaurant) {
      try {
        const menuRes = await api.get('/restaurant/menu');
        const today = moment().format('jYYYY/jMM/jDD');
        setTodayReservations(menuRes.data.filter(m => m.food_date === today));
      } catch { /* non-critical */ }
    }

    try {
      const annRes = await api.get('/announcements/active');
      setActiveAnnouncements(annRes.data.slice(0, 5));
    } catch { /* non-critical */ }
  }, [canViewLeave, canViewRestaurant]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadData(), 500);
    };
    window.addEventListener('ws-update', handleUpdate);
    return () => {
      window.removeEventListener('ws-update', handleUpdate);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [loadData]);

  // Determine which shortcuts to show
  const shortcuts = [
    canViewLeave && {
      to: '/leave',
      icon: '🏖️',
      title: 'ثبت مرخصی'
    },
    canViewRestaurant && {
      to: '/restaurant',
      icon: '🍽️',
      title: 'رزرو غذا'
    },
    canViewLetters && {
      to: '/letters',
      icon: '📨',
      title: 'نامه‌های اداری'
    },
    canViewChat && {
      to: '/chat',
      icon: '💬',
      title: 'چت داخلی'
    },
  ].filter(Boolean);

  const showWidgetsSection = canViewLeave || canViewRestaurant;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-l from-primary-600 via-primary-700 to-primary-900 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-primary-900/10">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-20 -translate-y-20 pointer-events-none blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold mb-3">
              <span>👋</span>
              <span>داشبورد پرسنلی</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              خوش آمدید، {user?.full_name || 'همکار گرامی'}
            </h1>
            <p className="text-primary-100 text-sm md:text-base mt-1.5 opacity-90">
              امیدواریم روز کاری پرانرژی و موفقی داشته باشید.
            </p>
          </div>
          <div className="text-right md:text-left bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-2xl border border-white/10 self-start md:self-auto">
            <p className="text-xs text-primary-200">تاریخ امروز</p>
            <p className="text-sm md:text-base font-bold mt-0.5">{moment().format('jYYYY/jMM/jDD - dddd')}</p>
          </div>
        </div>
      </div>

      {/* User Onboarding & Setup Checklist */}
      <OnboardingChecklist onProfileUpdated={loadData} />

      {/* Beta / Testing Mode Notice Card */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 rounded-2xl md:rounded-3xl p-4 md:p-5 border border-amber-300/80 shadow-sm flex items-start gap-3.5 animate-fade-in text-amber-950">
        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center text-xl flex-shrink-0 mt-0.5">
          ⚠️
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-sm md:text-base text-amber-900">
              اطلاعیه مهم: سامانه در وضعیت آزمایشی
            </h3>
            <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
              نسخه آزمایشی
            </span>
          </div>
          <p className="text-xs md:text-sm text-amber-800/90 leading-relaxed">
            سامانه به صورت آزمایشی فعال است و ممکن است بعضی قسمت‌های آن برای برخی کارکنان هنوز فعال نباشد. لطفاً مراحل راهنمای راه‌اندازی حساب کاربری را کامل کنید و منتظر بمانید؛ به زودی تمامی امکانات برای همه در دسترس قرار می‌گیرد.
          </p>
        </div>
      </div>

      {/* Quick Access Shortcuts (Filtered by Permission) */}
      {shortcuts.length > 0 && (
        <div className={`grid grid-cols-2 sm:grid-cols-${Math.min(shortcuts.length, 4)} gap-3 md:gap-4`}>
          {shortcuts.map((sc) => (
            <Link
              key={sc.to}
              to={sc.to}
              className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-200 hover:-translate-y-0.5 transition-all text-center group"
            >
              <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">{sc.icon}</span>
              <span className="text-xs md:text-sm font-bold text-gray-700 group-hover:text-primary-600">{sc.title}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Announcements */}
      {activeAnnouncements.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm md:text-base">
            <span>📢</span> آخرین اطلاعیه‌ها و پیام‌های عمومی
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {activeAnnouncements.map(a => {
              const priorityColors = {
                normal: 'border-gray-200 bg-white hover:border-gray-300',
                important: 'border-amber-300 bg-amber-50/70 hover:border-amber-400',
                urgent: 'border-red-400 bg-red-50/70 hover:border-red-500'
              };
              const priorityBadges = {
                normal: null,
                important: <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">مهم</span>,
                urgent: <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">فوری</span>
              };
              return (
                <div key={a.id} className={`rounded-2xl border p-4 md:p-5 shadow-sm transition-all ${priorityColors[a.priority] || priorityColors.normal}`}>
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm md:text-base text-gray-800">{a.title}</h4>
                      {priorityBadges[a.priority]}
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">{toJalali(a.created_at)}</span>
                  </div>
                  {a.body && <p className="text-xs md:text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{a.body}</p>}
                  {a.image_path && (
                    <img src={a.image_path} alt={a.title} className="mt-3 w-full max-h-56 object-cover rounded-xl border border-gray-100" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Information Cards (Leave balance, Recent leaves, Today food) - Filtered by Permission */}
      {showWidgetsSection && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {canViewLeave && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                <span>🏖️</span> مانده مرخصی استحقاقی
              </h3>
              {balance ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>کل سهمیه سالانه:</span>
                    <span className="font-bold text-gray-800">{balance.total_days} روز ({balance.total_days * 8} ساعت)</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>استفاده شده:</span>
                    <span className="font-bold text-red-500">
                      {balance.used_days_display} روز و {balance.used_hours_display} ساعت
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-primary-500 h-2.5 rounded-full transition-all"
                      style={{ width: `${balance.total_days > 0 ? Math.max(0, Math.min(100, ((balance.total_days * 8 - balance.used_hours) / (balance.total_days * 8)) * 100)) : 0}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
                    <span className="text-gray-700 font-medium">مانده قابل استفاده:</span>
                    <span className="font-bold text-green-600">
                      {balance.remaining_days} روز و {balance.remaining_hours_only} ساعت
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400">در حال دریافت اطلاعات...</p>
              )}
            </div>
          )}

          {canViewLeave && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                <span>📨</span> وضعیت آخرین مرخصی‌ها
              </h3>
              <div className="space-y-2">
                {recentLeaves.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2 text-center">درخواستی اخیراً ثبت نشده است</p>
                ) : (
                  recentLeaves.map(leave => (
                    <div key={leave.id} className="flex justify-between items-center text-xs p-2.5 bg-gray-50 rounded-xl">
                      <span className="font-medium text-gray-700">{leave.leave_type}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
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
          )}

          {canViewRestaurant && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                <span>🍽️</span> وعده غذایی امروز
              </h3>
              <div className="space-y-2">
                {todayReservations.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2 text-center">غذایی برای امروز تعریف نشده است</p>
                ) : (
                  todayReservations.map(food => (
                    <div key={food.id} className="flex justify-between items-center text-xs p-2.5 bg-gray-50 rounded-xl">
                      <span className="font-medium text-gray-700">{food.food_name}</span>
                      <span className="text-[11px] text-gray-500 font-semibold">{food.price ? `${food.price.toLocaleString()} تومان` : 'رایگان'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

