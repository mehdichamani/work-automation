# 📋 برنامه اجرایی پیاده‌سازی بکاپ دستی و محلی پایگاه‌داده (Database Manual Local Backup)

این طرح بر اساس درخواست برای ایجاد یک راهکار **ساده، سریع، پایدار و کاملاً محلی و دستی** صرفاً برای پایگاه‌داده PostgreSQL تدوین شده است تا جایگزین کدهای ناقص و پیچیده قبلی شود.

---

## 🎯 اهداف طرح

1. **فقط پایگاه‌داده (Database Only):** تمرکز ۱۰۰٪ روی تهیه نسخه پشتیبان ساختار و داده‌های دیتابیس PostgreSQL (فایل‌های `.sql` یا `.sql.gz`).
2. **فقط محلی (Local Only):** ذخیره‌سازی فایل‌های خروجی در پوشه امن و محلی سرور (`backend/backups/`) بدون پیچیدگی‌های کلاد یا همگام‌سازی‌های جانبی.
3. **فقط دستی (Manual Only):** مدیریت کامل توسط مدیر سیستم از طریق پنل ادمین (ایجاد بکاپ فوری با یک کلیک، مشاهده لیست، دانلود، بازیابی، و حذف) بدون نیاز به کرون‌جاب‌های پس‌زمینه.
4. **رفع کامل خطاهای کدهای قبلی:** حذف ارجاعات نامعتبر Prisma (مانند `backupSetting` و `backupLog` که در اسکیما وجود نداشتند) و پایدارسازی فرآیند اجرای `pg_dump` و `psql`.

---

## 🛠️ معماری و عملکرد سیستم

```mermaid
flowchart LR
    subgraph AdminUI [پنل مدیریت (فرانت‌اند)]
        BtnCreate[دکمه: ایجاد بکاپ دستی]
        TableList[جدول: لیست فایل‌های بکاپ]
        BtnDownload[دانلود فایل]
        BtnRestore[بازیابی دیتابیس]
        BtnDelete[حذف فایل]
    end

    subgraph BackendAPI [اندپوینت‌های API]
        RouteCreate["POST /api/backup/create"]
        RouteList["GET /api/backup/list"]
        RouteDownload["GET /api/backup/download/:filename"]
        RouteRestore["POST /api/backup/restore/:filename"]
        RouteDelete["DELETE /api/backup/:filename"]
    end

    subgraph Engine [موتور بکاپ محلی]
        PgDumpRunner[اجرای هوشمند pg_dump / Fallback]
        PsqlRunner[اجرای بازیابی با psql]
        Storage[(پوشه محلی: backend/backups)]
        Database[(پایگاه‌داده PostgreSQL)]
    end

    BtnCreate --> RouteCreate --> PgDumpRunner --> Database
    PgDumpRunner --> Storage
    TableList --> RouteList --> Storage
    BtnDownload --> RouteDownload --> Storage
    BtnRestore --> RouteRestore --> PsqlRunner --> Database
    BtnDelete --> RouteDelete --> Storage
```

---

## 📂 تغییرات پیشنهادی در فایل‌ها

### ۱. بخش بک‌اند (Backend)

#### [MODIFY] [backend/routes/backup.js](file:///c:/Users/Mehdi/projects/work-automation/backend/routes/backup.js)
* پاک‌سازی متدهای قدیمی و ناکارآمد (حذف فراخوانی جداول ناموجود پریزما).
* پیاده‌سازی ۵ اندپوینت استاندارد، تمیز و ایمن تحت کنترل نقش `admin`:
  1. `POST /api/backup/create`: اجرای `pg_dump` (با جستجوی خودکار باینری‌های PostgreSQL در مسیرهای مرسوم ویندوز/سیستم و پاس دادن ایمن پسورد) و ذخیره با فرمت تاریخ فارسی/میلادی مشخص در پوشه `backups/`.
  2. `GET /api/backup/list`: اسکن پوشه `backups/` و ارسال نام، اندازه فایل و زمان ایجاد به تفکیک.
  3. `GET /api/backup/download/:file`: اعتبارسنجی نام فایل (جلوگیری از Directory Traversal) و استریم فایل دانلودی برای ادمین.
  4. `POST /api/backup/restore/:file`: اجرای دستور `psql` جهت بازگردانی دیتابیس به فایل انتخابی با لاگ و مدیریت خطای دقیق.
  5. `DELETE /api/backup/:file`: حذف فایل بکاپ انتخاب‌شده از دیسک.

#### [MODIFY] [backend/server.js](file:///c:/Users/Mehdi/projects/work-automation/backend/server.js)
* غیرفعال‌سازی و حذف فراخوانی `backupCron.schedule()` در استارتاپ سرور برای جلوگیری از خطاهای کرون و اجرای تمیز سیستم دستی.

---

### ۲. بخش فرانت‌اند (Frontend)

#### [MODIFY] [frontend/src/pages/AdminPanel.jsx](file:///c:/Users/Mehdi/projects/work-automation/frontend/src/pages/AdminPanel.jsx)
* بازطراحی و زیباسازی تب «بکاپ و بازیابی» (`tab === 'backup'`):
  * **کارت ایجاد بکاپ فوری:** دکمه برجسته «تهیه بکاپ جدید از پایگاه‌داده» به همراه وضعیت لودینگ و نمایش آدرس محل ذخیره محلی.
  * **جدول وضعیت بکاپ‌ها:** نمایش لیست فایل‌های موجود، اندازه خوانا (کیلوبایت/مگابایت)، تاریخ ایجاد (شمسی) و دکمه‌های عملیاتی:
    * 📥 **دانلود:** دانلود مستقیم فایل روی کامپیوتر ادمین.
    * 🔄 **بازیابی:** مودال هشدار جدی قبل از بازیابی با تایید هویت.
    * 🗑️ **حذف:** حذف فایل پشتیبان با تایید کاربر.

---

## 🧪 برنامه اعتبارسنجی و تست (Verification Plan)

### ۱. تست‌های خودکار و بیلد
* اجرای بیلد پروژه فرانت‌اند:
  ```powershell
  cd frontend
  npm run build
  ```
* بررسی صحت اجرای بک‌اند بدون خطای سینتکس و لود صحیح روت‌ها.

### ۲. تست‌های سناریویی و عملیاتی (Manual Verification)
1. ورود با حساب ادمین به سامانه و مراجعه به تب «بکاپ و بازیابی» در پنل مدیریت.
2. کلیک روی «تهیه بکاپ جدید» و اطمینان از ایجاد فایل `.sql` در پوشه `backend/backups/`.
3. تست دانلود فایل بکاپ و بررسی محتوای ساختار SQL جداول.
4. تست حذف یک فایل بکاپ و مشاهده به‌روزرسانی آنی لیست.
5. تست بازیابی بکاپ و اعتبارسنجی پیام موفقیت و ثبات داده‌ها.

---

## 💬 تایید برای اجرا
آیا این برنامه ساده و شفاف مورد تایید است تا عملیات پیاده‌سازی و یکپارچه‌سازی آن آغاز شود؟
