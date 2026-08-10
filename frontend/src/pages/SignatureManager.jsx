import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalali, toJalaliDateTime } from '../utils/dateUtils';
import SignaturePad from '../components/SignaturePad';

export default function SignatureManager() {
  const [signature, setSignature] = useState(null);
  const [signLogs, setSignLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('draw');
  const fileInputRef = useRef(null);
  const bulkFileRef = useRef(null);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Bulk import state
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkPreviews, setBulkPreviews] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  useEffect(() => {
    loadSignature();
    loadLogs();
  }, []);

  const loadSignature = async () => {
    try {
      const res = await api.get('/signature/my');
      setSignature(res.data);
    } catch (err) { toast.error('خطا در بارگذاری امضا'); }
    setLoading(false);
  };

  const loadLogs = async () => {
    try {
      const res = await api.get('/signature/log/leave/0');
      setSignLogs(res.data || []);
    } catch (err) { toast.error('خطا در بارگذاری لاگ امضا'); }
  };

  const handleSave = async (signatureData) => {
    try {
      await api.post('/signature/save', { signature_data: signatureData, signature_type: 'drawn' });
      toast.success('امضا ذخیره شد');
      loadSignature();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ذخیره امضا');
    }
  };

  const handleUploadScan = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('signature', file);
      formData.append('employee_code', user.employee_code || user.id);
      await api.post('/signature/upload-scan', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('امضای اسکن شده ذخیره شد');
      loadSignature();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در آپلود');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!signature || !confirm('آیا مطمئن هستید؟')) return;
    try {
      await api.delete(`/signature/${signature.id}`);
      toast.success('امضا حذف شد');
      setSignature(null);
    } catch (err) {
      toast.error('خطا در حذف');
    }
  };

  // ─── Bulk Import handlers ───
  const handleBulkSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setBulkFiles(files);
    setBulkResults(null);

    const previews = files.map(f => {
      const name = f.name.replace(/\.[^.]+$/, '');
      const codeMatch = name.match(/^(\d+)/);
      return {
        file: f,
        fileName: f.name,
        employeeCode: codeMatch ? codeMatch[1] : null,
        preview: URL.createObjectURL(f),
      };
    });
    setBulkPreviews(previews);
  };

  const handleBulkRemove = (idx) => {
    URL.revokeObjectURL(bulkPreviews[idx]?.preview);
    setBulkFiles(prev => prev.filter((_, i) => i !== idx));
    setBulkPreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) return;
    setBulkUploading(true);
    try {
      const formData = new FormData();
      for (const f of bulkFiles) {
        formData.append('signatures', f);
      }
      const res = await api.post('/signature/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBulkResults(res.data);
      if (res.data.okCount > 0) toast.success(`${res.data.okCount} امضا با موفقیت ذخیره شد`);
      if (res.data.failCount > 0) toast.error(`${res.data.failCount} فایل خطا داشت`);
      setBulkFiles([]);
      setBulkPreviews([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در آپلود گروهی');
    } finally {
      setBulkUploading(false);
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-400">در حال بارگذاری...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-800">✍️ امضای دیجیتال</h1>

      {/* Current signature */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">امضای فعلی</h3>
        {signature ? (
          <div className="space-y-4">
            <div className="border rounded-xl p-4 bg-gray-50">
              {signature.scanned_signature ? (
                <img src={signature.scanned_signature} alt="امضای اسکن شده" className="max-w-xs mx-auto" />
              ) : signature.signature_data ? (
                <img src={signature.signature_data} alt="امضای شما" className="max-w-xs mx-auto" />
              ) : null}
              <div className="flex items-center justify-center gap-4 mt-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${signature.signature_type === 'scanned' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {signature.signature_type === 'scanned' ? 'اسکن شده' : 'کشیده شده'}
                </span>
                {signature.employee_code && (
                  <span className="text-xs text-gray-400">کد پرسنلی: {signature.employee_code}</span>
                )}
              </div>
              <p className="text-xs text-gray-400 text-center mt-2">
                تاریخ ایجاد: {toJalali(signature.created_at)}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm hover:bg-red-200">
                حذف امضا
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-4">شما هنوز امضای دیجیتال ثبت نکرده‌اید</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex gap-2 mb-4 border-b pb-2">
          <button onClick={() => setTab('draw')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'draw' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
            ✏️ کشیدن امضا
          </button>
          <button onClick={() => setTab('scan')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'scan' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
            📷 آپلود اسکن امضا
          </button>
          {user.role === 'admin' && (
            <button onClick={() => setTab('bulk')} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'bulk' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              📁 آپلود گروهی
            </button>
          )}
        </div>

        {tab === 'draw' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">با ماوس یا انگشت خود امضا کنید</p>
            <SignaturePad onSave={handleSave} existingSignature={signature?.signature_data} />
          </div>
        )}

        {tab === 'scan' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">فایل تصویر امضای اسکن شده خود را آپلود کنید (JPEG, PNG)</p>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-400 transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUploadScan}
                className="hidden"
                id="sig-upload"
              />
              <label htmlFor="sig-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">📷</div>
                <p className="text-sm text-gray-600 font-medium">
                  {uploading ? 'در حال آپلود...' : 'کلیک کنید یا فایل را بکشید'}
                </p>
                <p className="text-xs text-gray-400 mt-1">حداکثر ۵ مگابایت</p>
              </label>
            </div>
            {user.employee_code && (
              <p className="text-xs text-gray-400 text-center">کد پرسنلی: {user.employee_code}</p>
            )}
          </div>
        )}

        {tab === 'bulk' && user.role === 'admin' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 font-medium">آپلود گروهی امضا</p>
              <p className="text-xs text-blue-600 mt-1">
                نام فایل‌ها باید با کد پرسنلی شروع شود. مثال: <code className="bg-blue-100 px-1 rounded">6040062.png</code> یا <code className="bg-blue-100 px-1 rounded">1000_admin.jpg</code>
              </p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary-400 transition-colors">
              <input
                ref={bulkFileRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleBulkSelect}
                className="hidden"
                id="bulk-upload"
              />
              <label htmlFor="bulk-upload" className="cursor-pointer">
                <div className="text-4xl mb-2">📁</div>
                <p className="text-sm text-gray-600 font-medium">
                  {bulkUploading ? 'در حال آپلود...' : 'انتخاب فایل‌ها (چند فایل)'}
                </p>
                <p className="text-xs text-gray-400 mt-1">حداکثر ۵ مگابایت برای هر فایل</p>
              </label>
            </div>

            {bulkPreviews.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{bulkPreviews.length} فایل انتخاب شده</span>
                  <button
                    onClick={() => { bulkPreviews.forEach(p => URL.revokeObjectURL(p.preview)); setBulkFiles([]); setBulkPreviews([]); setBulkResults(null); }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    پاک کردن همه
                  </button>
                </div>
                <div className="border rounded-xl divide-y max-h-80 overflow-y-auto">
                  {bulkPreviews.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <img src={item.preview} alt="" className="w-16 h-10 object-contain border rounded" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{item.fileName}</p>
                        {item.employeeCode ? (
                          <p className="text-xs text-green-600">کد پرسنلی: {item.employeeCode}</p>
                        ) : (
                          <p className="text-xs text-red-500">کد پرسنلی یافت نشد!</p>
                        )}
                      </div>
                      <button onClick={() => handleBulkRemove(i)} className="text-gray-400 hover:text-red-500 text-lg">✕</button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleBulkUpload}
                  disabled={bulkUploading}
                  className="mt-3 w-full bg-primary-500 text-white py-2.5 rounded-xl font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
                >
                  {bulkUploading ? 'در حال آپلود...' : `آپلود ${bulkPreviews.length} امضا`}
                </button>
              </div>
            )}

            {bulkResults && (
              <div className={`border rounded-xl p-4 ${bulkResults.failCount > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
                <p className="text-sm font-medium mb-2">
                  ✅ {bulkResults.okCount} موفق | ❌ {bulkResults.failCount} ناموفق
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {bulkResults.results.map((r, i) => (
                    <div key={i} className={`text-xs flex items-center gap-2 ${r.status === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
                      <span>{r.status === 'ok' ? '✓' : '✕'}</span>
                      <span className="truncate">{r.file}</span>
                      {r.status === 'ok' && <span className="text-green-500">→ {r.userName} ({r.employeeCode})</span>}
                      {r.status === 'error' && <span className="text-red-500">{r.message}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-4">📝 تاریخچه امضاها</h3>
        {signLogs.length === 0 ? (
          <p className="text-sm text-gray-400">تاریخچه‌ای وجود ندارد</p>
        ) : (
          <div className="space-y-2">
            {signLogs.map((log, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                <span>{log.module_name} - رکورد #{log.record_id}</span>
                <span className="text-gray-400">{toJalaliDateTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
