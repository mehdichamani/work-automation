import React, { useState } from 'react';

const tabs = [
  { id: 'register', label: 'ثبت مرخصی', icon: '📝' },
  { id: 'calc', label: 'محاسبه و تعطیلات', icon: '⏱️' },
  { id: 'workflow', label: 'گردش کار تاییدات', icon: '🔄' },
  { id: 'security', label: 'رویت انتظامات', icon: '🛡️' },
  { id: 'admin', label: 'امور اداری و ویرایش', icon: '⚙️' },
];

export default function LeaveHelpModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('register');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-3 md:p-6 animate-fade-in">
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📖</span>
            <div>
              <h3 className="text-lg font-bold text-gray-800">راهنمای سامانه مدیریت مرخصی</h3>
              <p className="text-xs text-gray-500 mt-0.5">قوانین، نحوه محاسبه، مراحل گردش کار و تاییدات</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            title="بستن"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-gray-200 px-4 py-2.5 gap-2 bg-gray-50/70 no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-medium rounded-xl whitespace-nowrap transition-all ${activeTab === t.id
                  ? 'bg-primary-500 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm leading-relaxed text-gray-700 bg-white flex-1">
          {activeTab === 'register' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-1.5">
                  <span>📌</span> نحوه ثبت درخواست مرخصی
                </h4>
                <p className="text-xs md:text-sm text-blue-800">
                  برای ثبت درخواست جدید، کافی است روی دکمه «+ درخواست جدید» کلیک کنید. سیستم با توجه به تاریخ و ساعات انتخابی شما، روزانه یا ساعتی بودن مرخصی را تشخیص داده و ساعات را محاسبه می‌کند.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span className="text-base">🕒</span> مرخصی ساعتی و روزانه
                  </div>
                  <ul className="text-xs md:text-sm space-y-1.5 text-gray-600 list-disc list-inside">
                    <li>انتخاب ساعت شروع و پایان از ۸:۰۰ صبح به بعد با گام‌های نیم‌ساعته امکان‌پذیر است.</li>
                    <li>امکان ثبت درخواست برای یک روز یا بازه‌های چند روزه وجود دارد.</li>
                    <li>امکان ثبت مرخصی برای تاریخ‌های گذشته وجود ندارد.</li>
                  </ul>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span className="text-base">👥</span> ثبت برای زیرمجموعه
                  </div>
                  <p className="text-xs md:text-sm text-gray-600">
                    سرپرستان و مدیران می‌توانند در صورت نیاز، هنگام ثبت فرم گزینه «نیروهای زیرمجموعه» را انتخاب کرده و از طرف پرسنل واحد خود درخواست مرخصی ثبت نمایند.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs md:text-sm flex items-start gap-2.5">
                <span className="text-lg">⚠️</span>
                <div>
                  <strong className="block mb-0.5">وضعیت کاری شیفتی:</strong>
                  پرسنل با وضعیت کاری «شیفتی» امکان ثبت درخواست مرخصی جدید در این سامانه را ندارند و روال مرخصی آن‌ها بر اساس برنامه شیفت تنظیم می‌گردد.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calc' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <h4 className="font-bold text-emerald-900 flex items-center gap-2 mb-1">
                  <span>⏱️</span> قوانین محاسبه ساعت و کسر از مانده مرخصی
                </h4>
                <p className="text-xs md:text-sm text-emerald-800">
                  سامانه به صورت اتوماتیک تقویم، ساعات کاری و ایام تعطیل را بررسی کرده و ساعات دقیق را از مانده مرخصی کسر می‌کند.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-3">
                  <span className="p-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">شنبه تا چهارشنبه</span>
                  <div className="text-xs md:text-sm">
                    <p className="font-semibold text-gray-800">ساعت کاری روزانه استاندارد (۸:۰۰ الی ۱۷:۰۰)</p>
                    <p className="text-gray-600 mt-0.5">
                      در روزهای عادی، مرخصی روزانه کامل از ساعت ۸:۰۰ تا ۱۷:۰۰ معادل <strong>۸ ساعت کاری</strong> محاسبه شده و از سهمیه کسر می‌گردد.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-3">
                  <span className="p-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-bold">پنج‌شنبه‌ها</span>
                  <div className="text-xs md:text-sm">
                    <p className="font-semibold text-gray-800">سقف ساعت کاری تا ۱۲:۰۰</p>
                    <p className="text-gray-600 mt-0.5">
                      در روزهای پنج‌شنبه، بازه کاری سامانه تا ساعت <strong>۱۲:۰۰</strong> محاسبه و منظور می‌شود.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-3">
                  <span className="p-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold">جمعه‌ها و تعطیلات</span>
                  <div className="text-xs md:text-sm">
                    <p className="font-semibold text-gray-800">عدم کسر از مانده مرخصی</p>
                    <p className="text-gray-600 mt-0.5">
                      روزهای جمعه و همچنین تعطیلات رسمی ثبت‌شده در سیستم، در بازه‌های چند روزه به عنوان روز کاری محاسبه نشده و <strong>هیچ ساعتی از مرخصی کسر نخواهد شد</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'workflow' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-1">
                  <span>🔄</span> چرخه و مراحل گردش کار تاییدات
                </h4>
                <p className="text-xs md:text-sm text-indigo-800">
                  فرآیند تایید بسته به نوع مرخصی (روزانه یا ساعتی) به شرح زیر است:
                </p>
              </div>

              {/* Step Flow Diagram */}
              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-blue-200 bg-blue-50/50">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">۱</span>
                  <div className="text-xs md:text-sm">
                    <strong className="text-blue-950">مرحله اول: تایید سرپرست مستقیم</strong>
                    <p className="text-gray-600 mt-0.5">
                      درخواست ثبت‌شده با وضعیت «در انتظار سرپرست» در کارتابل سرپرست قرار می‌گیرد تا تایید یا رد شود.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-orange-200 bg-orange-50/50">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-orange-600 text-white text-xs font-bold shrink-0">۲</span>
                  <div className="text-xs md:text-sm">
                    <strong className="text-orange-950">مرحله دوم: بررسی امور اداری (فقط مرخصی روزانه)</strong>
                    <p className="text-gray-600 mt-0.5">
                      <span className="font-semibold text-orange-900">مرخصی‌های روزانه</span> پس از تایید سرپرست، جهت بررسی سوابق و مانده به کارتابل اداری ارسال می‌شوند. <br />
                      <span className="text-gray-500 font-medium">💡 مرخصی‌های ساعتی نیازی به تایید اداری ندارند و مستقیماً به مرحله مدیر می‌روند.</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-green-200 bg-green-50/50">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-green-600 text-white text-xs font-bold shrink-0">۳</span>
                  <div className="text-xs md:text-sm">
                    <strong className="text-green-950">مرحله سوم: تایید نهایی مدیریت</strong>
                    <p className="text-gray-600 mt-0.5">
                      مدیر مربوطه درخواست را بررسی کرده و با تایید ایشان وضعیت به «تایید شده» تغییر می‌یابد.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-100 rounded-xl text-xs text-gray-600">
                در صورت رد درخواست در هر یک از مراحل، فرآیند متوقف شده و وضعیت با رنگ قرمز به «رد شده» همراه با توضیحات تغییر می‌کند.
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                <h4 className="font-bold text-purple-900 flex items-center gap-2 mb-1">
                  <span>🛡️</span> رویت انتظامات (حراست)
                </h4>
                <p className="text-xs md:text-sm text-purple-800">
                  نحوه ثبت تردد و رویت پرسنل هنگام خروج از شرکت
                </p>
              </div>

              <div className="space-y-2.5 text-xs md:text-sm">
                <div className="p-3.5 border border-gray-200 rounded-xl bg-white">
                  <h5 className="font-bold text-gray-800 mb-1">ارسال به کارتابل انتظامات</h5>
                  <p className="text-gray-600">
                    تمامی مرخصی‌هایی که به مرحله «تایید شده» می‌رسند، به صورت خودکار در تب «رویت انتظامات» پرسنل حراست قرار می‌گیرند.
                  </p>
                </div>

                <div className="p-3.5 border border-gray-200 rounded-xl bg-white">
                  <h5 className="font-bold text-gray-800 mb-1">ثبت زمان خروج</h5>
                  <p className="text-gray-600">
                    هنگام خروج فرد از مجموعه، مامور انتظامات با کلیک بر روی دکمه «رویت شد»، وضعیت را به <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md font-medium text-xs">رویت شده (انتظامات)</span> تغییر می‌دهد.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-1">
                  <span>⚙️</span> قابلیت‌های واحد اداری و ویرایش پس از خروج
                </h4>
                <p className="text-xs md:text-sm text-blue-800">
                  ابزارهای در اختیار واحد اداری جهت تطبیق زمان‌های واقعی تردد و مدیریت مانده مرخصی
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span>✏️</span> قابلیت ویرایش ساعت پس از رویت
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600">
                    در صورتی که پرسنل زودتر یا دیرتر از ساعت ثبت‌شده به شرکت بازگردند یا ساعت خروج تغییر کند، مسئولین اداری دارای دسترسی می‌توانند ساعت پایان مرخصی را ویرایش کنند.
                  </p>
                  <p className="text-xs text-primary-600 mt-2 font-medium">
                    ⚡ با ویرایش ساعت، سیستم مابه‌التفاوت ساعت استفاده‌شده را مجدداً محاسبه کرده و مانده مرخصی پرسنل را به صورت خودکار اصلاح می‌کند.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span>📊</span> مدیریت سهمیه و مانده منفی
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600">
                    واحد اداری امکان تعیین سهمیه کل سالانه برای هر پرسنل و مشاهده وضعیت مانده‌های منفی را در تب‌های «مانده مرخصی کارکنان» و «مدیریت سهمیه‌ها» دارا می‌باشد.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs md:text-sm font-medium rounded-xl transition-colors"
          >
            بستن راهنما
          </button>
        </div>
      </div>
    </div>
  );
}
