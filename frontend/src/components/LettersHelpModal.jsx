import React, { useState } from 'react';

const tabs = [
  { id: 'register', label: 'ثبت و ارسال نامه', icon: '📝' },
  { id: 'workflow', label: 'گردش کار و وضعیت‌ها', icon: '🔄' },
  { id: 'central', label: 'دبیرخانه و سانترال', icon: '🏢' },
  { id: 'manager', label: 'کارتابل مدیران', icon: '👔' },
  { id: 'unit', label: 'نامه‌های واحد و رویت', icon: '👥' },
];

export default function LettersHelpModal({ isOpen, onClose }) {
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
              <h3 className="text-lg font-bold text-gray-800">راهنمای سامانه مدیریت و گردش نامه‌ها</h3>
              <p className="text-xs text-gray-500 mt-0.5">قوانین ثبت، شماره‌گذاری، مراحل ارجاع، کارتابل سانترال و مدیران</p>
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
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-medium rounded-xl whitespace-nowrap transition-all ${
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
          {/* تب ثبت نامه */}
          {activeTab === 'register' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                <h4 className="font-bold text-blue-900 flex items-center gap-2 mb-1.5">
                  <span>📌</span> نحوه ایجاد و ثبت نامه جدید
                </h4>
                <p className="text-xs md:text-sm text-blue-800">
                  برای ایجاد نامه، روی دکمه «+ نامه جدید» کلیک کنید. پس از باز شدن فرم، فیلدهای شماره نامه، اولویت، موضوع، متن اصلی و فایل‌های پیوست در دسترس خواهند بود.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span className="text-base">🔢</span> شماره‌گذاری اتوماتیک و اولویت
                  </div>
                  <ul className="text-xs md:text-sm space-y-1.5 text-gray-600 list-disc list-inside">
                    <li>شماره نامه به صورت هوشمند بر اساس سال شمسی جاری تخصیص داده می‌شود.</li>
                    <li>
                      اولویت نامه شامل <strong>اولویت ۱ (فوری)</strong>، <strong>اولویت ۲ (متوسط)</strong> و <strong>اولویت ۳ (عادی)</strong> می‌باشد.
                    </li>
                  </ul>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span className="text-base">📎</span> ضوابط فایل‌های پیوست
                  </div>
                  <ul className="text-xs md:text-sm space-y-1.5 text-gray-600 list-disc list-inside">
                    <li>امکان پیوست حداکثر <strong>۱۰ فایل</strong> به صورت همزمان.</li>
                    <li>حداکثر حجم مجاز برای هر فایل <strong>۲۰ مگابایت</strong> است.</li>
                    <li>فرمت‌های مجاز: PDF، اسناد Word و Excel، تصاویر، فایل‌های فشرده (Zip/Rar) و متنی.</li>
                  </ul>
                </div>
              </div>

              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm text-gray-700">
                <strong className="block font-semibold text-gray-900 mb-1">✍️ ویرایشگر پیشرفته متن:</strong>
                امکان نگارش متن با قابلیت‌های تیتربندی، پررنگ‌سازی (Bold)، خط زیر، ترازبندی و لیست‌های نقطه‌ای یا عددی برای ارائه نامه‌های رسمی فراهم شده است.
              </div>
            </div>
          )}

          {/* تب گردش کار */}
          {activeTab === 'workflow' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-1">
                  <span>🔄</span> مراحل گردش کار و وضعیت نامه‌ها
                </h4>
                <p className="text-xs md:text-sm text-indigo-800">
                  فرآیند گردش اداری نامه از لحظه ایجاد تا بایگانی نهایی مطابق مراحل زیر طی می‌شود:
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-blue-200 bg-blue-50/50">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">۱</span>
                  <div className="text-xs md:text-sm">
                    <strong className="text-blue-950">ثبت نامه و ارسال به دبیرخانه (در انتظار سانترال)</strong>
                    <p className="text-gray-600 mt-0.5">
                      نامه پس از ثبت، مستقیماً وارد کارتابل سانترال (دبیرخانه) می‌شود تا مدیر(ان) مربوطه جهت بررسی انتخاب شوند.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-amber-600 text-white text-xs font-bold shrink-0">۲</span>
                  <div className="text-xs md:text-sm">
                    <strong className="text-amber-950">بررسی و تصمیم‌گیری مدیر (در انتظار مدیر)</strong>
                    <p className="text-gray-600 mt-0.5">
                      مدیر انتخاب‌شده نامه را مطالعه کرده و آن را <strong>تایید</strong>، <strong>رد</strong> یا با درج توضیحات عودت می‌دهد.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold shrink-0">۳</span>
                  <div className="text-xs md:text-sm">
                    <strong className="text-emerald-950">ارجاع به واحدها یا بایگانی (تایید شده / ارجاع شده)</strong>
                    <p className="text-gray-600 mt-0.5">
                      پس از تایید مدیر، دبیرخانه نامه را به واحدهای مربوطه ارجاع داده یا مستقیماً به بایگانی سیستم منتقل می‌کند.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs md:text-sm text-gray-600 flex items-center gap-2">
                <span>🕒</span>
                <span>
                  با کلیک روی دکمه <strong>«روند چرخش»</strong> روی هر نامه، می‌توانید تایم‌لاین کامل تمام اقدامات، تاریخ‌ها و توضیحات ثبت‌شده را مشاهده نمایید.
                </span>
              </div>
            </div>
          )}

          {/* تب سانترال و دبیرخانه */}
          {activeTab === 'central' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-purple-50 border border-purple-100 rounded-xl">
                <h4 className="font-bold text-purple-900 flex items-center gap-2 mb-1">
                  <span>🏢</span> وظایف و اختیارات دبیرخانه (سانترال)
                </h4>
                <p className="text-xs md:text-sm text-purple-800">
                  پرسنلی که دارای دسترسی «دبیرخانه / سانترال» هستند، مدیریت گردش و ارجاعات تمامی نامه‌ها را بر عهده دارند.
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-gray-200 rounded-xl p-3.5 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                    <span>📤</span> ارسال به مدیر
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600">
                    در تب «در انتظار سانترال»، مسئول دبیرخانه می‌تواند با کلیک روی «ارسال به مدیر»، یک یا چند مدیر را انتخاب کرده و در صورت تمایل توضیحات لازم را پیوست نماید.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-3.5 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                    <span>↩️</span> مدیریت نامه‌های برگشتی
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600">
                    نامه‌هایی که توسط مدیر رد شده یا نیازمند بازبینی باشند، در تب «برگشتی از مدیر» قرار می‌گیرند تا دبیرخانه علت رد را بررسی و تعیین تکلیف کند.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-3.5 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                    <span>🗄️</span> ارجاع سازمانی و بایگانی
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600">
                    نامه‌های تایید شده می‌توانند با دکمه «ارجاع به واحدها» همزمان برای چندین واحد سازمانی ارسال شوند یا با دکمه «بایگانی» به آرشیو سیستم منتقل گردند.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* تب مدیران */}
          {activeTab === 'manager' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <h4 className="font-bold text-amber-900 flex items-center gap-2 mb-1">
                  <span>👔</span> کارتابل و اختیارات مدیران
                </h4>
                <p className="text-xs md:text-sm text-amber-800">
                  مدیران مربوطه می‌توانند نامه‌های ارجاع‌شده از سوی دبیرخانه را بررسی و تایید یا رد کنند.
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span>📥</span> تب «در انتظار مدیر»
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                    نامه‌هایی که منتظر بررسی شما هستند در این بخش نمایش داده می‌شوند. شما می‌توانید متن کامل نامه، فرستنده، اولویت و فایل‌های پیوست را مشاهده کنید.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span>✅</span> تایید یا رد نامه با دستور و پاراف
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                    قبل از کلیک روی <strong>تایید</strong> یا <strong>رد</strong>، مدیر می‌تواند در کادر توضیحات، دستورات لازم یا دلیل رد نامه را قید کند. با این کار نوتیفیکیشن خودکار برای فرستنده و دبیرخانه ارسال می‌شود.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1.5 flex items-center gap-2">
                    <span>📂</span> تب «اقدام شده توسط من»
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                    سوابق تمامی نامه‌هایی که قبلاً توسط شما تایید یا رد شده‌اند در این بخش به همراه وضعیت و تاریخچه قابل مشاهده و جستجو است.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* تب نامه‌های واحد */}
          {activeTab === 'unit' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl">
                <h4 className="font-bold text-teal-900 flex items-center gap-2 mb-1">
                  <span>👥</span> نامه‌های ارجاع‌شده به واحد و ثبت رویت
                </h4>
                <p className="text-xs md:text-sm text-teal-800">
                  آشنایی با نحوه دسترسی کارکنان واحد به نامه‌های ابلاغ‌شده سازمانی
                </p>
              </div>

              <div className="space-y-3">
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                    <span>📬</span> دریافت نامه‌های واحد
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600">
                    هنگامی که دبیرخانه نامه‌ای را به واحد شما ارجاع دهد، این نامه در تب <strong>«نامه‌های واحد»</strong> برای تمامی اعضای آن واحد قابل مشاهده خواهد بود.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                    <span>👁️</span> ثبت وضعیت «رویت شد»
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600">
                    پرسنل پس از مطالعه نامه می‌توانند روی دکمه <strong>«رویت شد»</strong> کلیک کنند. این عمل در تاریخچه گردش نامه ثبت می‌گردد و مشخص می‌کند چه کسی و در چه زمانی نامه را مطالعه کرده است.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <h5 className="font-bold text-gray-800 mb-1 flex items-center gap-2">
                    <span>🖨️</span> چاپ تکی و لیست نامه‌ها
                  </h5>
                  <p className="text-xs md:text-sm text-gray-600">
                    امکان چاپ رسمی تکی هر نامه به همراه سربرگ و اطلاعات فرستنده/مدیر و همچنین چاپ گروهی لیست نامه‌ها در تمامی تب‌ها در نظر گرفته شده است.
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
