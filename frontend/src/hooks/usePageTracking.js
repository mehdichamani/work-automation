import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const routeTitleMap = {
  '/': 'داشبورد عمومی',
  '/admin-dashboard': 'داشبورد مدیریتی',
  '/leave': 'مرخصی',
  '/overtime': 'اضافه کار',
  '/letters': 'نامه‌ها و مکاتبات',
  '/inventory': 'انبار و کارتکس',
  '/restaurant': 'رستوران و غذا',
  '/admin': 'پنل مدیریت',
  '/workflow': 'گردش کار',
  '/signature': 'امضای دیجیتال',
  '/chat': 'گفتگو و پیام‌رسان',
  '/job-application': 'پرسشنامه استخدامی',
  '/shifts': 'شیفت‌های کاری',
  '/admin/import-users': 'ورود و خروج کاربران',
  '/purchase': 'درخواست خرید',
  '/mission': 'ماموریت',
  '/work-order': 'کاربرگ داخلی',
  '/payment': 'درخواست وجه',
  '/repair': 'تعمیرات داخلی',
  '/repair-external': 'تعمیرات خارجی',
  '/it': 'درخواست IT',
  '/conference': 'رزرو اتاق کنفرانس',
  '/security': 'گزارش حراست',
  '/daily-output': 'آمار تولید روزانه',
  '/project-supply': 'تامین کالا',
  '/inspection': 'بازرسی فنی',
  '/reports': 'گزارش‌گیری جامع',
  '/audit-log': 'لاگ فعالیت‌ها',
  '/profile': 'پروفایل کاربری',
  '/daily-work-report': 'گزارش کار روزانه',
  '/learning': 'آموزش پرسنل',
  '/admin/educational': 'مدیریت آموزش',
};

export default function usePageTracking() {
  const location = useLocation();
  const { user } = useAuth();
  const lastTrackedPath = useRef('');

  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath === '/login' || currentPath === lastTrackedPath.current) {
      return;
    }
    lastTrackedPath.current = currentPath;

    const pageTitle = routeTitleMap[currentPath] || document.title || currentPath;

    // Small delay to allow batching / avoid blocking rendering
    const timer = setTimeout(() => {
      api.post('/analytics/track', {
        path: currentPath,
        pageTitle,
        userId: user?.id || null,
      }).catch(() => {
        // Silently ignore tracking errors
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [location.pathname, user?.id]);
}
