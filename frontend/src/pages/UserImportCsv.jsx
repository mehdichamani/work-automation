import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function UserImportCsv() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null); // { total, valid, invalid, rows }
  const [rawCsvText, setRawCsvText] = useState('');
  const [rawFileName, setRawFileName] = useState('');
  const [importLogs, setImportLogs] = useState([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, deptRes, logsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/departments'),
        api.get('/admin/users/import-csv-logs').catch(() => ({ data: [] }))
      ]);
      setUsers(usersRes.data || []);
      setDepartments(deptRes.data || []);
      setImportLogs(logsRes.data || []);
    } catch (err) {
      toast.error('خطا در بارگذاری اطلاعات اولیه کاربران و واحدها');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('لطفاً فقط فایل با فرمت CSV انتخاب کنید');
      return;
    }

    setRawFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      setRawCsvText(text);
      parseCSV(text);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const roleMap = {
    'admin': 'admin',
    'manager': 'manager',
    'supervisor': 'supervisor',
    'user': 'user',
    'مدیر سیستم': 'admin',
    'مدیرسیستم': 'admin',
    'مدیر': 'manager',
    'سرپرست': 'supervisor',
    'کاربر': 'user',
    'عادی': 'user',
    'کاربر عادی': 'user'
  };

  const workTypeMap = {
    'normal': 'normal',
    'shift': 'shift',
    'عادی': 'normal',
    'عادی کار': 'normal',
    'عادی‌کار': 'normal',
    'شیفتی': 'shift',
    'شیفت': 'shift'
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length < 2) {
      toast.error('فایل CSV خالی است یا ردیف داده ندارد');
      return;
    }

    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

    const rows = [];
    const csvIds = new Set();

    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(separator).map(c => c.replace(/^["']|["']$/g, '').trim());
      const rowObj = {};
      
      headers.forEach((header, index) => {
        rowObj[header] = columns[index] || '';
      });

      const idStr = rowObj['id'] || rowObj['personal_code'] || rowObj['کد پرسنلی'] || rowObj['شناسه'] || '';
      const fullName = rowObj['full_name'] || rowObj['name'] || rowObj['نام کامل'] || rowObj['نام'] || '';
      const rawRole = rowObj['role'] || rowObj['نقش'] || rowObj['سمت'] || '';
      const deptName = rowObj['department'] || rowObj['department_name'] || rowObj['واحد'] || rowObj['نام واحد'] || '';
      const quotaStr = rowObj['total_hours'] || rowObj['total_days'] || rowObj['quota'] || rowObj['سهمیه'] || rowObj['سهمیه (ساعت)'] || rowObj['سهمیه مرخصی'] || '0';
      const rawWorkType = rowObj['work_type'] || rowObj['وضعیت کاری'] || '';
      const password = rowObj['password'] || rowObj['کلمه عبور'] || rowObj['رمز'] || '';

      const id = parseInt(idStr, 10);
      const quotaHours = parseFloat(quotaStr) || 0;
      const role = roleMap[rawRole.trim()] || roleMap[rawRole.toLowerCase().trim()] || '';
      const work_type = workTypeMap[rawWorkType.trim()] || workTypeMap[rawWorkType.toLowerCase().trim()] || 'normal';

      const errors = [];
      if (!idStr) {
        errors.push('کد پرسنلی خالی است');
      } else if (isNaN(id)) {
        errors.push('کد پرسنلی باید عدد باشد');
      } else {
        if (csvIds.has(id)) {
          errors.push('کد پرسنلی تکراری در فایل CSV');
        }
        csvIds.add(id);

        const existsInDb = users.some(u => parseInt(u.id, 10) === id);
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
        errors.push(`نقش نامعتبر است (${rawRole}) - باید یکی از مقادیر «مدیر سیستم»، «مدیر»، «سرپرست» یا «کاربر عادی» باشد`);
      } else if (['admin', 'manager'].includes(role)) {
        errors.push('به دلیل مسائل امنیتی، امکان ثبت نقش مدیر یا مدیر سیستم از طریق فایل گروهی وجود ندارد');
      }

      let deptMessage = '';
      if (deptName.trim()) {
        const deptExists = departments.some(d => d.name.toLowerCase() === deptName.trim().toLowerCase());
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

    try {
      setUploading(true);
      const res = await api.post('/admin/users/import-csv', {
        users: validUsers,
        csv_text: rawCsvText,
        file_name: rawFileName
      });
      toast.success(res.data.message || 'کاربران با موفقیت ثبت شدند');
      setPreview(null);
      setRawCsvText('');
      setRawFileName('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ثبت گروهی کاربران');
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

  const downloadCsvFile = async (logId, fileName) => {
    try {
      const res = await api.get(`/admin/users/import-csv-download/${logId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
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
      {/* Title section with soft gradient background */}
      <div className="bg-gradient-to-r from-primary-500 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 opacity-10 backdrop-blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">وارد کردن گروهی کاربران</h1>
            <p className="text-white/80 text-sm mt-1">ایجاد و به‌روزرسانی سریع پرسنل به همراه ثبت سهمیه اولیه به ساعت از طریق فایل CSV</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const sampleText = "کد پرسنلی,نام کامل,نقش,واحد,سهمیه (ساعت),وضعیت کاری,کلمه عبور\n1005,رضا محمدی,کاربر عادی,اداری,82,عادی,1005\n1006,علی علوی,سرپرست,فناوری اطلاعات,60,عادی,pass123\n1007,حسن حسینی,کاربر عادی,واحد جدید,40,شیفتی,1007";
                const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), sampleText], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sample_users.csv';
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="bg-white/20 hover:bg-white/30 border border-white/30 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
            >
              📥 دانلود فایل نمونه CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left instructions block */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <h3 className="font-bold text-gray-800 text-base">راهنمای ستون‌های فایل CSV</h3>
            <div className="space-y-3 text-xs text-gray-600 leading-relaxed">
              <p>فایل ارسالی باید دارای ردیف سربرگ (Header) با عناوین زیر باشد:</p>
              <ul className="list-disc pr-4 space-y-1.5">
                <li><strong className="text-gray-900">کد پرسنلی</strong>: عدد منحصربه‌فرد (اجباری)</li>
                <li><strong className="text-gray-900">نام کامل</strong>: نام و نام خانوادگی (اجباری)</li>
                <li><strong className="text-gray-900">نقش</strong>: مقادیر فارسی مانند <code className="bg-gray-100 px-1 py-0.5 rounded">مدیر سیستم</code>، <code className="bg-gray-100 px-1 py-0.5 rounded">مدیر</code>، <code className="bg-gray-100 px-1 py-0.5 rounded">سرپرست</code> یا <code className="bg-gray-100 px-1 py-0.5 rounded">کاربر عادی</code></li>
                <li><strong className="text-gray-900">واحد</strong>: نام واحد سازمانی (اختیاری - در صورت عدم وجود، واحد جدید به طور خودکار ایجاد خواهد شد)</li>
                <li><strong className="text-gray-900">سهمیه (ساعت)</strong>: سهمیه سالانه به ساعت - مثلاً <code className="bg-gray-100 px-1 py-0.5 rounded">82</code> ساعت معادل ۱۰ روز و ۲ ساعت مرخصی (اختیاری)</li>
                <li><strong className="text-gray-900">وضعیت کاری</strong>: مقادیر فارسی مانند <code className="bg-gray-100 px-1 py-0.5 rounded">عادی</code> یا <code className="bg-gray-100 px-1 py-0.5 rounded">شیفتی</code></li>
                <li><strong className="text-gray-900">کلمه عبور</strong>: رمز عبور ورود (اختیاری - در صورت خالی بودن، کد پرسنلی به عنوان رمز قرار می‌گیرد)</li>
              </ul>
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-blue-800 text-xs">
                💡 در صورتی که کد پرسنلی از قبل در سیستم وجود داشته باشد، اطلاعات کاربری و سهمیه او بدون تغییر در مرخصی‌های قبلی، <strong>بروزرسانی (Overwrite)</strong> خواهد شد.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
            <h3 className="font-bold text-gray-800 text-base">واحدهای اداری فعال</h3>
            <div className="max-h-60 overflow-y-auto divide-y text-xs">
              {departments.length === 0 ? (
                <p className="text-gray-400 p-2 text-center">هیچ واحدی تعریف نشده است.</p>
              ) : (
                departments.map(d => (
                  <div key={d.id} className="py-2.5 flex justify-between items-center hover:bg-gray-50/50 px-1">
                    <span className="font-bold text-gray-700">{d.name}</span>
                    <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-lg text-[10px]">موجود در سیستم</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right main upload and preview block */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 py-10">
            <span className="text-4xl mb-3">📄</span>
            <p className="text-sm font-bold text-gray-700">فایل CSV خود را اینجا رها کنید یا انتخاب کنید</p>
            <p className="text-xs text-gray-400 mt-1">پشتیبانی از جداکننده‌های کاما (,) و نقطه‌ویرایش (;)</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-file-picker"
            />
            <label
              htmlFor="csv-file-picker"
              className="mt-4 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl cursor-pointer shadow-sm transition-all"
            >
              انتخاب فایل CSV
            </label>
          </div>

          {preview && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">پیش‌نمایش داده‌های پردازش شده</h3>
                  <p className="text-xs text-gray-500 mt-0.5">بررسی وضعیت خطاها، تداخل‌ها و صحت ردیف‌ها قبل از ثبت نهایی</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleImport}
                    disabled={preview.valid === 0 || uploading}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-xs font-bold px-5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    {uploading ? 'در حال ثبت...' : '✅ تایید و ثبت نهایی ردیف‌های معتبر'}
                  </button>
                  <button
                    onClick={() => setPreview(null)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl transition-all"
                  >
                    انصراف
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-center">
                  <p className="text-xs text-blue-700">کل ردیف‌ها</p>
                  <p className="text-xl font-bold text-blue-900 mt-1">{preview.total}</p>
                </div>
                <div className="bg-green-50 border border-green-100 p-3 rounded-2xl text-center">
                  <p className="text-xs text-green-700">معتبر و آماده ثبت</p>
                  <p className="text-xl font-bold text-green-900 mt-1">{preview.valid}</p>
                </div>
                <div className="bg-red-50 border border-red-100 p-3 rounded-2xl text-center">
                  <p className="text-xs text-red-700">ردیف‌های دارای خطا</p>
                  <p className="text-xl font-bold text-red-900 mt-1">{preview.invalid}</p>
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
                      <tr key={idx} className={`hover:bg-gray-50/50 ${row.errors.length > 0 && !row.isValid ? 'bg-red-50/20' : ''}`}>
                        <td className="p-3 text-gray-400 font-mono">{row.rowNum}</td>
                        <td className="p-3 font-bold font-mono">{row.id}</td>
                        <td className="p-3 text-gray-800">{row.full_name}</td>
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
                            <span className="text-green-600 font-bold flex items-center gap-1">🟢 معتبر (جدید)</span>
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
              <p className="text-xs text-gray-500 mt-0.5">آرشیو کامل فایل‌های CSV وارد شده به همراه تاریخ، تعداد رکوردها و کاربر ثبت‌کننده جهت نظارت امنیتی</p>
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
    </div>
  );
}
