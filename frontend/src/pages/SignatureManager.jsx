import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { toJalaliDateTime } from '../utils/dateUtils';
import SignaturePad from '../components/SignaturePad';

export default function SignatureManager() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdminOrManager = user.role === 'admin' || user.role === 'manager';

  // Navigation tabs: 'admin-overview', 'bulk-upload', 'logs'
  const [activeTab, setActiveTab] = useState('admin-overview');

  // --- State for Admin Personnel Signature Management ---
  const [personnelList, setPersonnelList] = useState([]);
  const [personnelLoading, setPersonnelLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'has_sig' | 'no_sig'
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedUserForAction, setSelectedUserForAction] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignModalTab, setAssignModalTab] = useState('scan'); // 'scan' | 'draw'
  const [assignUploading, setAssignUploading] = useState(false);
  const [previewModalImage, setPreviewModalImage] = useState(null);
  const adminSingleFileRef = useRef(null);

  // --- State for Bulk Upload ---
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkPreviews, setBulkPreviews] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);
  const [isDraggingBulk, setIsDraggingBulk] = useState(false);
  const bulkFileInputRef = useRef(null);

  // --- State for Logs ---
  const [signLogs, setSignLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Load Initial Data
  useEffect(() => {
    loadPersonnelList();
  }, []);

  const loadPersonnelList = async () => {
    try {
      setPersonnelLoading(true);
      const res = await api.get('/signature/admin/list');
      setPersonnelList(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error('خطا در دریافت لیست پرسنل و امضاها');
    } finally {
      setPersonnelLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const res = await api.get('/signature/log/leave/0');
      setSignLogs(res.data || []);
    } catch (err) {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  };

  // Helper to normalize digits
  const toEnglishDigits = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .trim();
  };

  // Extract unique departments for filtering
  const departments = useMemo(() => {
    const map = new Map();
    personnelList.forEach((u) => {
      if (u.department_id && u.department_name) {
        map.set(u.department_id, u.department_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [personnelList]);

  // Filtered personnel
  const filteredPersonnel = useMemo(() => {
    return personnelList.filter((item) => {
      // Status filter
      if (filterStatus === 'has_sig' && !item.has_signature) return false;
      if (filterStatus === 'no_sig' && item.has_signature) return false;

      // Department filter
      if (selectedDept !== 'all' && String(item.department_id) !== String(selectedDept)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = toEnglishDigits(searchQuery).toLowerCase();
        const rawQ = searchQuery.trim().toLowerCase();
        const matchCode = String(item.id).includes(q) || String(item.id).includes(rawQ);
        const matchName = item.full_name?.toLowerCase().includes(rawQ) || item.full_name?.toLowerCase().includes(q);
        const matchDept = item.department_name?.toLowerCase().includes(rawQ);
        if (!matchCode && !matchName && !matchDept) return false;
      }

      return true;
    });
  }, [personnelList, filterStatus, selectedDept, searchQuery]);

  // Summary counts
  const stats = useMemo(() => {
    const total = personnelList.length;
    const signed = personnelList.filter((p) => p.has_signature).length;
    const unsigned = total - signed;
    const percent = total > 0 ? Math.round((signed / total) * 100) : 0;
    return { total, signed, unsigned, percent };
  }, [personnelList]);

  // --- Handlers for Admin Action on Single User ---
  const handleOpenAssignModal = (targetUser) => {
    setSelectedUserForAction(targetUser);
    setAssignModalTab('scan');
    setShowAssignModal(true);
  };

  const handleAdminUploadSingleScan = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedUserForAction) return;
    setAssignUploading(true);
    try {
      const formData = new FormData();
      formData.append('signature', file);
      formData.append('user_id', selectedUserForAction.id);
      const res = await api.post('/signature/admin/upload-user-scan', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message || 'امضای کاربر با موفقیت ثبت شد');
      setShowAssignModal(false);
      setSelectedUserForAction(null);
      loadPersonnelList();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در آپلود امضای کاربر');
    } finally {
      setAssignUploading(false);
      if (adminSingleFileRef.current) adminSingleFileRef.current.value = '';
    }
  };

  const handleAdminSaveDrawnForUser = async (signatureData) => {
    if (!selectedUserForAction) return;
    try {
      await api.post('/signature/save', {
        signature_data: signatureData,
        signature_type: 'drawn',
        user_id: selectedUserForAction.id,
      });
      toast.success(`امضای رسم شده برای ${selectedUserForAction.full_name} ذخیره شد`);
      setShowAssignModal(false);
      setSelectedUserForAction(null);
      loadPersonnelList();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ذخیره امضا');
    }
  };

  const handleAdminDeleteUserSig = async (targetUser) => {
    if (!confirm(`آیا از حذف امضای ${targetUser.full_name} (کد: ${targetUser.id}) اطمینان دارید؟`)) return;
    try {
      const res = await api.delete(`/signature/admin/user/${targetUser.id}`);
      toast.success(res.data.message || 'امضای کاربر حذف شد');
      loadPersonnelList();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در حذف امضا');
    }
  };

  // --- Handlers for Bulk Upload ---
  const processBulkFileList = (files) => {
    if (!files || files.length === 0) return;
    setBulkResults(null);
    const existingPreviews = [...bulkPreviews];
    const newFiles = [...bulkFiles];

    // Build map of existing user IDs to quickly validate matched user
    const usersMap = new Map();
    personnelList.forEach((u) => usersMap.set(String(u.id), u));

    Array.from(files).forEach((f) => {
      // Skip if already in list
      if (newFiles.some((ef) => ef.name === f.name && ef.size === f.size)) return;

      const nameWithoutExt = f.name.replace(/\.[^.]+$/, '');
      const normalizedName = toEnglishDigits(nameWithoutExt);

      let detectedCode = null;
      const match = normalizedName.match(/(\d{4,10})/);
      if (match) {
        detectedCode = match[1];
      } else {
        const anyDigits = normalizedName.match(/^(\d+)/);
        if (anyDigits) detectedCode = anyDigits[1];
      }

      const matchedUser = detectedCode ? usersMap.get(detectedCode) : null;

      newFiles.push(f);
      existingPreviews.push({
        file: f,
        fileName: f.name,
        employeeCode: detectedCode || '',
        matchedUser: matchedUser || null,
        previewUrl: URL.createObjectURL(f),
      });
    });

    setBulkFiles(newFiles);
    setBulkPreviews(existingPreviews);
  };

  const handleBulkFileChange = (e) => {
    processBulkFileList(e.target.files);
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
  };

  const handleBulkDrop = (e) => {
    e.preventDefault();
    setIsDraggingBulk(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processBulkFileList(e.dataTransfer.files);
    }
  };

  const handleBulkRemoveItem = (index) => {
    const item = bulkPreviews[index];
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    setBulkPreviews((prev) => prev.filter((_, i) => i !== index));
    setBulkFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBulkCodeChange = (index, newCode) => {
    const cleanedCode = toEnglishDigits(newCode);
    const usersMap = new Map();
    personnelList.forEach((u) => usersMap.set(String(u.id), u));

    setBulkPreviews((prev) => {
      const clone = [...prev];
      const matched = cleanedCode ? usersMap.get(cleanedCode) : null;
      clone[index] = {
        ...clone[index],
        employeeCode: cleanedCode,
        matchedUser: matched || null,
      };
      return clone;
    });
  };

  const handleClearBulkAll = () => {
    bulkPreviews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setBulkPreviews([]);
    setBulkFiles([]);
    setBulkResults(null);
  };

  const handleExecuteBulkUpload = async () => {
    if (bulkPreviews.length === 0) return;

    // Check if any missing code
    const invalidCount = bulkPreviews.filter((p) => !p.employeeCode).length;
    if (invalidCount > 0) {
      if (!confirm(`${invalidCount} فایل هنوز کد پرسنلی معتبر ندارند و ارسال نخواهند شد یا خطا خواهند داد. آیا ادامه می‌دهید؟`)) {
        return;
      }
    }

    setBulkUploading(true);
    try {
      const formData = new FormData();
      const codeMapping = {};

      bulkPreviews.forEach((p) => {
        formData.append('signatures', p.file);
        if (p.employeeCode) {
          codeMapping[p.file.name] = p.employeeCode;
        }
      });

      formData.append('code_mapping', JSON.stringify(codeMapping));

      const res = await api.post('/signature/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setBulkResults(res.data);
      if (res.data.okCount > 0) {
        toast.success(`${res.data.okCount} امضا با موفقیت در سیستم ثبت گردید`);
      }
      if (res.data.failCount > 0) {
        toast.error(`${res.data.failCount} فایل با خطا مواجه شد`);
      }

      loadPersonnelList();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در آپلود گروهی');
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in p-2 md:p-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-primary-700 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl p-2 bg-white/20 rounded-2xl backdrop-blur-md">✍️</span>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">کنترل و مدیریت امضای دیجیتال پرسنل</h1>
                <p className="text-blue-100 text-sm mt-1">
                  سامانه متمرکز ثبت، ورود گروهی و مدیریت تصاویر امضای پرسنل سازمان جهت الصاق در اسناد و نامه‌ها
                </p>
              </div>
            </div>
          </div>

          {/* Quick stats badge */}
          <div className="flex items-center gap-3 bg-white/15 backdrop-blur-md p-3 rounded-2xl border border-white/20 self-start md:self-auto">
            <div className="text-center px-2">
              <span className="text-xs text-blue-200 block">کل پرسنل</span>
              <span className="text-lg font-bold">{stats.total}</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-2">
              <span className="text-xs text-emerald-300 block">دارای امضا</span>
              <span className="text-lg font-bold text-emerald-300">{stats.signed}</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center px-2">
              <span className="text-xs text-amber-200 block">فاقد امضا</span>
              <span className="text-lg font-bold text-amber-200">{stats.unsigned}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab('admin-overview')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
            activeTab === 'admin-overview'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25 scale-[1.02]'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span>👥</span>
          <span>مدیریت امضای پرسنل</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === 'admin-overview' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {stats.total}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('bulk-upload')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
            activeTab === 'bulk-upload'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25 scale-[1.02]'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span>📁</span>
          <span>ورود گروهی امضاها (Bulk Upload)</span>
          {bulkPreviews.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">
              {bulkPreviews.length} فایل
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('logs');
            loadLogs();
          }}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all duration-200 ${
            activeTab === 'logs'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/25 scale-[1.02]'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
          }`}
        >
          <span>📜</span>
          <span>لاگ و تاریخچه امضاها</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: ADMIN PERSONNEL SIGNATURE MANAGEMENT                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'admin-overview' && (
        <div className="space-y-6">
          {/* Progress Bar & Filter Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">پیشرفت ثبت امضای پرسنل سازمان</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {stats.signed} نفر از {stats.total} پرسنل فعال دارای امضای دیجیتال معتبر هستند ({stats.percent}%)
                </p>
              </div>
              <div className="w-full md:w-64">
                <div className="w-full bg-gray-100 h-3.5 rounded-full overflow-hidden p-0.5">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${stats.percent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative md:col-span-2">
                <input
                  type="text"
                  placeholder="جستجو با نام پرسنل، کد پرسنلی یا واحد..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                />
                <span className="absolute right-3.5 top-3 text-gray-400 text-sm">🔍</span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute left-3 top-3 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                >
                  <option value="all">همه پرسنل (بدون فیلتر وضعیت)</option>
                  <option value="has_sig">✅ فقط دارای امضا ({stats.signed})</option>
                  <option value="no_sig">⚠️ فقط فاقد امضا ({stats.unsigned})</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                >
                  <option value="all">همه دپارتمان‌ها و واحدها</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Personnel Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">
                لیست پرسنل ({filteredPersonnel.length} کاربر)
              </span>
              <button
                onClick={loadPersonnelList}
                disabled={personnelLoading}
                className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium"
              >
                <span>🔄</span>
                <span>بروزرسانی لیست</span>
              </button>
            </div>

            {personnelLoading ? (
              <div className="text-center py-16 text-gray-400">
                <div className="inline-block animate-spin text-3xl mb-2">⏳</div>
                <p className="text-sm">در حال بارگذاری لیست پرسنل و وضعیت امضاها...</p>
              </div>
            ) : filteredPersonnel.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-4xl mb-2">🔍</p>
                <p className="text-sm font-medium">هیچ پرسنلی با فیلترهای انتخابی یافت نشد</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-gray-50/80 text-gray-600 border-b border-gray-100 text-xs font-bold">
                    <tr>
                      <th className="py-3 px-4">کد پرسنلی</th>
                      <th className="py-3 px-4">نام و نام خانوادگی</th>
                      <th className="py-3 px-4">واحد / دپارتمان</th>
                      <th className="py-3 px-4">نقش</th>
                      <th className="py-3 px-4 text-center">وضعیت امضا</th>
                      <th className="py-3 px-4 text-center">پیش‌نمایش امضا</th>
                      <th className="py-3 px-4 text-center">عملیات مدیر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPersonnel.map((person) => {
                      const sigImage = person.scanned_signature || person.signature_data;
                      return (
                        <tr key={person.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-gray-800">
                            {person.id}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-800">
                            {person.full_name}
                          </td>
                          <td className="py-3 px-4 text-gray-500">
                            {person.department_name || '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg">
                              {person.role === 'admin'
                                ? 'مدیر سیستم'
                                : person.role === 'manager'
                                ? 'مدیر'
                                : person.role === 'supervisor'
                                ? 'سرپرست'
                                : 'کاربر عادی'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {person.has_signature ? (
                              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>ثبت شده</span>
                                <span className="text-[10px] text-gray-400">
                                  ({person.signature_type === 'scanned' ? 'اسکن' : 'ترسیم'})
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span>فاقد امضا</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {sigImage ? (
                              <div
                                onClick={() => setPreviewModalImage({ url: sigImage, title: person.full_name })}
                                className="inline-block cursor-pointer border border-gray-200 bg-white rounded-lg p-1 hover:shadow-md hover:border-primary-400 transition-all"
                                title="کلیک برای مشاهده بزرگ‌تر"
                              >
                                <img
                                  src={sigImage}
                                  alt=""
                                  className="h-9 w-24 object-contain"
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenAssignModal(person)}
                                className="p-1.5 text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg font-medium transition-colors flex items-center gap-1"
                                title="ثبت یا تغییر امضا"
                              >
                                <span>✍️</span>
                                <span>{person.has_signature ? 'تغییر' : 'ثبت امضا'}</span>
                              </button>

                              {person.has_signature && (
                                <button
                                  onClick={() => handleAdminDeleteUserSig(person)}
                                  className="p-1.5 text-xs bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                  title="حذف امضا"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: BULK SIGNATURE UPLOAD                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'bulk-upload' && (
        <div className="space-y-6">
          {/* Instructions Box */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-6">
            <div className="flex items-start gap-4">
              <span className="text-3xl">💡</span>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-blue-900">
                  راهنمای ورود گروهی تصاویر امضای پرسنل
                </h3>
                <ul className="text-xs text-blue-800 space-y-1.5 list-disc list-inside">
                  <li>
                    می‌توانید ده‌ها یا صدها فایل تصویر امضا (فرمت‌های <code className="bg-white/80 px-1 py-0.5 rounded font-mono">PNG</code>، <code className="bg-white/80 px-1 py-0.5 rounded font-mono">JPG</code>، <code className="bg-white/80 px-1 py-0.5 rounded font-mono">WEBP</code>) را یکجا انتخاب یا به داخل کادر بکشید.
                  </li>
                  <li>
                    سامانه به طور خودکار <strong>کد پرسنلی</strong> را از نام فایل استخراج کرده و به پرسنل مربوطه منتسب می‌کند.
                    (مثال: <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold">6040062.png</code> یا <code className="bg-white/80 px-1 py-0.5 rounded font-mono font-bold">1005_mohammadi.jpg</code>).
                  </li>
                  <li>
                    در جدول پیش‌نمایش زیر، وضعیت تطبیق هر فایل با پرسنل سامانه را مشاهده می‌کنید و حتی می‌توانید کد پرسنلی را دستی اصلاح یا تکمیل کنید.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingBulk(true);
            }}
            onDragLeave={() => setIsDraggingBulk(false)}
            onDrop={handleBulkDrop}
            className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all ${
              isDraggingBulk
                ? 'border-primary-500 bg-primary-50/50 scale-[1.01]'
                : 'border-gray-300 bg-white hover:border-primary-400'
            }`}
          >
            <input
              ref={bulkFileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleBulkFileChange}
              className="hidden"
              id="bulk-sig-input"
            />
            <label htmlFor="bulk-sig-input" className="cursor-pointer block space-y-3">
              <div className="text-5xl">📁</div>
              <div>
                <p className="text-base font-bold text-gray-800">
                  {bulkUploading ? 'در حال پردازش و آپلود امضاها...' : 'فایل‌های امضا را به اینجا بکشید یا کلیک کنید'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  پشتیبانی از انتخاب چند فایل هم‌زمان (حداکثر ۵ مگابایت برای هر تصویر)
                </p>
              </div>
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-primary-50 text-primary-700 font-bold text-xs rounded-xl hover:bg-primary-100 transition-colors"
              >
                <span>➕</span>
                <span>انتخاب فایل‌ها از سیستم</span>
              </button>
            </label>
          </div>

          {/* Previews & Matching List */}
          {bulkPreviews.length > 0 && (
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-800 text-sm">
                    فایل‌های آماده آپلود ({bulkPreviews.length} مورد)
                  </span>
                  {/* Status pills */}
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {bulkPreviews.filter((p) => p.matchedUser).length} تطابق موفق
                  </span>
                  {bulkPreviews.some((p) => !p.matchedUser) && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {bulkPreviews.filter((p) => !p.matchedUser).length} نیاز به بررسی
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearBulkAll}
                    disabled={bulkUploading}
                    className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                  >
                    🗑️ پاک کردن همه
                  </button>
                </div>
              </div>

              {/* Items Grid / Table */}
              <div className="border rounded-2xl divide-y max-h-96 overflow-y-auto">
                {bulkPreviews.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-4 p-3.5 transition-colors ${
                      item.matchedUser ? 'bg-white' : 'bg-amber-50/40'
                    }`}
                  >
                    {/* Thumbnail */}
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="w-16 h-12 object-contain border bg-gray-50 rounded-xl p-1 shrink-0"
                    />

                    {/* File name & code input */}
                    <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                      <div className="truncate">
                        <p className="text-xs font-mono text-gray-700 truncate" title={item.fileName}>
                          {item.fileName}
                        </p>
                        <p className="text-[11px] text-gray-400">
                          {(item.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>

                      {/* Code input */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 shrink-0">کد پرسنلی:</label>
                        <input
                          type="text"
                          value={item.employeeCode}
                          onChange={(e) => handleBulkCodeChange(idx, e.target.value)}
                          placeholder="مثلاً 6040062"
                          className="w-28 font-mono text-xs px-2 py-1 border rounded-lg focus:ring-1 focus:ring-primary-500 bg-white"
                        />
                      </div>

                      {/* Matching info */}
                      <div>
                        {item.matchedUser ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                            <span>✅</span>
                            <span>{item.matchedUser.full_name}</span>
                            <span className="text-[10px] text-gray-400">
                              ({item.matchedUser.department_name || 'بدون واحد'})
                            </span>
                          </div>
                        ) : item.employeeCode ? (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <span>⚠️</span>
                            <span>کاربری با این کد یافت نشد</span>
                          </span>
                        ) : (
                          <span className="text-xs text-red-500 flex items-center gap-1">
                            <span>❌</span>
                            <span>کد پرسنلی مشخص نشده</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => handleBulkRemoveItem(idx)}
                      disabled={bulkUploading}
                      className="text-gray-400 hover:text-red-500 p-1 rounded-lg"
                      title="حذف این مورد"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Upload trigger */}
              <div className="pt-2">
                <button
                  onClick={handleExecuteBulkUpload}
                  disabled={bulkUploading || bulkPreviews.length === 0}
                  className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {bulkUploading ? (
                    <>
                      <span className="animate-spin text-lg">⏳</span>
                      <span>در حال آپلود و ذخیره گروهی امضاها...</span>
                    </>
                  ) : (
                    <>
                      <span>🚀</span>
                      <span>تایید و ثبت نهایی {bulkPreviews.length} امضا در سیستم</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Results Summary Box */}
          {bulkResults && (
            <div
              className={`border-2 rounded-3xl p-6 shadow-sm space-y-4 ${
                bulkResults.failCount > 0 ? 'bg-amber-50/60 border-amber-300' : 'bg-emerald-50/60 border-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{bulkResults.failCount === 0 ? '🎉' : '⚠️'}</span>
                  <h4 className="font-bold text-gray-800 text-sm">نتیجه عملیات آپلود گروهی امضاها</h4>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-xl">
                    ✅ {bulkResults.okCount} موفق
                  </span>
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-xl">
                    ❌ {bulkResults.failCount} ناموفق
                  </span>
                </div>
              </div>

              <div className="divide-y divide-gray-200/60 max-h-60 overflow-y-auto bg-white/70 rounded-2xl p-2 border border-gray-200">
                {bulkResults.results.map((r, i) => (
                  <div key={i} className="py-2 px-3 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{r.status === 'ok' ? '✅' : '❌'}</span>
                      <span className="font-mono text-gray-700 truncate">{r.file}</span>
                      {r.status === 'ok' && (
                        <span className="text-emerald-700 font-medium">
                          ← {r.userName} ({r.employeeCode})
                        </span>
                      )}
                    </div>
                    {r.status === 'error' && (
                      <span className="text-red-600 font-medium shrink-0">{r.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: LOGS & HISTORY                                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
              <span>📜</span>
              <span>تاریخچه امضای اسناد و درخواست‌ها</span>
            </h3>
            <button
              onClick={loadLogs}
              disabled={logsLoading}
              className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1 font-medium"
            >
              <span>🔄</span>
              <span>بروزرسانی لاگ‌ها</span>
            </button>
          </div>

          {logsLoading ? (
            <div className="text-center py-12 text-gray-400">در حال بارگذاری لاگ‌ها...</div>
          ) : signLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-3xl mb-1">📝</p>
              <p className="text-sm font-medium">هیچ لاگ امضایی تا کنون ثبت نشده است</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {signLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50/60 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-primary-50 text-primary-700 rounded-xl text-xs font-bold">
                      {log.module_name || 'سند'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        امضای رکورد شماره #{log.record_id} توسط {log.full_name || 'کاربر'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {log.action === 'signed' ? 'امضای تایید شده' : log.action}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    {toJalaliDateTime(log.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: ASSIGN / CHANGE SIGNATURE FOR A USER (ADMIN ONLY)      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showAssignModal && selectedUserForAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800 text-base">
                  ثبت / تغییر امضای پرسنل
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedUserForAction.full_name} (کد پرسنلی: {selectedUserForAction.id})
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUserForAction(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex gap-2 border-b border-gray-100 pb-2">
              <button
                onClick={() => setAssignModalTab('scan')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  assignModalTab === 'scan'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                📷 آپلود فایل اسکن شده
              </button>
              <button
                onClick={() => setAssignModalTab('draw')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  assignModalTab === 'draw'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ✏️ ترسیم با ماوس / قلم
              </button>
            </div>

            {assignModalTab === 'scan' && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-primary-400 transition-colors">
                  <input
                    ref={adminSingleFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAdminUploadSingleScan}
                    className="hidden"
                    id="admin-single-upload"
                  />
                  <label htmlFor="admin-single-upload" className="cursor-pointer block">
                    <div className="text-4xl mb-2">📷</div>
                    <p className="text-xs text-gray-700 font-bold">
                      {assignUploading ? 'در حال بارگذاری و ذخیره...' : 'انتخاب تصویر امضا برای این پرسنل'}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">PNG یا JPG (حداکثر ۵ مگابایت)</p>
                  </label>
                </div>
              </div>
            )}

            {assignModalTab === 'draw' && (
              <div className="space-y-3">
                <SignaturePad
                  onSave={handleAdminSaveDrawnForUser}
                  existingSignature={selectedUserForAction.signature_data}
                />
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedUserForAction(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-medium hover:bg-gray-200"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: PREVIEW SIGNATURE IMAGE ENLARGED                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {previewModalImage && (
        <div
          onClick={() => setPreviewModalImage(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-center space-y-4 animate-scale-up"
          >
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-bold text-gray-800 text-sm">
                امضای دیجیتال: {previewModalImage.title}
              </h4>
              <button
                onClick={() => setPreviewModalImage(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-50 border rounded-2xl p-6 flex items-center justify-center min-h-48">
              <img
                src={previewModalImage.url}
                alt=""
                className="max-h-56 max-w-full object-contain"
              />
            </div>

            <button
              onClick={() => setPreviewModalImage(null)}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-200"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
