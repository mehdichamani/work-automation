import { useState, useEffect, useMemo } from 'react';
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

  // Notification status
  const [notifPermission, setNotifPermission] = useState('default');

  // Contact details from profile
  const [contactData, setContactData] = useState({
    phone: user?.phone || '',
    email: user?.email || '',
    loaded: false
  });

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

    // 4. Fetch latest profile
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
  }, []);

  // Listen to PWA install events
  useEffect(() => {
    const handleAppInstalled = () => {
      setIsStandalone(true);
      toast.success('برنامه با موفقیت نصب شد!');
    };
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  // Completion calculation
  // Step 1: Password changed
  const isPasswordDone = user?.must_change_password === 0 || user?.must_change_password === false;

  // Step 2: PWA Installed
  const isPwaDone = isStandalone;

  // Step 3: Notification Permission
  const isNotifDone = notifPermission === 'granted';

  // Step 4: Contact info provided
  const isContactDone = Boolean(
    (contactData.phone && contactData.phone.trim().length >= 10) ||
    (user?.phone && user.phone.trim().length >= 10)
  );

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
      onClick: () => {
        // If prompt available directly, try prompt first or open modal
        if (window.deferredPrompt && !browserInfo.isIOS) {
          window.deferredPrompt.prompt();
          window.deferredPrompt.userChoice.then(({ outcome }) => {
            if (outcome === 'accepted') {
              setIsStandalone(true);
              toast.success('درخواست نصب تایید شد');
            }
            window.deferredPrompt = null;
          }).catch(() => {
            setActiveModal('pwa');
          });
        } else {
          setActiveModal('pwa');
        }
      }
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
    <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 md:p-6 border border-primary-100 shadow-xl shadow-primary-900/5 transition-all duration-300">
      {/* Header section with progress bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-primary-400 text-white flex items-center justify-center text-2xl shadow-lg shadow-primary-500/25 flex-shrink-0 animate-pulse">
            🧭
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-gray-900 flex items-center gap-2">
              راهنمای راه‌اندازی و تکمیل حساب کاربری
              {isAllDone && <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">۱۰۰٪ تکمیل شده</span>}
            </h2>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">
              مراحل زیر را جهت ارتقای امنیت و تجربه کاربری بهتر در سامانه انجام دهید.
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex flex-col items-start sm:items-end min-w-[140px]">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-gray-500">{completedCount} از {steps.length} مرحله</span>
            <span className="text-sm font-extrabold text-primary-600 font-mono">{progressPercent}٪</span>
          </div>
          <div className="w-full sm:w-36 h-2.5 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
            <div
              className="h-full bg-gradient-to-r from-primary-500 via-primary-600 to-emerald-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 100% Success Banner if all done */}
      {isAllDone && (
        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100/60 border border-emerald-200 flex items-center gap-3 text-emerald-900 animate-fade-in">
          <span className="text-2xl">🎉</span>
          <div className="flex-1">
            <p className="text-sm font-bold">تبریک! حساب کاربری شما کاملاً آماده و پیکربندی شده است.</p>
            <p className="text-xs text-emerald-700 mt-0.5">تمامی موارد امنیتی و دسترسی‌های لازم با موفقیت فعال شده‌اند.</p>
          </div>
        </div>
      )}

      {/* Steps List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${
              step.isDone
                ? 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300'
                : 'bg-white hover:bg-gray-50/80 border-gray-200 hover:border-primary-300 shadow-sm'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-transform ${
                step.isDone ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-gray-100 text-gray-700'
              }`}>
                {step.isDone ? '✓' : step.icon}
              </div>
              <div className="min-w-0 pr-1 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-bold truncate ${step.isDone ? 'text-emerald-900 line-through opacity-85' : 'text-gray-800'}`}>
                    {step.title}
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                    step.isDone
                      ? 'bg-emerald-100 text-emerald-700'
                      : step.id === 'password'
                      ? 'bg-red-100 text-red-700 animate-pulse'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {step.badgeText}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1 leading-5">
                  {step.desc}
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 mr-3">
              <button
                onClick={step.onClick}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 flex items-center gap-1.5 shadow-sm ${
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

      {/* --- MODAL 1: Password Change --- */}
      {activeModal === 'password' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-100 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🔐</span>
                <h3 className="text-lg font-bold text-gray-900">تغییر رمز عبور</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              جهت امنیت بالاتر و جلوگیری از سوءاستفاده، رمزی قوی شامل حداقل ۵ کاراکتر انتخاب نمایید.
            </p>

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">رمز عبور فعلی</label>
                <input
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={e => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                  placeholder="رمز فعلی یا کد پرسنلی"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-left"
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
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-left"
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
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-left"
                  dir="ltr"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-primary-600/20 disabled:opacity-50"
                >
                  {submittingPassword ? 'در حال ثبت...' : 'ذخیره رمز جدید'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl border border-gray-100 text-right space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📲</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">راهنمای نصب وب‌اپلیکیشن</h3>
                  <p className="text-xs text-primary-600 font-semibold">مرورگر شناسایی شده: {browserInfo.browserName}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {/* iOS Safari Guide */}
            {browserInfo.isIOS ? (
              <div className="space-y-3 text-sm text-gray-700 bg-amber-50/60 p-4 rounded-2xl border border-amber-200">
                <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
                  <span>🍎</span> راهنمای نصب در آیفون / آیپد (Safari):
                </div>
                <ol className="space-y-2 text-xs text-amber-950 list-decimal list-inside leading-6">
                  <li>حتماً سامانه را در مرورگر <strong>Safari</strong> باز کنید (مرورگرهای دیگر در iOS امکان نصب ندارند).</li>
                  <li>در نوار پایین مرورگر، روی دکمه <strong>اشتراک‌گذاری (Share ⬆️)</strong> کلیک کنید.</li>
                  <li>منو را به پایین اسکرول کرده و گزینه <strong>Add to Home Screen (افزودن به صفحه اصلی ➕)</strong> را انتخاب نمایید.</li>
                  <li>در بالا سمت راست روی <strong>Add</strong> بزنید.</li>
                </ol>
              </div>
            ) : browserInfo.isAndroid ? (
              <div className="space-y-3 text-sm text-gray-700 bg-blue-50/60 p-4 rounded-2xl border border-blue-200">
                <div className="flex items-center gap-2 font-bold text-blue-900 text-sm">
                  <span>🤖</span> راهنمای نصب در اندروید (Chrome / Samsung):
                </div>
                <ol className="space-y-2 text-xs text-blue-950 list-decimal list-inside leading-6">
                  <li>روی دکمه سه‌نقطه (⋮) در بالا سمت راست مرورگر بزنید.</li>
                  <li>گزینه <strong>«نصب برنامه» (Install App)</strong> یا <strong>«افزودن به صفحه اصلی» (Add to Home screen)</strong> را انتخاب کنید.</li>
                  <li>در پیام باز شده روی <strong>نصب (Install)</strong> کلیک نمایید.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-gray-700 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <span>💻</span> راهنمای نصب در ویندوز و دسکتاپ (Chrome / Edge):
                </div>
                <ol className="space-y-2 text-xs text-slate-800 list-decimal list-inside leading-6">
                  <li>در نوار آدرس بالای مرورگر (سمت راست آدرس)، روی آیکون <strong>نصب برنامه (➕ یا 💻)</strong> کلیک کنید.</li>
                  <li>یا از منوی سه‌نقطه مرورگر، گزینه <strong>«نصب اتوماسیون» (Install App)</strong> را انتخاب کنید.</li>
                  <li>برنامه مانند یک نرم‌افزار دسکتاپ و با آیکون مستقل باز خواهد شد.</li>
                </ol>
              </div>
            )}

            {/* Browser recommendation box */}
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 text-xs text-gray-600 space-y-1.5">
              <p className="font-bold text-gray-800 flex items-center gap-1.5">
                <span>💡</span> پیشنهاد مرورگر جهت بیشترین سازگاری:
              </p>
              <p>
                برای بهترین عملکرد و سرعت، پیشنهاد می‌شود از مرورگر <strong>Google Chrome</strong>، <strong>Microsoft Edge</strong> یا در محصولات اپل از <strong>Safari</strong> استفاده فرمایید.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-md shadow-primary-600/20"
              >
                متوجه شدم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Notification Guide & Status --- */}
      {activeModal === 'notification' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-100 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🔔</span>
                <h3 className="text-lg font-bold text-gray-900">وضعیت اعلان‌های مرورگر</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {notifPermission === 'granted' ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-2">
                <p className="font-bold text-sm flex items-center gap-2">
                  <span>✅</span> اعلان‌های سیستم فعال هستند
                </p>
                <p className="text-xs text-emerald-700 leading-5">
                  پیام‌ها، گردش نامه‌ها و درخواست‌های جدید به محض صدور به صورت نوتیفیکیشن دسکتاپ/گوشی به شما نمایش داده خواهند شد.
                </p>
              </div>
            ) : notifPermission === 'denied' ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 space-y-2.5">
                <p className="font-bold text-sm flex items-center gap-2 text-red-700">
                  <span>⚠️</span> دسترسی اعلان مسدود (Block) شده است
                </p>
                <p className="text-xs text-red-700 leading-relaxed">
                  مرورگر شما دسترسی به نوتیفیکیشن را رد کرده است. برای فعال‌سازی مجدد:
                </p>
                <ol className="text-xs text-red-900 space-y-1.5 list-decimal list-inside pr-1">
                  <li>روی علامت قفل 🔒 یا تنظیمات سایت کنار آدرس سایت کلیک کنید.</li>
                  <li>گزینه <strong>Notifications (اعلان‌ها)</strong> را روی <strong>Allow (مجاز)</strong> قرار دهید.</li>
                  <li>صفحه را با زدن کلید F5 رفرش نمایید.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  با فعال‌سازی اعلان‌ها، هر زمان نامه جدیدی ارجاع شود یا پاسخی دریافت کنید فوراً مطلع می‌شوید.
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
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-primary-600/20"
                >
                  درخواست مجوز اعلان مرورگر
                </button>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Contact Information --- */}
      {activeModal === 'contact' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-gray-100 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📞</span>
                <h3 className="text-lg font-bold text-gray-900">تکمیل اطلاعات تماس</h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              شماره موبایل جهت ارسال پیامک‌های اضطراری و بازیابی رمز عبور استفاده می‌شود.
            </p>

            <form onSubmit={handleContactSubmit} className="space-y-3.5">
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
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-left ${
                    contactErrors.phone ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
                  }`}
                  dir="ltr"
                  required
                />
                {contactErrors.phone && <p className="text-red-500 text-[11px] mt-1">{contactErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">آدرس ایمیل سازمانی یا شخصی (اختیاری)</label>
                <input
                  type="email"
                  value={contactForm.email}
                  onChange={e => {
                    setContactForm({ ...contactForm, email: e.target.value });
                    setContactErrors({ ...contactErrors, email: '' });
                  }}
                  placeholder="name@company.com"
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-left ${
                    contactErrors.email ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
                  }`}
                  dir="ltr"
                />
                {contactErrors.email && <p className="text-red-500 text-[11px] mt-1">{contactErrors.email}</p>}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submittingContact}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-md shadow-primary-600/20 disabled:opacity-50"
                >
                  {submittingContact ? 'در حال ثبت...' : 'ذخیره اطلاعات تماس'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
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
