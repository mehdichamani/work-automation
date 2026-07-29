import { useState, useEffect } from 'react';

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export default function PWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed) return;

    if (isIOS()) {
      setIsIOSDevice(true);
      setShowInstall(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstall(false);
      localStorage.setItem('pwa_install_dismissed', '1');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowInstall(false);
    localStorage.setItem('pwa_install_dismissed', '1');
  };

  if (!showInstall) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-4 md:right-auto md:max-w-xs z-50 animate-fade-in">
      <div className="bg-primary-600 text-white rounded-2xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-xl">📲</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">نصب برنامه روی گوشی</p>
            {isIOSDevice ? (
              <div className="text-xs text-primary-200 mt-1 space-y-1">
                <p>۱. روی دکمه <span className="font-bold text-white">اشتراک گذاری</span> (⬆️) پایین صفحه بزنید</p>
                <p>۲. گزینه <span className="font-bold text-white">افزودن به صفحه اصلی</span> را انتخاب کنید</p>
                <p>۳. روی <span className="font-bold text-white">افزودن</span> تپ کنید</p>
              </div>
            ) : (
              <p className="text-xs text-primary-200 mt-0.5">برای استفاده آفلاین روی صفحه اصلی نصب کنید</p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          {!isIOSDevice && (
            <button
              onClick={handleInstall}
              className="flex-1 bg-white text-primary-600 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-50 transition-colors active:scale-95"
            >
              نصب برنامه
            </button>
          )}
          <button
            onClick={handleDismiss}
            className={`${isIOSDevice ? 'flex-1' : ''} bg-primary-500 text-primary-100 py-2.5 rounded-xl text-sm font-bold hover:bg-primary-400 transition-colors active:scale-95`}
          >
            بعداً
          </button>
        </div>
      </div>
    </div>
  );
}
