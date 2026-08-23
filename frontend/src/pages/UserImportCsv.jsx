import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function UserImportCsv() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState(null); // { total, valid, invalid, rows }
  const [rawCsvText, setRawCsvText] = useState('');
  const [rawFileName, setRawFileName] = useState('');
  const [importLogs, setImportLogs] = useState([]);
  const [importProgress, setImportProgress] = useState(null); // { current, total, percent, batch, totalBatches, status: 'processing'|'done'|'error', error }
  const fileInputRef = useRef(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, deptRes, logsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/departments'),
        api.get('/admin/users/import-csv-logs').catch(() => ({ data: [] }))
      ]);

      const usersList = Array.isArray(usersRes.data?.data) ? usersRes.data.data : (Array.isArray(usersRes.data) ? usersRes.data : []);
      const deptList = Array.isArray(deptRes.data?.data) ? deptRes.data.data : (Array.isArray(deptRes.data) ? deptRes.data : []);
      const logsList = Array.isArray(logsRes.data?.data) ? logsRes.data.data : (Array.isArray(logsRes.data) ? logsRes.data : []);

      setUsers(usersList);
      setDepartments(deptList);
      setImportLogs(logsList);
    } catch (err) {
      toast.error('خطا در بارگذاری اطلاعات اولیه کاربران و واحدها');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toEnglishDigits = (str) => {
    if (str === null || str === undefined) return '';
    const persianNumbers = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
    const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    let res = String(str);
    for (let i = 0; i < 10; i++) {
      res = res.replace(persianNumbers[i], String(i)).replace(arabicNumbers[i], String(i));
    }
    return res.trim();
  };

  const roleMap = {
    'admin': 'admin',
    'manager': 'manager',
    'supervisor': 'supervisor',
    'user': 'user',
    'مدیر سیستم': 'admin',
    'مدیرسیستم': 'admin',
    'مدیر ارشد': 'admin',
    'مدیر': 'manager',
    'مدیریت': 'manager',
    'سرپرست': 'supervisor',
    'کاربر': 'user',
    'عادی': 'user',
    'کاربر عادی': 'user',
    'پرسنل': 'user',
    'کارمند': 'user'
  };

  const workTypeMap = {
    'normal': 'normal',
    'shift': 'shift',
    'عادی': 'normal',
    'عادی کار': 'normal',
    'عادی‌کار': 'normal',
    'روزکار': 'normal',
    'روز کار': 'normal',
    'شیفتی': 'shift',
    'شیفت': 'shift',
    'نوبت کاری': 'shift',
    'نوبت‌کار': 'shift'
  };

  const aliases = {
    id: ['id', 'personal_code', 'personnel_code', 'code', 'user_id', 'شناسه', 'کد پرسنلی', 'کدپرسنلی', 'کد', 'شماره پرسنلی', 'کد_پرسنلی', 'پرسنلی'],
    fullName: ['full_name', 'fullname', 'name', 'نام کامل', 'نام_کامل', 'نام و نام خانوادگی', 'نام', 'نام خانوادگی'],
    role: ['role', 'user_role', 'نقش', 'سمت', 'نوع کاربر', 'نوع کاربری', 'سطح دسترسی', 'نقش کاربر'],
    department: ['department', 'department_name', 'dept', 'واحد', 'نام واحد', 'دپارتمان', 'بخش', 'قسمت'],
    quota: ['total_hours', 'hours', 'quota', 'سهمیه', 'سهمیه (ساعت)', 'سهمیه مرخصی', 'سهمیه ساعت', 'ساعت مرخصی', 'سهمیه مرخصی (ساعت)', 'سهمیه (روز)', 'سهمیه روز', 'total_days', 'days'],
    workType: ['work_type', 'worktype', 'shift', 'وضعیت کاری', 'نوع کار', 'وضعیت کار', 'شیفت', 'نوع شیفت', 'نوع نوبت'],
    password: ['password', 'pass', 'کلمه عبور', 'رمز عبور', 'رمز', 'پسورد', 'گذرواژه']
  };

  const findValueByAliases = (rowObj, aliasList) => {
    for (const alias of aliasList) {
      if (rowObj[alias] !== undefined && rowObj[alias] !== null && String(rowObj[alias]).trim() !== '') {
        return String(rowObj[alias]).trim();
      }
    }
    return '';
  };

  const processFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'txt'].includes(ext)) {
      toast.error('لطفاً فقط فایل با فرمت Excel (.xlsx, .xls) یا CSV (.csv) انتخاب کنید');
      return;
    }

    setRawFileName(file.name);
    setParsing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, codepage: 65001 });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        toast.error('فایل انتخابی هیچ برگه‌ای (Sheet) ندارد');
        return;
      }
      const worksheet = workbook.Sheets[firstSheetName];
      const csvOutput = XLSX.utils.sheet_to_csv(worksheet);
      setRawCsvText(csvOutput);

      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '', header: 1 });
      if (!rawRows || rawRows.length < 2) {
        toast.error('فایل انتخابی خالی است یا ردیف داده ندارد');
        return;
      }

      parseRows(rawRows);
      toast.success(`فایل «${file.name}» با موفقیت پردازش شد`);
    } catch (err) {
      console.error('File parsing error:', err);
      toast.error('خطا در پردازش فایل: ' + (err.message || 'فرمت نامعتبر'));
    } finally {
      setParsing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const parseRows = (rawRows) => {
    const userList = Array.isArray(users) ? users : (Array.isArray(users?.data) ? users.data : []);
    const deptList = Array.isArray(departments) ? departments : (Array.isArray(departments?.data) ? departments.data : []);

    // Find header row (first non-empty row)
    let headerRowIdx = 0;
    while (headerRowIdx < rawRows.length && (!rawRows[headerRowIdx] || rawRows[headerRowIdx].every(c => !String(c).trim()))) {
      headerRowIdx++;
    }

    if (headerRowIdx >= rawRows.length) {
      toast.error('سربرگ جدول یافت نشد');
      return;
    }

    const headers = rawRows[headerRowIdx].map(h => 
      String(h || '').trim().toLowerCase().replace(/^[\uFEFF"']+|["']+$/g, '')
    );

    const rows = [];
    const csvIds = new Set();

    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const columns = rawRows[i];
      if (!columns || columns.every(c => c === undefined || c === null || String(c).trim() === '')) {
        continue; // Skip entirely empty rows
      }

      const rowObj = {};
      headers.forEach((header, index) => {
        if (header) {
          rowObj[header] = columns[index] !== undefined && columns[index] !== null ? String(columns[index]).trim() : '';
        }
      });

      const idStrRaw = findValueByAliases(rowObj, aliases.id);
      const fullName = findValueByAliases(rowObj, aliases.fullName);
      const rawRole = findValueByAliases(rowObj, aliases.role);
      const deptName = findValueByAliases(rowObj, aliases.department);
      const quotaStrRaw = findValueByAliases(rowObj, aliases.quota) || '0';
      const rawWorkType = findValueByAliases(rowObj, aliases.workType);
      const password = findValueByAliases(rowObj, aliases.password);

      const idStr = toEnglishDigits(idStrRaw);
      const quotaStr = toEnglishDigits(quotaStrRaw);

      const id = parseInt(idStr, 10);
      const quotaHours = parseFloat(quotaStr) || 0;
      const normalizedRoleKey = rawRole.toLowerCase().trim();
      const role = roleMap[normalizedRoleKey] || roleMap[rawRole.trim()] || '';
      const normalizedWorkTypeKey = rawWorkType.toLowerCase().trim();
      const work_type = workTypeMap[normalizedWorkTypeKey] || workTypeMap[rawWorkType.trim()] || 'normal';

      const errors = [];
      if (!idStr) {
        errors.push('کد پرسنلی خالی است');
      } else if (isNaN(id) || id <= 0) {
        errors.push('کد پرسنلی باید یک عدد معتبر باشد');
      } else {
        if (csvIds.has(id)) {
          errors.push('کد پرسنلی تکراری در فایل انتخابی');
        }
        csvIds.add(id);

        const existsInDb = userList.some(u => parseInt(u.id, 10) === id);
        if (existsInDb) {
          errors.push('کد پرسنلی قبلاً در سیستم ثبت شده است (ویرایش خواهد شد)');
        }
      }

      if (!fullName) {
        errors.push('نام کامل خالی است');
      }

      if (!rawRole) {
        errors.push('نقش کاربر تعیین نشده است');
      } else if (!role) {
        errors.push(`نقش نامعتبر است (${rawRole}) - باید یکی از مقادیر «مدیر»، «سرپرست» یا «کاربر عادی» باشد`);
      } else if (role === 'admin') {
        errors.push('به دلیل مسائل امنیتی، امکان ثبت نقش مدیر سیستم از طریق فایل گروهی وجود ندارد');
      }

      let deptMessage = '';
      if (deptName.trim()) {
        const deptExists = deptList.some(d => d.name && d.name.toLowerCase() === deptName.trim().toLowerCase());
        if (!deptExists) {
          deptMessage = 'واحد جدید ایجاد خواهد شد';
        }
      }

      rows.push({
        rowNum: i + 1,
        id: id || idStr,
        full_name: fullName,
        role: role || rawRole,
        department_name: deptName.trim(),
        total_hours: quotaHours,
        work_type,
        password,
        errors,
        deptMessage,
        isValid: errors.filter(e => !e.includes('ویرایش خواهد شد')).length === 0,
        isOverwrite: errors.some(e => e.includes('ویرایش خواهد شد'))
      });
    }

    if (rows.length === 0) {
      toast.error('هیچ ردیف داده‌ای در فایل یافت نشد');
      return;
    }

    const validCount = rows.filter(r => r.isValid).length;
    const invalidCount = rows.length - validCount;

    setPreview({
      total: rows.length,
      valid: validCount,
      invalid: invalidCount,
      rows
    });
  };

  const handleImport = async () => {
    if (!preview || preview.valid === 0) {
      toast.error('هیچ ردیف معتبری برای وارد کردن وجود ندارد');
      return;
    }

    const validUsers = preview.rows.filter(r => r.isValid);
    const BATCH_SIZE = 40;
    const totalBatches = Math.ceil(validUsers.length / BATCH_SIZE);

    setUploading(true);
    setImportProgress({
      status: 'processing',
      current: 0,
      total: validUsers.length,
      percent: 0,
      batch: 1,
      totalBatches,
      error: null
    });

    let successCount = 0;

    try {
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, validUsers.length);
        const chunk = validUsers.slice(start, end);

        setImportProgress({
          status: 'processing',
          current: successCount,
          total: validUsers.length,
          percent: Math.round((successCount / validUsers.length) * 100),
          batch: i + 1,
          totalBatches,
          error: null
        });

        const payload = {
          users: chunk,
          ...(i === 0 ? {
            csv_text: rawCsvText,
            file_name: rawFileName,
            total_rows: validUsers.length
          } : {
            skip_log: true
          })
        };

        const res = await api.post('/admin/users/import-csv', payload, {
          timeout: 120000
        });

        successCount += (res.data?.importedCount || chunk.length);

        setImportProgress({
          status: i + 1 === totalBatches ? 'done' : 'processing',
          current: successCount,
          total: validUsers.length,
          percent: Math.round((successCount / validUsers.length) * 100),
          batch: i + 1,
          totalBatches,
          error: null
        });
      }

      toast.success(`تمامی ${validUsers.length} کاربر با موفقیت ثبت و به‌روزرسانی شدند`);
      fetchData();
    } catch (err) {
      const errMsg = err.friendlyMessage || err.response?.data?.error || err.message || 'خطا در ثبت گروهی کاربران';
      setImportProgress(prev => ({
        ...(prev || { current: successCount, total: validUsers.length, percent: 0, batch: 1, totalBatches }),
        status: 'error',
        error: errMsg
      }));
      toast.error(errMsg);
    } finally {
      setUploading(false);
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'مدیر سیستم',
      manager: 'مدیر',
      supervisor: 'سرپرست',
      user: 'کاربر'
    };
    return labels[role] || role;
  };

  const formatHoursToDays = (hours) => {
    const d = Math.floor(hours / 8);
    const h = hours % 8;
    let res = '';
    if (d > 0) res += `${d} روز`;
    if (h > 0) res += `${res ? ' و ' : ''}${h} ساعت`;
    return res || '0 ساعت';
  };

  const downloadSampleExcel = () => {
    const sampleData = [
      ['کد پرسنلی', 'نام کامل', 'نقش', 'واحد', 'سهمیه (ساعت)', 'وضعیت کاری', 'کلمه عبور'],
      [1005, 'رضا محمدی', 'کاربر عادی', 'اداری', 82, 'عادی', '1005'],
      [1006, 'علی علوی', 'سرپرست', 'فناوری اطلاعات', 60, 'عادی', 'pass123'],
      [1007, 'حسن حسینی', 'مدیر', 'تولید و خط', 40, 'شیفتی', '1007']
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');
    XLSX.writeFile(wb, 'sample_users.xlsx');
    toast.success('فایل نمونه اکسل دانلود شد');
  };

  const downloadSampleCsv = () => {
    const sampleText = "کد پرسنلی,نام کامل,نقش,واحد,سهمیه (ساعت),وضعیت کاری,کلمه عبور\n1005,رضا محمدی,کاربر عادی,اداری,82,عادی,1005\n1006,علی علوی,سرپرست,فناوری اطلاعات,60,عادی,pass123\n1007,حسن حسینی,مدیر,تولید و خط,40,شیفتی,1007";
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), sampleText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_users.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('فایل نمونه CSV دانلود شد');
  };

  const downloadCsvFile = async (logId, fileName) => {
    try {
      const res = await api.get(`/admin/users/import-csv-download/${logId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'import_file.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('فایل با موفقیت دانلود شد');
    } catch (err) {
      toast.error('خطا در دانلود فایل');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title section with modern gradient background */}
      <div className="bg-gradient-to-r from-primary-600 via-indigo-600 to-primary-700 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 opacity-10 backdrop-blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">وارد کردن گروهی کاربران</h1>
            <p className="text-white/80 text-sm mt-1">ایجاد و به‌روزرسانی سریع پرسنل به همراه ثبت سهمیه اولیه از طریق فایل اکسل (Excel) یا CSV</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadSampleExcel}
              className="bg-white/20 hover:bg-white/30 border border-white/30 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              📊 دانلود فایل نمونه اکسل (XLSX)
            </button>
            <button
              onClick={downloadSampleCsv}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              📄 دانلود فایل نمونه CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left instructions block */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
              <span>📋</span>
              <span>راهنمای ستون‌های فایل</span>
            </h3>
            <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <p>فایل اکسل یا CSV باید شامل ردیف عناوین (Header) با نام‌های زیر باشد:</p>
              <ul className="list-disc pr-4 space-y-1.5">
                <li><strong className="text-gray-900">کد پرسنلی</strong>: عدد منحصربه‌فرد (اجباری)</li>
                <li><strong className="text-gray-900">نام کامل</strong>: نام و نام خانوادگی (اجباری)</li>
                <li><strong className="text-gray-900">نقش</strong>: مانند <code className="bg-gray-100 px-1 py-0.5 rounded">مدیر</code>، <code className="bg-gray-100 px-1 py-0.5 rounded">سرپرست</code> یا <code className="bg-gray-100 px-1 py-0.5 rounded">کاربر عادی</code></li>
                <li><strong className="text-gray-900">واحد</strong>: نام واحد سازمانی (در صورت نبودن، واحد جدید خودکار ایجاد می‌شود)</li>
                <li><strong className="text-gray-900">سهمیه (ساعت)</strong>: سهمیه سالانه به ساعت — مثلاً <code className="bg-gray-100 px-1 py-0.5 rounded">82</code> ساعت (۱۰ روز و ۲ ساعت)</li>
                <li><strong className="text-gray-900">وضعیت کاری</strong>: مانند <code className="bg-gray-100 px-1 py-0.5 rounded">عادی</code> یا <code className="bg-gray-100 px-1 py-0.5 rounded">شیفتی</code></li>
                <li><strong className="text-gray-900">کلمه عبور</strong>: رمز عبور (در صورت خالی بودن، کد پرسنلی پیش‌فرض است)</li>
              </ul>
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-blue-800 text-xs leading-5">
                💡 در صورتی که کد پرسنلی از قبل در سیستم وجود داشته باشد، اطلاعات کاربری و سهمیه او بدون حذف مرخصی‌های قبلی، <strong>بروزرسانی (Overwrite)</strong> خواهد شد.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
            <h3 className="font-bold text-gray-800 text-base flex items-center justify-between">
              <span>واحدهای اداری فعال</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">{departments.length}</span>
            </h3>
            <div className="max-h-60 overflow-y-auto divide-y text-xs">
              {departments.length === 0 ? (
                <p className="text-gray-400 p-2 text-center">هیچ واحدی تعریف نشده است.</p>
              ) : (
                departments.map(d => (
                  <div key={d.id} className="py-2 flex justify-between items-center hover:bg-gray-50/50 px-1">
                    <span className="font-bold text-gray-700">{d.name}</span>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-lg text-[10px]">فعال</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right main upload and preview block */}
        <div className="lg:col-span-2 space-y-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`bg-white rounded-2xl p-6 shadow-sm border-2 border-dashed transition-all flex flex-col items-center justify-center py-10 text-center ${
              isDragging ? 'border-primary-500 bg-primary-50/30 ring-4 ring-primary-100' : 'border-gray-300 hover:border-primary-400'
            }`}
          >
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center text-3xl mb-3 text-primary-600 shadow-inner">
              {parsing ? '⏳' : isDragging ? '📥' : '📊'}
            </div>
            <p className="text-sm font-bold text-gray-800">
              {parsing ? 'در حال خواندن و پردازش اطلاعات فایل...' : 'فایل اکسل (XLSX, XLS) یا CSV خود را اینجا رها کنید یا انتخاب نمایید'}
            </p>
            <p className="text-xs text-gray-400 mt-1.5">
              پشتیبانی کامل از فایل‌های اکسل مایکروسافت، جداول فارسی و کدهای پرسنلی
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="user-file-picker"
              disabled={parsing || uploading}
            />
            <label
              htmlFor="user-file-picker"
              className={`mt-4 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer shadow-md shadow-primary-500/20 transition-all flex items-center gap-2 ${
                parsing ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <span>📁</span>
              <span>انتخاب فایل اکسل یا CSV</span>
            </label>
          </div>

          {preview && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <span>پیش‌نمایش داده‌های پردازش شده</span>
                    {rawFileName && (
                      <span className="text-xs font-normal bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg font-mono">
                        {rawFileName}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">بررسی وضعیت خطاها، تداخل‌ها و صحت ردیف‌ها قبل از ثبت نهایی</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleImport}
                    disabled={preview.valid === 0 || uploading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    {uploading ? 'در حال ثبت...' : `✅ تایید و ثبت نهایی (${preview.valid} ردیف معتبر)`}
                  </button>
                  <button
                    onClick={() => {
                      setPreview(null);
                      setRawCsvText('');
                      setRawFileName('');
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2.5 rounded-xl transition-all"
                  >
                    انصراف
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-center">
                  <p className="text-xs text-blue-700 font-medium">کل ردیف‌ها</p>
                  <p className="text-xl font-black text-blue-900 mt-1 font-mono">{preview.total}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl text-center">
                  <p className="text-xs text-emerald-700 font-medium">معتبر و آماده ثبت</p>
                  <p className="text-xl font-black text-emerald-900 mt-1 font-mono">{preview.valid}</p>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded-2xl text-center">
                  <p className="text-xs text-red-700 font-medium">ردیف‌های دارای خطا</p>
                  <p className="text-xl font-black text-red-900 mt-1 font-mono">{preview.invalid}</p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto border rounded-2xl max-h-96">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-bold border-b sticky top-0">
                    <tr>
                      <th className="p-3">ردیف</th>
                      <th className="p-3">کد پرسنلی</th>
                      <th className="p-3">نام کامل</th>
                      <th className="p-3">نقش</th>
                      <th className="p-3">واحد</th>
                      <th className="p-3">سهمیه (ساعت)</th>
                      <th className="p-3">وضعیت کاری</th>
                      <th className="p-3">وضعیت بررسی</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.rows.map((row, idx) => (
                      <tr key={idx} className={`hover:bg-gray-50/50 ${row.errors.length > 0 && !row.isValid ? 'bg-red-50/30' : ''}`}>
                        <td className="p-3 text-gray-400 font-mono">{row.rowNum}</td>
                        <td className="p-3 font-bold font-mono text-gray-900">{row.id}</td>
                        <td className="p-3 text-gray-800 font-medium">{row.full_name}</td>
                        <td className="p-3">
                          <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-mono text-[10px]">
                            {getRoleLabel(row.role)}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600 font-semibold">
                          {row.department_name ? (
                            <div className="space-y-0.5">
                              <span>{row.department_name}</span>
                              {row.deptMessage && (
                                <p className="text-[9px] text-amber-600 font-bold">✨ {row.deptMessage}</p>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td className="p-3 font-semibold text-gray-700 font-mono">
                          <div className="space-y-0.5">
                            <span>{row.total_hours} ساعت</span>
                            <p className="text-[9px] text-gray-400">({formatHoursToDays(row.total_hours)})</p>
                          </div>
                        </td>
                        <td className="p-3 text-gray-500 font-mono">{row.work_type === 'shift' ? 'شیفتی' : 'عادی'}</td>
                        <td className="p-3">
                          {row.errors.length === 0 ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">🟢 معتبر (جدید)</span>
                          ) : row.isValid ? (
                            <div className="space-y-0.5">
                              <span className="text-blue-600 font-bold flex items-center gap-1">🔵 معتبر (بروزرسانی)</span>
                              <p className="text-[9px] text-blue-500">کد پرسنلی از قبل در سیستم وجود دارد.</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-red-600 font-bold flex items-center gap-1">🔴 غیرقابل ثبت</span>
                              {row.errors.map((e, ei) => (
                                <p key={ei} className="text-[9px] text-red-500 font-medium">⚠️ {e}</p>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Audit Logs Table Section */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="border-b pb-3">
              <h3 className="font-bold text-gray-800 text-lg">تاریخچه و لاگ ورود‌های گروهی</h3>
              <p className="text-xs text-gray-500 mt-0.5">آرشیو کامل فایل‌های وارد شده به همراه تاریخ، تعداد رکوردها و کاربر ثبت‌کننده جهت نظارت امنیتی</p>
            </div>
            {importLogs.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">هیچ فایل ورودی تاکنون ثبت نشده است.</p>
            ) : (
              <div className="overflow-x-auto border rounded-2xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-gray-50 text-gray-700 font-bold border-b">
                    <tr>
                      <th className="p-3">شناسه لاگ</th>
                      <th className="p-3">نام فایل</th>
                      <th className="p-3">کاربر وارد کننده</th>
                      <th className="p-3">تعداد رکورد</th>
                      <th className="p-3">تاریخ و زمان ورود</th>
                      <th className="p-3">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/50">
                        <td className="p-3 font-mono text-gray-400">{log.id}</td>
                        <td className="p-3 font-bold text-gray-700">{log.file_name}</td>
                        <td className="p-3 text-gray-600">{log.importer_name}</td>
                        <td className="p-3 font-mono font-bold text-blue-700">{log.row_count} کاربر</td>
                        <td className="p-3 font-mono text-gray-500">{log.imported_at}</td>
                        <td className="p-3">
                          <button
                            onClick={() => downloadCsvFile(log.id, log.file_name)}
                            className="bg-primary-50 hover:bg-primary-100 text-primary-700 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all"
                          >
                            📥 دانلود فایل اصلی
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress / Status Modal during Bulk Import */}
      {importProgress && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl border border-gray-100 space-y-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header / State Icon */}
            <div className="flex flex-col items-center text-center space-y-3">
              {importProgress.status === 'processing' && (
                <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center text-3xl text-primary-600 shadow-inner relative">
                  <span className="animate-spin text-2xl">⏳</span>
                </div>
              )}
              {importProgress.status === 'done' && (
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl text-emerald-600 shadow-inner">
                  <span>✅</span>
                </div>
              )}
              {importProgress.status === 'error' && (
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-3xl text-red-600 shadow-inner">
                  <span>⚠️</span>
                </div>
              )}

              <div>
                <h3 className="text-lg md:text-xl font-black text-gray-800">
                  {importProgress.status === 'processing' && 'در حال ثبت و پردازش کاربران...'}
                  {importProgress.status === 'done' && 'ثبت گروهی با موفقیت تکمیل شد'}
                  {importProgress.status === 'error' && 'خطا در فرآیند ثبت کاربران'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {importProgress.status === 'processing' && `در حال پردازش بسته ${importProgress.batch} از ${importProgress.totalBatches}`}
                  {importProgress.status === 'done' && `تمامی ${importProgress.total} کاربر با موفقیت در پایگاه‌داده ذخیره شدند`}
                  {importProgress.status === 'error' && 'عملیات با خطا مواجه شد؛ لطفاً پیام خطا را بررسی نمایید'}
                </p>
              </div>
            </div>

            {/* Progress Bar & Counters */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-gray-600">پیشرفت کل</span>
                <span className="text-primary-600 font-mono text-sm">{importProgress.percent}%</span>
              </div>
              <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    importProgress.status === 'error'
                      ? 'bg-red-500'
                      : importProgress.status === 'done'
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-primary-500 to-indigo-600 animate-pulse'
                  }`}
                  style={{ width: `${Math.max(importProgress.percent, 3)}%` }}
                ></div>
              </div>
              <div className="flex justify-between items-center text-[11px] text-gray-500 font-mono pt-1">
                <span>ردیف‌های ثبت شده: {importProgress.current} نفر</span>
                <span>کل ردیف‌ها: {importProgress.total} نفر</span>
              </div>
            </div>

            {/* Rate-limit and network safety guarantee info note */}
            {importProgress.status === 'processing' && (
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-[11px] text-blue-800 leading-relaxed flex items-start gap-2">
                <span className="text-base">🛡️</span>
                <div>
                  <strong className="font-bold">ثبت دسته‌ای هوشمند:</strong>
                  <p className="text-blue-700 mt-0.5">
                    جهت جلوگیری از Timeout و قطعی شبکه، کاربران در بسته‌های ۴۰ تایی ارسال می‌شوند. لطفاً تا پایان ثبت کامل این پنجره را نبندید.
                  </p>
                </div>
              </div>
            )}

            {/* Error Message if any */}
            {importProgress.status === 'error' && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-3 text-xs text-red-700 leading-relaxed">
                <p className="font-bold">علت خطا:</p>
                <p className="mt-1 font-mono text-[11px] break-words">{importProgress.error}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 flex gap-3">
              {importProgress.status === 'done' && (
                <button
                  onClick={() => {
                    setImportProgress(null);
                    setPreview(null);
                    setRawCsvText('');
                    setRawFileName('');
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-3 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                >
                  <span>متوجه شدم و بستن پنجره</span>
                  <span>✨</span>
                </button>
              )}

              {importProgress.status === 'error' && (
                <div className="w-full flex gap-2">
                  <button
                    onClick={() => setImportProgress(null)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl transition-all"
                  >
                    بستن
                  </button>
                  <button
                    onClick={() => {
                      setImportProgress(null);
                      handleImport();
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 rounded-xl transition-all"
                  >
                    تلاش مجدد
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
