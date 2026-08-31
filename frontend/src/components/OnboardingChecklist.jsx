import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

function detectBrowserAndOS() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge|OPR|Brave/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isSamsung = /SamsungBrowser/.test(ua);
  const isEdge = /Edg/.test(ua);

  let browserName = 'مرورگر استاندارد';
  if (isSamsung) browserName = 'Samsung Internet';
  else if (isEdge) browserName = 'Microsoft Edge';
  else if (isChrome) browserName = 'Google Chrome';
  else if (isSafari) browserName = 'Apple Safari';
  else if (isFirefox) browserName = 'Mozilla Firefox';

  return {
    isIOS,
    isAndroid,
    isMobile: isIOS || isAndroid,
    browserName,
    isChrome,
    isSafari,
    isFirefox,
    isSamsung,
    isEdge,
    supportsDirectInstall: !isIOS && ('BeforeInstallPromptEvent' in window || window.deferredPrompt)
  };
}

export default function OnboardingChecklist({ onProfileUpdated }) {
  const { user, updateUserFields } = useAuth();

  // Dialog States
  const [activeModal, setActiveModal] = useState(null); // 'password' | 'pwa' | 'notification' | 'contact' | null
  const [browserInfo, setBrowserInfo] = useState(detectBrowserAndOS());

  // Standalone detection
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Notification status
  const [notifPermission, setNotifPermission] = useState('default');

  // Contact details from profile
  const [contactData, setContactData] = useState({
    phone: user?.phone || '',
    email: user?.email || '',
    loaded: false
  });

  // Collapsed state for mobile or user preference
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Loading states
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [submittingContact, setSubmittingContact] = useState(false);

  // Forms
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
  const [contactForm, setContactForm] = useState({ phone: '', email: '' });
  const [contactErrors, setContactErrors] = useState({ phone: '', email: '' });

  // Load initial environment & profile data
  useEffect(() => {
    // 1. Standalone
    const standaloneCheck = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(standaloneCheck);

    // 2. Notification
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }

    // 3. Browser Info
    setBrowserInfo(detectBrowserAndOS());

    // 4. Capture PWA install prompt
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
    }
    const handlePrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      window.deferredPrompt = e;
    };
    const handleCustomPromptAvailable = () => {
      if (window.deferredPrompt) {
        setDeferredPrompt(window.deferredPrompt);
      }
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('pwa-prompt-available', handleCustomPromptAvailable);

    // 5. Fetch latest profile
    api.get('/profile').then(res => {
      setContactData({
        phone: res.data.phone || '',
        email: res.data.email || '',
        loaded: true
      });
      setContactForm({
        phone: res.data.phone || '',
        email: res.data.email || ''
      });
      if (res.data.must_change_password !== undefined && user?.must_change_password !== res.data.must_change_password) {
        updateUserFields({ must_change_password: res.data.must_change_password });
      }
    }).catch(() => {
      setContactData(prev => ({ ...prev, loaded: true }));
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('pwa-prompt-available', handleCustomPromptAvailable);
    };
  }, []);

  // Listen to PWA install events
  useEffect(() => {
    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      window.deferredPrompt = null;
      toast.success('برنامه با موفقیت نصب شد 🎉');
    };
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  // Completion calculation
  const isPasswordDone = user?.must_change_password === 0 || user?.must_change_password === false;
  const isPwaDone = isStandalone;
  const isNotifDone = notifPermission === 'granted';
  const isContactDone = Boolean(
    (contactData.phone && contactData.phone.trim().length >= 10) ||
    (user?.phone && user.phone.trim().length >= 10)
  );

  const triggerDirectInstall = async () => {
    const promptEvent = deferredPrompt || window.deferredPrompt;
    if (promptEvent && !browserInfo.isIOS) {
      promptEvent.prompt();
      try {
        const { outcome } = await promptEvent.userChoice;
        if (outcome === 'accepted') {
          setIsStandalone(true);
          toast.success('درخواست نصب تایید شد 🎉');
          setActiveModal(null);
        }
      } catch {
        setActiveModal('pwa');
      }
      setDeferredPrompt(null);
      window.deferredPrompt = null;
    } else {
      setActiveModal('pwa');
    }
  };

  const steps = [
    {
      id: 'password',
      title: 'تغییر رمز عبور اولیه',
      desc: isPasswordDone ? 'رمز عبور با موفقیت تغییر یافته و ایمن است' : 'جهت حفظ امنیت، رمز عبور پیش‌فرض خود را تغییر دهید',
      icon: '🔐',
      isDone: isPasswordDone,
      badgeText: isPasswordDone ? 'انجام شده' : 'ضروری',
      actionText: isPasswordDone ? 'تغییر مجدد' : 'تغییر رمز',
      onClick: () => {
        setPasswordForm({ oldPassword: '', newPassword: '', confirmNewPassword: '' });
        setActiveModal('password');
      }
    },
    {
      id: 'pwa',
      title: 'نصب وب‌اپلیکیشن (PWA)',
      desc: isPwaDone ? 'سامانه به عنوان نرم‌افزار بر روی دستگاه شما نصب است' : 'دسترسی سریع‌تر، تمام‌صفحه و آفلاین شبیه اپلیکیشن بومی',
      icon: '📱',
      isDone: isPwaDone,
      badgeText: isPwaDone ? 'نصب شده' : 'پیشنهادی',
      actionText: isPwaDone ? 'مشاهده وضعیت' : 'نصب و راهنما',
      onClick: triggerDirectInstall
    },
    {
      id: 'notification',
      title: 'فعال‌سازی اعلان‌های مرورگر',
      desc: isNotifDone ? 'دریافت فوری پیام‌ها، تاییدیه‌ها و رویدادهای مهم فعال است' : 'اعلان لحظه‌ای برای درخواست‌ها، مرخصی و چت سازمانی',
      icon: '🔔',
      isDone: isNotifDone,
      badgeText: isNotifDone ? 'فعال' : notifPermission === 'denied' ? 'مسدود شده' : 'غیرفعال',
      actionText: isNotifDone ? 'بررسی وضعیت' : 'فعال‌سازی سریع',
      onClick: async () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'default') {
            try {
              const res = await Notification.requestPermission();
              setNotifPermission(res);
              if (res === 'granted') {
                toast.success('اعلان‌های مرورگر با موفقیت فعال شدند 🎉');
                new Notification('اتوماسیون اداری', {
                  body: 'اعلان‌های مرورگر شما با موفقیت متصل شدند.',
                  icon: '/logo.webp'
                });
              } else if (res === 'denied') {
                setActiveModal('notification');
              }
            } catch {
              setActiveModal('notification');
            }
          } else {
            setActiveModal('notification');
          }
        } else {
          toast.error('مرورگر شما از سیستم اعلان وب پشتیبانی نمی‌کند');
        }
      }
    },
    {
      id: 'contact',
      title: 'تکمیل اطلاعات تماس و ایمیل',
      desc: isContactDone ? `شماره همراه ثبت شده: ${contactData.phone || user?.phone || '-'}` : 'جهت دریافت پیامک‌های سیستم و بازیابی آسان رمز عبور',
      icon: '📞',
      isDone: isContactDone,
      badgeText: isContactDone ? 'تکمیل شده' : 'پیشنهادی',
      actionText: isContactDone ? 'ویرایش تماس' : 'تکمیل مشخصات',
      onClick: () => {
        setContactForm({
          phone: contactData.phone || user?.phone || '',
          email: contactData.email || user?.email || ''
        });
        setContactErrors({ phone: '', email: '' });
        setActiveModal('contact');
      }
    }
  ];

  const completedCount = steps.filter(s => s.isDone).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const isAllDone = completedCount === steps.length;

  // Handle password submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      toast.error('لطفاً همه فیلدها را پر کنید');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      toast.error('رمز جدید و تکرار آن یکسان نیستند');
      return;
    }
    if (passwordForm.newPassword.length < 5) {
      toast.error('رمز عبور باید حداقل ۵ کاراکتر باشد');
      return;
    }

    setSubmittingPassword(true);
    try {
      await api.post('/auth/change-password', {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });
      toast.success('رمز عبور با موفقیت تغییر کرد 🎉');
      updateUserFields({ must_change_password: 0 });
      setActiveModal(null);
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در تغییر رمز عبور');
    } finally {
      setSubmittingPassword(false);
    }
  };

  // Handle contact submit
  const handleContactSubmit = async (e) => {
    e.preventDefault();
    let hasErr = false;
    const errors = { phone: '', email: '' };

    if (contactForm.phone && !/^09\d{9}$/.test(contactForm.phone)) {
      errors.phone = 'شماره موبایل باید ۱۱ رقم بوده و با ۰۹ شروع شود';
      hasErr = true;
    }
    if (contactForm.email && (!contactForm.email.includes('@') || !contactForm.email.includes('.'))) {
      errors.email = 'فرمت ایمیل صحیح نمی‌باشد';
      hasErr = true;
    }

    if (hasErr) {
      setContactErrors(errors);
      return;
    }

    setSubmittingContact(true);
    try {
      await api.put('/profile', {
        phone: contactForm.phone,
        email: contactForm.email
      });
      setContactData({
        phone: contactForm.phone,
        email: contactForm.email,
        loaded: true
      });
      updateUserFields({
        phone: contactForm.phone,
        email: contactForm.email
      });
      toast.success('اطلاعات تماس با موفقیت ذخیره شد 🎉');
      setActiveModal(null);
      if (onProfileUpdated) onProfileUpdated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ثبت اطلاعات تماس');
    } finally {
      setSubmittingContact(false);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl md:rounded-3xl p-3.5 sm:p-5 md:p-6 border border-primary-100/80 shadow-lg shadow-primary-900/5 transition-all">
      {/* Header section with progress bar */}
      <div className="flex flex-col gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl bg-gradient-to-tr from-primary-600 to-primary-400 text-white flex items-center justify-center text-lg md:text-xl shadow-md shadow-primary-500/20 flex-shrink-0">
              🧭
            </div>
            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-bold text-gray-900 truncate flex items-center gap-1.5">
                راهنمای راه‌اندازی حساب
                {isAllDone && (
                  <span className="text-[10px] md:text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
                    ۱۰۰٪
                  </span>
                )}
              </h2>
              <p className="text-[11px] md:text-xs text-gray-500 truncate">
                مراحل راه‌اندازی و تکمیل امنیت حساب کاربری
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-xs text-primary-600 font-bold bg-primary-50 hover:bg-primary-100 px-2.5 py-1 rounded-xl transition-colors flex items-center gap-1 flex-shrink-0"
          >
            <span>{isCollapsed ? 'نمایش' : 'بستن'}</span>
            <span className="text-[10px]">{isCollapsed ? '▼' : '▲'}</span>
          </button>
        </div>

        {/* Progress Bar Row */}
        <div className="flex items-center gap-3 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100">
          <div className="flex-1">
            <div className="flex justify-between items-center text-[11px] mb-1">
              <span className="text-gray-500 font-medium">{completedCount} از {steps.length} مرحله انجام شده</span>
              <span className="font-extrabold text-primary-600 font-mono">{progressPercent}٪</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 via-primary-600 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 100% Success Banner if all done */}
      {!isCollapsed && isAllDone && (
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/70 border border-emerald-200 flex items-center gap-2.5 text-emerald-900 animate-fade-in">
          <span className="text-xl">🎉</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs md:text-sm font-bold">تبریک! حساب کاربری شما کاملاً آماده است.</p>
            <p className="text-[10px] md:text-xs text-emerald-700 mt-0.5">تمام موارد امنیتی و دسترسی‌های لازم فعال شده‌اند.</p>
          </div>
        </div>
      )}

      {/* Steps List (Mobile & Desktop Responsive) */}
      {!isCollapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {steps.map((step) => (
            <div
              key={step.id}
              onClick={step.onClick}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer select-none active:scale-[0.99] gap-3 ${
                step.isDone
                  ? 'bg-emerald-50/30 border-emerald-200/70 hover:border-emerald-300'
                  : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-primary-300 shadow-sm'
              }`}
            >
              {/* Content area */}
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-base sm:text-lg flex-shrink-0 mt-0.5 ${
                  step.isDone ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700'
                }`}>
                  {step.isDone ? '✓' : step.icon}
                </div>
                
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-xs sm:text-sm font-bold ${step.isDone ? 'text-emerald-900' : 'text-gray-800'}`}>
                      {step.title}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                      step.isDone
                        ? 'bg-emerald-100 text-emerald-700'
                        : step.id === 'password'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {step.badgeText}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed break-words">
                    {step.desc}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end sm:flex-shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    step.onClick();
                  }}
                  className={`w-full sm:w-auto justify-center px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                    step.isDone
                      ? 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
                      : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-500/20'
                  }`}
                >
                  <span>{step.actionText}</span>
                  <span className="text-[10px] opacity-70">←</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- MODAL 1: Password Change --- */}
      {activeModal === 'password' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-100 text-right space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔐</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">تغییر رمز عبور</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              جهت امنیت بالاتر و جلوگیری از سوءاستفاده، رمزی شامل حداقل ۵ کاراکتر انتخاب نمایید.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">رمز عبور فعلی</label>
                <input
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                  placeholder="رمز فعلی یا کد پرسنلی"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500 outline-none text-left"
                  dir="ltr"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">رمز عبور جدید</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="حداقل ۵ کاراکتر"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500 outline-none text-left"
                  dir="ltr"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">تکرار رمز عبور جدید</label>
                <input
                  type="password"
                  value={passwordForm.confirmNewPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value })}
                  placeholder="تکرار دقیق رمز جدید"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500 outline-none text-left"
                  dir="ltr"
                  required
                />
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-primary-600/20 disabled:opacity-50"
                >
                  {submittingPassword ? 'در حال ثبت...' : 'ذخیره رمز جدید'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: PWA Installation Guide --- */}
      {activeModal === 'pwa' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 md:p-8 w-full max-w-lg shadow-2xl border border-gray-100 text-right space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📲</span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">راهنمای نصب وب‌اپلیکیشن</h3>
                  <p className="text-[11px] text-primary-600 font-semibold">مرورگر شما: {browserInfo.browserName}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* iOS Safari Guide */}
            {browserInfo.isIOS ? (
              <div className="space-y-2.5 text-xs text-gray-700 bg-amber-50/70 p-3.5 rounded-xl border border-amber-200">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
                  <span>🍎</span> راهنمای نصب در آیفون / آیپد (Safari):
                </div>
                <ol className="space-y-1.5 text-amber-950 list-decimal list-inside leading-5">
                  <li>سامانه را در مرورگر <strong>Safari</strong> باز کنید.</li>
                  <li>در نوار پایین صفحه، دکمه <strong>Share (⬆️)</strong> را بزنید.</li>
                  <li>گزینه <strong>Add to Home Screen (➕)</strong> را انتخاب کنید.</li>
                  <li>در بالای صفحه روی <strong>Add</strong> بزنید.</li>
                </ol>
              </div>
            ) : browserInfo.isAndroid ? (
              <div className="space-y-2.5 text-xs text-gray-700 bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 text-xs">
                  <span>🤖</span> راهنمای نصب در اندروید (Chrome / Samsung):
                </div>
                <ol className="space-y-1.5 text-blue-950 list-decimal list-inside leading-5">
                  <li>روی منوی سه‌نقطه (⋮) بالای مرورگر کلیک کنید.</li>
                  <li>گزینه <strong>«نصب برنامه»</strong> یا <strong>«افزودن به صفحه اصلی»</strong> را بزنید.</li>
                  <li>در پیام باز شده روی <strong>نصب (Install)</strong> کلیک کنید.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-gray-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                  <span>💻</span> راهنمای نصب در ویندوز (Chrome / Edge):
                </div>
                <ol className="space-y-1.5 text-slate-800 list-decimal list-inside leading-5">
                  <li>در نوار آدرس بالای صفحه روی آیکون <strong>نصب برنامه (➕ یا 💻)</strong> کلیک کنید.</li>
                  <li>یا از منوی سه‌نقطه مرورگر، گزینه <strong>«نصب اتوماسیون»</strong> را انتخاب کنید.</li>
                </ol>
              </div>
            )}

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-[11px] text-gray-600 space-y-1">
              <p className="font-bold text-gray-800 flex items-center gap-1">
                <span>💡</span> پیشنهاد مرورگر:
              </p>
              <p>
                برای بهترین سرعت پیشنهاد می‌شود از <strong>Google Chrome</strong>، <strong>Microsoft Edge</strong> یا در اپل از <strong>Safari</strong> استفاده کنید.
              </p>
            </div>

            <div className="pt-2 flex gap-2.5 justify-end">
              {(deferredPrompt || window.deferredPrompt) && !browserInfo.isIOS && !isStandalone && (
                <button
                  type="button"
                  onClick={triggerDirectInstall}
                  className="flex-1 sm:flex-initial bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md shadow-primary-600/20"
                >
                  نصب مستقیم برنامه
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold text-xs sm:text-sm transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Notification Guide & Status --- */}
      {activeModal === 'notification' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-100 text-right space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔔</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">اعلان‌های مرورگر</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {notifPermission === 'granted' ? (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-1.5">
                <p className="font-bold text-xs flex items-center gap-1.5">
                  <span>✅</span> اعلان‌های سیستم فعال هستند
                </p>
                <p className="text-[11px] text-emerald-700 leading-4">
                  پیام‌ها و رویدادهای جدید به صورت آنی به شما اعلان داده می‌شوند.
                </p>
              </div>
            ) : notifPermission === 'denied' ? (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 space-y-2">
                <p className="font-bold text-xs flex items-center gap-1.5 text-red-700">
                  <span>⚠️</span> دسترسی اعلان مسدود شده است
                </p>
                <p className="text-[11px] text-red-700 leading-4">
                  برای فعال‌سازی: روی آیکون قفل 🔒 کنار آدرس سایت کلیک کرده و Notifications را Allow کنید، سپس صفحه را رفرش فرمایید.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-gray-600 leading-5">
                  با فعال‌سازی اعلان‌ها، هر زمان پیام یا نامه‌ای دریافت کنید فوراً مطلع می‌شوید.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await Notification.requestPermission();
                      setNotifPermission(res);
                      if (res === 'granted') {
                        toast.success('اعلان‌های مرورگر فعال شدند');
                        setActiveModal(null);
                      }
                    } catch { /* ignored */ }
                  }}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm"
                >
                  درخواست مجوز اعلان
                </button>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-bold text-xs sm:text-sm"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Contact Information --- */}
      {activeModal === 'contact' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-100 text-right space-y-3.5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📞</span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900">اطلاعات تماس</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              شماره موبایل جهت دریافت پیامک‌های سیستم و بازیابی رمز عبور استفاده می‌شود.
            </p>

            <form onSubmit={handleContactSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">شماره تلفن همراه</label>
                <input
                  type="text"
                  value={contactForm.phone}
                  onChange={e => {
                    setContactForm({ ...contactForm, phone: e.target.value });
                    setContactErrors({ ...contactErrors, phone: '' });
                  }}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className={`w-full px-3 py-2 border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500 outline-none text-left ${
                    contactErrors.phone ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
                  }`}
                  dir="ltr"
                  required
                />
                {contactErrors.phone && <p className="text-red-500 text-[10px] mt-1">{contactErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">ایمیل (اختیاری)</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={e => {
                    setContactForm({ ...contactForm, email: e.target.value });
                    setContactErrors({ ...contactErrors, email: '' });
                  }}
                  placeholder="name@company.com"
                  className={`w-full px-3 py-2 border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-primary-500 outline-none text-left ${
                    contactErrors.email ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
                  }`}
                  dir="ltr"
                />
                {contactErrors.email && <p className="text-red-500 text-[10px] mt-1">{contactErrors.email}</p>}
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="submit"
                  disabled={submittingContact}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-primary-600/20 disabled:opacity-50"
                >
                  {submittingContact ? 'در حال ثبت...' : 'ذخیره مشخصات'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
