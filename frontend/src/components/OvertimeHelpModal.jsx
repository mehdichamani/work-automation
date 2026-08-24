import React, { useState } from 'react';

const tabs = [
  { id: 'register', label: 'ثبت اضافه کار', icon: '📝' },
  { id: 'rules', label: 'ساعات مجاز و قوانین', icon: '⏱️' },
  { id: 'workflow', label: 'گردش کار تاییدات', icon: '🔄' },
  { id: 'security', label: 'رویت انتظامات', icon: '🛡️' },
  { id: 'admin', label: 'کارکرد و ویرایش', icon: '📊' },
];

export default function OvertimeHelpModal({ isOpen, onClose }) {
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
              <h3 className="text-lg font-bold text-gray-800">راهنمای سامانه مدیریت اضافه‌کاری</h3>
              <p className="text-xs text-gray-500 mt-0.5">قوانین زمانی، نحوه محاسبه، مراحل گردش کار و تاییدات</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
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
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-medium rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                activeTab === t.id
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
          {/* تب ثبت اضافه کار */}
          {activeTab === 'register' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-1.5">
                  <span>📌</span> نحوه ثبت درخواست اضافه کار
                </h4>
                <p className="text-xs md:text-sm text-blue-800">
                  برای ثبت درخواست جدید، کافی است روی دکمه «+ ثبت درخواست جدید» کلیک کنید. سپس تاریخ شروع و پایان به همراه ساعت‌های مدنظر و دلیل اضافه کاری را وارد نمایید.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span className="text-base">👤</span> ثبت برای خودم
                  </div>
                  <p className="text-xs md:text-sm text-gray-600">
                    پرسنل می‌توانند برای شیفت‌های خارج از ساعت کاری موظفی خود، درخواست اضافه کار انفرادی ثبت کنند.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span className="text-base">👥</span> ثبت برای زیرمجموعه (گروهی / تکی)
                  </div>
                  <p className="text-xs md:text-sm text-gray-600">
                    سرپرستان و مدیران می‌توانند برای یک یا چند نفر از پرسنل واحد خود به صورت هم‌زمان اضافه کار ثبت کرده و در صورت تمایل گزینه «به همراه خودم» را نیز فعال نمایند.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs md:text-sm flex items-start gap-2.5">
                <span className="text-lg">⚠️</span>
                <div>
                  <strong className="block mb-0.5">محدودیت ثبت تاریخ گذشته:</strong>
                  امکان ثبت درخواست اضافه کار برای روزهای سپری شده وجود ندارد مگر با دسترسی مدیر سیستم (ادمین).
                </div>
              </div>
            </div>
          )}

          {/* تب قوانین و ساعات مجاز */}
          {activeTab === 'rules' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                <h4 className="font-bold text-emerald-900 flex items-center gap-2 mb-1.5">
                  <span>⏱️</span> بازه‌های زمانی مجاز برای ثبت اضافه کار
                </h4>
                <p className="text-xs md:text-sm text-emerald-800">
                  ساعات مجاز اضافه کار بر اساس تقویم کاری و روزهای هفته به شرح زیر است:
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-gray-50/70">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold text-base">🏢</span>
                    <span className="font-medium text-gray-800">روزهای عادی کاری (شنبه تا چهارشنبه)</span>
                  </div>
                  <span className="font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-lg text-xs">
                    از ساعت ۱۶:۳۰ الی ۲۴:۰۰
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-gray-50/70">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500 font-bold text-base">📅</span>
                    <span className="font-medium text-gray-800">روزهای پنج‌شنبه</span>
                  </div>
                  <span className="font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-lg text-xs">
                    از ساعت ۱۳:۳۰ الی ۲۴:۰۰
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-gray-50/70">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-500 font-bold text-base">🌴</span>
                    <span className="font-medium text-gray-800">روزهای جمعه و تعطیلات رسمی تقویم</span>
                  </div>
                  <span className="font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-lg text-xs">
                    از ساعت ۰۸:۰۰ صبح الی ۲۴:۰۰
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs md:text-sm">
                💡 <strong>محاسبه ساعات:</strong> ساعت شروع و پایان با گام‌های ۳۰ دقیقه‌ای انتخاب شده و بر اساس مدت دقیق محاسبه می‌شوند.
              </div>
            </div>
          )}

          {/* تب گردش کار */}
          {activeTab === 'workflow' && (
            <div className="space-y-4 animate-fade-in">
              <h4 className="font-bold text-gray-800 mb-2">مراحل گردش کار و تایید اضافه کار</h4>

              <div className="relative border-r-2 border-primary-200 mr-4 pr-6 space-y-6">
                <div className="relative">
                  <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-primary-500 border-2 border-white ring-2 ring-primary-200"></div>
                  <div className="font-bold text-gray-800 text-sm">۱. ثبت درخواست اولیه</div>
                  <p className="text-xs text-gray-600 mt-1">
                    درخواست توسط پرسنل یا سرپرست ثبت شده و در وضعیت <strong>«در انتظار سرپرست»</strong> قرار می‌گیرد.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-white ring-2 ring-blue-200"></div>
                  <div className="font-bold text-gray-800 text-sm">۲. بررسی سرپرست واحد</div>
                  <p className="text-xs text-gray-600 mt-1">
                    سرپرست مستقیم درخواست را بررسی کرده و می‌تواند با درج توضیحات آن را تایید یا رد کند. با تایید سرپرست، وضعیت به <strong>«در انتظار مدیر»</strong> تغییر می‌یابد.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-amber-500 border-2 border-white ring-2 ring-amber-200"></div>
                  <div className="font-bold text-gray-800 text-sm">۳. بررسی و تایید نهایی مدیر</div>
                  <p className="text-xs text-gray-600 mt-1">
                    مدیر واحد یا مدیر ارشد با تایید نهایی درخواست، وضعیت را به <strong>«تایید شده»</strong> تغییر می‌دهد. همچنین امکان تایید یا رد گروهی اضافه کارها توسط مدیر فراهم است.
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute -right-[31px] top-0 w-4 h-4 rounded-full bg-green-500 border-2 border-white ring-2 ring-green-200"></div>
                  <div className="font-bold text-gray-800 text-sm">۴. اصلاح زمان تردد واقعی (در صورت نیاز)</div>
                  <p className="text-xs text-gray-600 mt-1">
                    در صورتی که پرسنل زودتر یا دیرتر از ساعت درخواستی از شرکت خارج شود، مدیران و کاربران مجاز می‌توانند ساعت پایان واقعی را اصلاح نمایند.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* تب رویت انتظامات */}
          {activeTab === 'security' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                <h4 className="font-bold text-purple-900 flex items-center gap-2 mb-1.5">
                  <span>🛡️</span> نقش انتظامات / حراست
                </h4>
                <p className="text-xs md:text-sm text-purple-800">
                  واحد حراست و نگهبانی به لیست اضافه کارهای تایید شده دسترسی دارند تا هنگام خروج پرسنل مجوز تردد آن‌ها را بررسی کنند.
                </p>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/60 space-y-3">
                <div className="font-bold text-gray-800 flex items-center gap-2">
                  <span>✅</span> فرآیند ثبت رویت توسط نگهبانی
                </div>
                <ul className="text-xs md:text-sm space-y-2 text-gray-600 list-disc list-inside">
                  <li>نگهبانی در تب <strong>«رویت حراست»</strong> اسامی پرسنلی که اضافه کار تایید شده دارند را مشاهده می‌کند.</li>
                  <li>پس از تطبیق ساعت و خروج پرسنل، با زدن دکمه <strong>«رویت شد»</strong> خروج ثبت نهایی می‌شود.</li>
                  <li>این فرآیند از خروج‌های غیرمجاز یا مغایرت کارکرد جلوگیری به عمل می‌آورد.</li>
                </ul>
              </div>
            </div>
          )}

          {/* تب کارکرد و ویرایش اداری */}
          {activeTab === 'admin' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-1.5">
                  <span>📊</span> کارکرد اضافه کار و اختیارات اداری
                </h4>
                <p className="text-xs md:text-sm text-indigo-800">
                  گزارشات کامل و ابزارهای مدیریتی برای بررسی کارکرد ماهانه و کنترل اضافه کارها:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span className="text-base">📈</span> کارکرد اضافه کار پرسنل
                  </div>
                  <p className="text-xs md:text-sm text-gray-600">
                    مشاهده مجموع ساعات تایید شده هر یک از پرسنل به همراه جزئیات برای محاسبه دقیق در حقوق و دستمزد.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span className="text-base">🖨️</span> چاپ و خروجی لیست
                  </div>
                  <p className="text-xs md:text-sm text-gray-600">
                    امکان دریافت نسخه چاپی مرتب و رسمی از اضافه کارهای هر بخش با استفاده از دکمه پرینت در بالای جداول.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-xs md:text-sm">
                ⚙️ <strong>ویرایش و حذف:</strong> درخواست‌های در انتظار تا قبل از تایید نهایی توسط درخواست‌دهنده قابل ویرایش یا لغو هستند. ادمین سیستم به عملیات حذف و ویرایش کلی دسترسی دارد.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">اتوماسیون اداری - اروم شیشه ساچی</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            متوجه شدم
          </button>
        </div>
      </div>
    </div>
  );
}
