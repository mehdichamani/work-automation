import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { printJobApplication } from '../utils/printUtils';
import { toJalali, toJalaliDateTime } from '../utils/dateUtils';
import PermMatrixMode from '../components/PermMatrixMode';

const roleLabels = { admin: 'مدیر سیستم', manager: 'مدیر', supervisor: 'سرپرست', user: 'کاربر', applicant: 'متقاضی استخدام' };
const roleColors = { admin: 'bg-red-100 text-red-700', manager: 'bg-blue-100 text-blue-700', supervisor: 'bg-green-100 text-green-700', user: 'bg-gray-100 text-gray-700', applicant: 'bg-orange-100 text-orange-700' };

function SearchableSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()));
  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(!open)} className="w-full px-3 py-2 border rounded-xl text-sm cursor-pointer bg-white hover:border-primary-400 transition-colors flex items-center justify-between">
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>{selected ? selected.label : placeholder}</span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-xl shadow-xl max-h-60 overflow-auto">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجو..." className="w-full px-3 py-2 border-b text-sm outline-none" autoFocus />
          {filtered.length === 0 ? (
            <p className="p-3 text-xs text-gray-400 text-center">نتیجه‌ای یافت نشد</p>
          ) : (
            filtered.map(o => (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); setQuery(''); }} className="px-3 py-2 text-sm hover:bg-primary-50 cursor-pointer flex items-center justify-between">
                <span>{o.label}</span>
                {o.extra && <span className="text-[10px] text-gray-400">{o.extra}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPanel() {
  const { user, refreshPermissions, hasPermission } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', full_name: '', role: 'user', department_id: '' });
  const [deptForm, setDeptForm] = useState({ name: '', parent_id: '' });
  const [expandedDept, setExpandedDept] = useState(null);
  const [addUserToDept, setAddUserToDept] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [backups, setBackups] = useState([]);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [modules, setModules] = useState([]);
  const [allPerms, setAllPerms] = useState([]);
  const [permLoading, setPermLoading] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [permSearch, setPermSearch] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySourceDeptId, setCopySourceDeptId] = useState('');
  const [userPerms, setUserPerms] = useState([]);
  const [selectedPermUserId, setSelectedPermUserId] = useState('');
  const [userPermForm, setUserPermForm] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', body: '', target_audience: 'all', priority: 'normal' });
  const [jobApplications, setJobApplications] = useState([]);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [cameraConfig, setCameraConfig] = useState({ ip: '172.20.2.26', port: 80, username: 'admin', password: 'admin123', channel: 1, rtsp_port: 554 });
  const [cameraTestResult, setCameraTestResult] = useState(null);
  const [viewPhoto, setViewPhoto] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [checkedUserIds, setCheckedUserIds] = useState(new Set());
  const [pendingSaveCount, setPendingSaveCount] = useState(0);
  const [matrix, setMatrix] = useState({ departments: [], deptUsers: {}, deptPermMap: {}, userPermMap: {}, modules: [] });

  useEffect(() => {
    const handleLoad = () => {
      loadData();
      if (tab === 'backup') loadBackups();
      if (tab === 'permissions') loadPermissions();
      if (tab === 'user-permissions') loadUserPermissions();
      if (tab === 'perm-matrix') loadMatrix();
      if (tab === 'toast-central') loadAnnouncements();
      if (tab === 'job-applications') loadJobApplications();
      if (tab === 'camera-settings') loadCameraConfig();
    };

    handleLoad();

    window.addEventListener('ws-update', handleLoad);
    return () => window.removeEventListener('ws-update', handleLoad);
  }, [tab]);

  const loadBackups = async () => {
    try {
      const res = await api.get('/backup/list');
      setBackups(res.data);
    } catch (err) {
      toast.error('خطا در بارگذاری بکاپ‌ها');
    }
  };

  const createBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await api.post('/backup/create');
      toast.success(`بکاپ ایجاد شد: ${res.data.filename}`);
      loadBackups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ایجاد بکاپ');
    } finally {
      setCreatingBackup(false);
    }
  };

  const downloadBackup = async (filename) => {
    try {
      const res = await api.get(`/backup/download/${encodeURIComponent(filename)}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('خطا در دانلود فایل');
    }
  };

  const restoreBackup = async (filename) => {
    if (!confirm(`آیا از بازیابی بکاپ "${filename}" مطمئن هستید؟\n\nتمام اطلاعات فعلی با اطلاعات بکاپ جایگزین خواهد شد.`)) return;
    try {
      await api.post(`/backup/restore/${encodeURIComponent(filename)}`);
      toast.success('بکاپ با موفقیت بازیابی شد - صفحه رفرش می‌شود');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در بازیابی');
    }
  };

  const deleteBackup = async (filename) => {
    if (!confirm(`آیا از حذف بکاپ "${filename}" مطمئن هستید؟`)) return;
    try {
      await api.delete(`/backup/${encodeURIComponent(filename)}`);
      toast.success('بکاپ حذف شد');
      loadBackups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در حذف');
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const loadPermissions = async () => {
    setPermLoading(true);
    try {
      const [modsRes, permsRes, deptsRes, usersRes] = await Promise.all([
        api.get('/permissions/modules'),
        api.get('/permissions'),
        api.get('/admin/departments'),
        api.get('/admin/users'),
      ]);
      setModules(modsRes.data);
      setAllPerms(permsRes.data);
      setDepartments(deptsRes.data);
      setUsers(usersRes.data.data || usersRes.data);
      if (deptsRes.data.length > 0) {
        setSelectedDeptId(deptsRes.data[0].id);
      }
    } catch (err) {
      toast.error('خطا در بارگذاری دسترسی‌ها');
    } finally {
      setPermLoading(false);
    }
  };

  const togglePermission = (moduleKey, deptId) => {
    const existing = allPerms.find(p => p.module_key === moduleKey && p.department_id === deptId);
    if (existing) {
      setAllPerms(allPerms.map(p =>
        p.module_key === moduleKey && p.department_id === deptId
          ? { ...p, is_enabled: p.is_enabled ? 0 : 1 }
          : p
      ));
    } else {
      setAllPerms([...allPerms, { module_key: moduleKey, department_id: deptId, is_enabled: 1 }]);
    }
  };

  const savePermissions = async () => {
    try {
      await api.put('/permissions', { permissions: allPerms.filter(p => p.is_enabled) });
      await refreshPermissions();
      toast.success('دسترسی‌ها ذخیره شد');
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ذخیره');
    }
  };

  const handleCopyPermissions = (sourceDeptId) => {
    if (!sourceDeptId || !selectedDeptId) return;
    const sourceIdNum = Number(sourceDeptId);
    const sourcePerms = allPerms.filter(p => p.department_id === sourceIdNum && p.is_enabled);
    const otherPerms = allPerms.filter(p => p.department_id !== selectedDeptId);
    const newPerms = sourcePerms.map(p => ({
      module_key: p.module_key,
      department_id: selectedDeptId,
      is_enabled: 1
    }));
    setAllPerms([...otherPerms, ...newPerms]);
    toast.success('دسترسی‌ها کپی شدند. برای ثبت نهایی روی ذخیره کلیک کنید.');
    setShowCopyModal(false);
  };

  const hasPerm = (moduleKey, deptId) => {
    const p = allPerms.find(x => x.module_key === moduleKey && x.department_id === deptId);
    return p ? !!p.is_enabled : false;
  };

  const loadUserPermissions = async () => {
    try {
      const res = await api.get('/permissions/user-permissions');
      setUserPerms(res.data);
    } catch (err) {}
  };

  const loadMatrix = async () => {
    try {
      const res = await api.get('/permissions/matrix');
      setMatrix(res.data);
    } catch (err) {
      toast.error('خطا در بارگذاری ماتریکس دسترسی‌ها');
    }
  };

  const loadAnnouncements = async () => {
    try {
      const res = await api.get('/announcements');
      setAnnouncements(res.data);
    } catch (err) {
      toast.error('خطا در بارگذاری اطلاعیه‌ها');
    }
  };

  const addAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: announcementForm.title,
        body: announcementForm.body || '',
        target_audience: announcementForm.target_audience,
        priority: announcementForm.priority,
        image: announcementForm.image || null,
      };

      if (editingAnnouncement) {
        await api.put(`/announcements/${editingAnnouncement.id}`, payload);
        toast.success('اطلاعیه ویرایش شد');
      } else {
        await api.post('/announcements', payload);
        toast.success('اطلاعیه ایجاد شد');
      }
      setShowAnnouncementForm(false);
      setEditingAnnouncement(null);
      setAnnouncementForm({ title: '', body: '', target_audience: 'all', priority: 'normal', image: null });
      loadAnnouncements();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const editAnnouncement = (a) => {
    setEditingAnnouncement(a);
    setAnnouncementForm({ title: a.title, body: a.body || '', target_audience: a.target_audience, priority: a.priority, image: null });
    setShowAnnouncementForm(true);
  };

  const handleAnnouncementImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حداکثر حجم تصویر 5 مگابایت است');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAnnouncementForm(prev => ({ ...prev, image: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('آیا از حذف اطلاعیه مطمئن هستید؟')) return;
    try {
      await api.delete(`/announcements/${id}`);
      toast.success('اطلاعیه حذف شد');
      loadAnnouncements();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const toggleAnnouncementActive = async (id, currentStatus) => {
    try {
      await api.put(`/announcements/${id}`, { is_active: currentStatus ? 0 : 1 });
      toast.success(currentStatus ? 'اطلاعیه غیرفعال شد' : 'اطلاعیه فعال شد');
      loadAnnouncements();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const loadJobApplications = async () => {
    try {
      const res = await api.get('/job-applications');
      setJobApplications(res.data);
    } catch (err) {
      toast.error('خطا در بارگذاری پرسشنامه‌ها');
    }
  };

  const reviewApplication = async (id, status) => {
    try {
      await api.put(`/job-applications/${id}/review`, { status, review_comment: reviewComment });
      toast.success('وضعیت بروزرسانی شد');
      setSelectedApplication(null);
      setReviewComment('');
      loadJobApplications();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const viewApplication = async (id) => {
    try {
      const res = await api.get(`/job-applications/${id}`);
      setSelectedApplication(res.data);
    } catch (err) {
      toast.error('خطا در بارگذاری جزئیات');
    }
  };

  const deleteJobApplication = async (id) => {
    if (!confirm('آیا از حذف پرسشنامه مطمئن هستید؟')) return;
    try {
      await api.delete(`/job-applications/${id}`);
      toast.success('پرسشنامه حذف شد');
      loadJobApplications();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const loadCameraConfig = async () => {
    try {
      const res = await api.get('/camera/config');
      setCameraConfig(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'خطای ناشناخته';
      toast.error('خطا در بارگذاری تنظیمات: ' + msg);
    }
  };

  const saveCameraConfig = async () => {
    try {
      const res = await api.put('/camera/config', cameraConfig);
      toast.success(res.data?.message || 'تنظیمات دوربین ذخیره شد');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'خطای ناشناخته';
      toast.error('خطا در ذخیره: ' + msg);
    }
  };

  const testCamera = async () => {
    try {
      const res = await api.get('/camera/test');
      setCameraTestResult(res.data);
      if (res.data.connected) {
        toast.success(`دوربین متصل: ${res.data.model}`);
      } else {
        toast.error(`اتصال ناموفق: ${res.data.error}`);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'خطای ناشناخته';
      toast.error('خطا در تست: ' + msg);
      setCameraTestResult({ connected: false, error: msg });
    }
  };

  const loadUserPermForm = async (userId) => {
    setSelectedPermUserId(userId);
    if (!userId) { setUserPermForm([]); return; }
    try {
      const [userPermsRes, modsRes] = await Promise.all([
        api.get('/permissions/user-permissions'),
        api.get('/permissions/modules'),
      ]);
      const existingUser = userPermsRes.data.find(u => u.user_id == userId);
      const userExisting = existingUser ? existingUser.permissions : [];
      const form = modsRes.data.map(m => {
        const existing = userExisting.find(p => p.module_key === m.key);
        return { module_key: m.key, label: m.label, group: m.group, is_enabled: existing ? existing.is_enabled : 0 };
      });
      setUserPermForm(form);
    } catch (err) {
      toast.error('خطا در بارگذاری دسترسی‌های کاربر');
    }
  };

  const toggleUserPerm = (moduleKey) => {
    setUserPermForm(userPermForm.map(p =>
      p.module_key === moduleKey ? { ...p, is_enabled: p.is_enabled ? 0 : 1 } : p
    ));
  };

  const saveUserPermissions = async () => {
    if (!selectedPermUserId) { toast.error('یک کاربر انتخاب کنید'); return; }
    try {
      await api.put('/permissions/user-permissions', {
        user_id: selectedPermUserId,
        permissions: userPermForm.filter(p => p.is_enabled)
      });
      await loadUserPermissions();
      toast.success('دسترسی‌های کاربر ذخیره شد');
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ذخیره');
    }
  };

  const loadData = async () => {
    try {
      const [usersRes, deptRes, statsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/departments'),
        api.get('/admin/stats')
      ]);
      setUsers(usersRes.data.data || usersRes.data);
      setDepartments(deptRes.data);
      setStats(statsRes.data);
    } catch (err) {
      toast.error('خطا در بارگذاری');
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.put(`/admin/users/${editingUser.id}`, userForm);
        toast.success('کاربر ویرایش شد');
      } else {
        await api.post('/admin/users', userForm);
        toast.success('کاربر ایجاد شد');
      }
      setShowUserForm(false);
      setEditingUser(null);
      setUserForm({ username: '', password: '', full_name: '', role: 'user', department_id: '' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const editUser = (u) => {
    setEditingUser(u);
    setUserForm({ username: u.username, password: '', full_name: u.full_name, role: u.role, department_id: u.department_id || '' });
    setShowUserForm(true);
  };

  const deleteUser = async (id, name) => {
    if (!confirm(`آیا از حذف "${name}" مطمئن هستید؟`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success('کاربر حذف شد');
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const addDept = async (e) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await api.put(`/admin/departments/${editingDept.id}`, deptForm);
        toast.success('واحد ویرایش شد');
      } else {
        await api.post('/admin/departments', deptForm);
        toast.success('واحد ایجاد شد');
      }
      setShowDeptForm(false);
      setEditingDept(null);
      setDeptForm({ name: '', parent_id: '' });
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const editDept = (d) => {
    setEditingDept(d);
    setDeptForm({ name: d.name, parent_id: d.parent_id || '' });
    setShowDeptForm(true);
  };

  const deleteDept = async (id, name) => {
    if (!confirm(`آیا از حذف واحد "${name}" مطمئن هستید؟`)) return;
    try {
      await api.delete(`/admin/departments/${id}`);
      toast.success('واحد حذف شد');
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const addMemberToDept = async (deptId) => {
    if (!selectedUserId) { toast.error('یک کاربر انتخاب کنید'); return; }
    try {
      await api.put(`/admin/departments/${deptId}/add-member`, { user_id: selectedUserId });
      toast.success('کاربر اضافه شد');
      setSelectedUserId('');
      setAddUserToDept(null);
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const removeMemberFromDept = async (deptId, userId, name) => {
    if (!confirm(`"${name}" از واحد خارج شود؟`)) return;
    try {
      await api.put(`/admin/departments/${deptId}/remove-member`, { user_id: userId });
      toast.success('کاربر خارج شد');
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const promoteSupervisor = async (deptId, userId) => {
    try {
      await api.put(`/admin/departments/${deptId}/promote-supervisor`, { user_id: userId });
      toast.success('ارتقا به سرپرست');
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const demoteSupervisor = async (deptId, userId) => {
    if (!confirm('سمت سرپرستی حذف شود؟')) return;
    try {
      await api.put(`/admin/departments/${deptId}/demote-supervisor`, { user_id: userId });
      toast.success('سمت سرپرستی حذف شد');
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'خطا'); }
  };

  const openNewUserForDept = (deptId) => {
    setEditingUser(null);
    setUserForm({ username: '', password: '', full_name: '', role: 'user', department_id: deptId });
    setShowUserForm(true);
  };

  const tabs = [
    { id: 'users', label: 'مدیریت کاربران' },
    { id: 'departments', label: 'واحدها و چارت سازمانی' },
    { id: 'stats', label: 'آمار و گزارشات' },
    { id: 'backup', label: 'بکاپ و بازیابی' },
    { id: 'permissions', label: 'مدیریت دسترسی کاربران' },
    { id: 'perm-matrix', label: 'مدیریت دسترسی‌ها (ماتریکس)' },
    { id: 'toast-central', label: 'سانترال اطلاعیه' },
    { id: 'job-applications', label: 'پرسشنامه‌های استخدامی', permission: 'job_application_review' },
    { id: 'camera-settings', label: 'تنظیمات دوربین' },
  ].filter(t => !t.permission || hasPermission(t.permission));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">پنل مدیریت سیستم</h2>
        <button onClick={async () => {
          if (!confirm('آیا از ری‌استارت سرور مطمئن هستید؟')) return;
          try {
            toast.loading('در حال ری‌استارت سرور...', { id: 'restart' });
            await api.post('/admin/server-restart');
            toast.success('سرور ری‌استارت شد. در حال بازیابی...', { id: 'restart' });
            setTimeout(() => { window.location.reload(); }, 3000);
          } catch (err) {
            toast.error('خطا در ری‌استارت', { id: 'restart' });
          }
        }} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
          🔄 ری‌استارت سرور
        </button>
      </div>

      {showUserForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg animate-fade-in">
            <h3 className="text-lg font-bold mb-6">{editingUser ? 'ویرایش کاربر' : 'کاربر جدید'}</h3>
            <form onSubmit={addUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">کد پرسنلی</label>
                  <input type="number" min="10000" max="2147483647" placeholder="مثال: 10001" value={userForm.username} onChange={(e) => setUserForm({...userForm, username: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-center" required disabled={!!editingUser} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{editingUser ? 'رمز جدید' : 'رمز عبور'}</label>
                  <input type="password" placeholder="پیش‌فرض: کد پرسنلی" value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} className="w-full px-4 py-3 border rounded-xl text-center" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نام کامل</label>
                <input type="text" value={userForm.full_name} onChange={(e) => setUserForm({...userForm, full_name: e.target.value})} className="w-full px-4 py-3 border rounded-xl" required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">سمت</label>
                  <select value={userForm.role} onChange={(e) => setUserForm({...userForm, role: e.target.value})} className="w-full px-4 py-3 border rounded-xl">
                    <option value="user">کاربر</option>
                    <option value="supervisor">سرپرست</option>
                    <option value="manager">مدیر</option>
                    <option value="admin">مدیر سیستم</option>
                    <option value="applicant">متقاضی استخدام</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">واحد</label>
                  <select value={userForm.department_id} onChange={(e) => setUserForm({...userForm, department_id: e.target.value})} className="w-full px-4 py-3 border rounded-xl">
                    <option value="">بدون واحد</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold">{editingUser ? 'ذخیره' : 'ایجاد'}</button>
                <button type="button" onClick={() => { setShowUserForm(false); setEditingUser(null); }} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAnnouncementForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6">{editingAnnouncement ? 'ویرایش اطلاعیه' : 'اطلاعیه جدید'}</h3>
            <form onSubmit={addAnnouncement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">عنوان</label>
                <input type="text" value={announcementForm.title} onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})} className="w-full px-4 py-3 border rounded-xl" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">متن اطلاعیه</label>
                <textarea value={announcementForm.body} onChange={(e) => setAnnouncementForm({...announcementForm, body: e.target.value})} className="w-full px-4 py-3 border rounded-xl h-32 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تصویر (اختیاری)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAnnouncementImage}
                  className="w-full px-4 py-3 border rounded-xl text-sm file:ml-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-100 file:text-orange-700 file:font-medium file:cursor-pointer"
                />
                {announcementForm.image && (
                  <div className="mt-2 relative">
                    <img src={URL.createObjectURL(announcementForm.image)} alt="پیش‌نمایش" className="w-full h-40 object-cover rounded-xl" />
                    <button type="button" onClick={() => setAnnouncementForm({...announcementForm, image: null})} className="absolute top-2 left-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600">✕</button>
                  </div>
                )}
                {!announcementForm.image && editingAnnouncement?.image_path && (
                  <div className="mt-2 relative">
                    <img src={editingAnnouncement.image_path} alt="تصویر فعلی" className="w-full h-40 object-cover rounded-xl" />
                    <p className="text-[10px] text-gray-400 mt-1">تصویر فعلی</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">مخاطب</label>
                  <select value={announcementForm.target_audience} onChange={(e) => setAnnouncementForm({...announcementForm, target_audience: e.target.value})} className="w-full px-4 py-3 border rounded-xl">
                    <option value="all">همه کاربران</option>
                    <option value="manager">فقط مدیریت</option>
                    <option value="supervisor">فقط سرپرستان</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">اولویت</label>
                  <select value={announcementForm.priority} onChange={(e) => setAnnouncementForm({...announcementForm, priority: e.target.value})} className="w-full px-4 py-3 border rounded-xl">
                    <option value="normal">عادی</option>
                    <option value="important">مهم</option>
                    <option value="urgent">فوری</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold">{editingAnnouncement ? 'ذخیره' : 'انتشار'}</button>
                <button type="button" onClick={() => { setShowAnnouncementForm(false); setEditingAnnouncement(null); setAnnouncementForm({ title: '', body: '', target_audience: 'all', priority: 'normal', image: null }); }} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeptForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-bold mb-6">{editingDept ? 'ویرایش واحد' : 'واحد جدید'}</h3>
            <form onSubmit={addDept} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">نام واحد</label>
                <input type="text" value={deptForm.name} onChange={(e) => setDeptForm({...deptForm, name: e.target.value})} className="w-full px-4 py-3 border rounded-xl" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">واحد والد</label>
                <select value={deptForm.parent_id} onChange={(e) => setDeptForm({...deptForm, parent_id: e.target.value})} className="w-full px-4 py-3 border rounded-xl">
                  <option value="">بدون والد</option>
                  {departments.filter(d => !d.parent_id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold">{editingDept ? 'ذخیره' : 'ایجاد'}</button>
                <button type="button" onClick={() => { setShowDeptForm(false); setEditingDept(null); }} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t.id ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{users.filter(u => u.is_active).length} کاربر فعال</p>
            <button onClick={() => { setEditingUser(null); setUserForm({ username: '', password: '', full_name: '', role: 'user', department_id: '' }); setShowUserForm(true); }} className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-xl font-medium transition-colors">
              + کاربر جدید
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-right">نام</th>
                  <th className="p-3 text-right">کد پرسنلی</th>
                  <th className="p-3 text-right">واحد</th>
                  <th className="p-3 text-right">سمت</th>
                  <th className="p-3 text-right">وضعیت</th>
                  <th className="p-3 text-right">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.filter(u => u.is_active).map(u => (
                  <tr key={u.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{u.full_name}</td>
                    <td className="p-3 text-gray-500 font-mono">{u.id}</td>
                    <td className="p-3">{u.department_name || '-'}</td>
                    <td className="p-3"><span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColors[u.role]}`}>{roleLabels[u.role]}</span></td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">فعال</span></td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button onClick={() => editUser(u)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">ویرایش</button>
                        {u.role !== 'admin' && <button onClick={() => deleteUser(u.id, u.full_name)} className="text-red-500 hover:text-red-700 text-xs font-medium">حذف</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'departments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">{departments.length} واحد سازمانی</p>
              <p className="text-xs text-gray-400 mt-0.5">کاربران را به واحد اضافه کنید و سرپرست تعیین کنید</p>
            </div>
            <button onClick={() => { setEditingDept(null); setDeptForm({ name: '', parent_id: '' }); setShowDeptForm(true); }} className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
              <span className="text-lg leading-none">+</span> واحد جدید
            </button>
          </div>

          <div className="space-y-3">
            {departments.map(d => {
              const deptUsersList = users.filter(u => u.department_id === d.id && u.is_active);
              const supervisors = deptUsersList.filter(u => u.role === 'supervisor');
              const members = deptUsersList.filter(u => u.role === 'user');
              const isExpanded = expandedDept === d.id;
              const isAdding = addUserToDept === d.id;

              const availableUsers = users.filter(u => u.is_active && u.department_id !== d.id && u.role !== 'admin');

              return (
                <div key={d.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 hover:border-primary-200 transition-colors">
                  <div
                    className="px-5 py-4 flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedDept(isExpanded ? null : d.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-bold text-sm">{d.name.charAt(0)}</div>
                      <div>
                        <h4 className="font-bold text-sm text-gray-800">{d.name}</h4>
                        <div className="flex items-center gap-3 mt-0.5">
                          {supervisors.length > 0 && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              سرپرست: {supervisors.map(s => s.full_name).join('، ')}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400">{deptUsersList.length} نفر</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => editDept(d)} className="text-gray-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="ویرایش">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => deleteDept(d.id, d.name)} className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="حذف">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t px-5 py-4 space-y-4 bg-gray-50/50">
                      {supervisors.length > 0 && (
                        <div>
                          <p className="text-[10px] text-green-600 font-bold mb-2 uppercase tracking-wide">سرپرستان</p>
                          <div className="flex flex-wrap gap-2">
                            {supervisors.map(s => (
                              <div key={s.id} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                                <div className="w-7 h-7 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">{s.full_name.charAt(0)}</div>
                                <span className="text-xs font-medium text-green-800">{s.full_name}</span>
                                <span className="text-[10px] text-green-500 font-mono">({s.id})</span>
                                <div className="flex gap-1 mr-2">
                                  <button onClick={() => editUser(s)} className="text-[10px] text-gray-400 hover:text-blue-500 px-1">ویرایش</button>
                                  <button onClick={() => demoteSupervisor(d.id, s.id)} className="text-[10px] text-orange-400 hover:text-orange-600 px-1" title="حذف سرپرستی">↓</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">اعضای واحد ({members.length})</p>
                          <div className="flex gap-1.5">
                            <button onClick={() => openNewUserForDept(d.id)} className="text-[10px] font-medium px-3 py-1 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors">
                              + کاربر جدید
                            </button>
                            <button onClick={() => setAddUserToDept(isAdding ? null : d.id)} className={`text-[10px] font-medium px-3 py-1 rounded-full transition-colors ${isAdding ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-primary-100 text-primary-600 hover:bg-primary-200'}`}>
                              {isAdding ? 'انصراف' : '+ عضو موجود'}
                            </button>
                          </div>
                        </div>

                        {isAdding && (
                          <div className="flex gap-2 mb-3 bg-white p-3 rounded-xl border border-primary-200">
                            <SearchableSelect
                              options={availableUsers.map(u => ({ value: u.id, label: u.full_name, extra: u.department_name || 'بدون واحد' }))}
                              value={selectedUserId}
                              onChange={setSelectedUserId}
                              placeholder="انتخاب کاربر..."
                            />
                            <button onClick={() => addMemberToDept(d.id)} className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors">افزودن</button>
                          </div>
                        )}

                        {members.length === 0 ? (
                          <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">هنوز عضوی اضافه نشده</p>
                        ) : (
                          <div className="space-y-1">
                            {members.map(m => (
                              <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-xl group hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold">{m.full_name.charAt(0)}</div>
                                  <div>
                                    <span className="text-xs font-medium">{m.full_name}</span>
                                    <span className="text-[10px] text-gray-400 mr-2 font-mono">({m.id})</span>
                                  </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => promoteSupervisor(d.id, m.id)} className="text-[10px] text-green-500 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50" title="ارتقا به سرپرست">↑ سرپرست</button>
                                  <button onClick={() => editUser(m)} className="text-[10px] text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50">ویرایش</button>
                                  <button onClick={() => removeMemberFromDept(d.id, m.id, m.full_name)} className="text-[10px] text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50" title="خارج از واحد">خروج</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {(() => {
            const managers = users.filter(u => (u.role === 'admin' || u.role === 'manager') && u.is_active);
            if (managers.length === 0) return null;
            return (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 mt-4">
                <div className="px-5 py-4 bg-gradient-to-l from-red-600 to-red-800">
                  <h4 className="text-white font-bold text-sm">هیئت مدیره</h4>
                  <p className="text-red-200 text-xs mt-0.5">مدیران و مدیر سیستم</p>
                </div>
                <div className="px-5 py-3 space-y-2">
                  {managers.map(m => (
                    <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-50 group">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 ${m.role === 'admin' ? 'bg-red-500' : 'bg-blue-500'} text-white rounded-full flex items-center justify-center text-xs font-bold`}>{m.full_name.charAt(0)}</div>
                        <div>
                          <span className="text-xs font-medium">{m.full_name}</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${roleColors[m.role]}`}>{roleLabels[m.role]}</span>
                            <span className="text-[10px] text-gray-400">{m.department_name || 'بدون واحد'}</span>
                          </div>
                        </div>
                      </div>
                      <button onClick={() => editUser(m)} className="text-[10px] text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded hover:bg-blue-50">ویرایش</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center"><p className="text-3xl font-bold text-primary-600">{stats.totalUsers}</p><p className="text-sm text-gray-500 mt-1">کاربر فعال</p></div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center"><p className="text-3xl font-bold text-green-600">{stats.totalDepts}</p><p className="text-sm text-gray-500 mt-1">واحد سازمانی</p></div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center"><p className="text-3xl font-bold text-yellow-600">{stats.pendingLeaves}</p><p className="text-sm text-gray-500 mt-1">مرخصی در انتظار</p></div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center"><p className="text-3xl font-bold text-purple-600">{stats.pendingLetters}</p><p className="text-sm text-gray-500 mt-1">نامه در انتظار</p></div>
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center"><p className="text-3xl font-bold text-red-600">{stats.pendingCardex}</p><p className="text-sm text-gray-500 mt-1">کارتکس در انتظار</p></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-4">نقش‌ها</h3>
              {stats.roleStats.map(r => (
                <div key={r.role} className="flex justify-between items-center py-2 border-b"><span className="text-sm">{roleLabels[r.role]}</span><span className="font-bold">{r.count} نفر</span></div>
              ))}
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-4">واحدها</h3>
              {stats.deptStats.map(d => (
                <div key={d.name} className="flex justify-between items-center py-2 border-b"><span className="text-sm">{d.name}</span><span className="font-bold">{d.user_count} نفر</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-bold text-gray-800">ایجاد بکاپ جدید</h3>
                <p className="text-sm text-gray-500 mt-1">از تمام اطلاعات سیستم بکاپ تهیه کنید</p>
              </div>
              <button
                onClick={createBackup}
                disabled={creatingBackup}
                className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingBackup ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    در حال ایجاد بکاپ...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    ایجاد بکاپ
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="font-bold text-gray-800">لیست بکاپ‌ها</h3>
              <p className="text-sm text-gray-500 mt-1">{backups.length} بکاپ موجود</p>
            </div>
            {backups.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                <p className="text-gray-400">هنوز بکاپی ایجاد نشده</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-4 text-right">نام فایل</th>
                      <th className="p-4 text-right">اندازه</th>
                      <th className="p-4 text-right">تاریخ ایجاد</th>
                      <th className="p-4 text-right">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b, i) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="p-4 font-mono text-xs text-gray-700">{b.filename}</td>
                        <td className="p-4 text-gray-600">{formatSize(b.size)}</td>
                        <td className="p-4 text-gray-600 text-xs">{toJalaliDateTime(b.created)}</td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            <button onClick={() => downloadBackup(b.filename)} className="text-blue-500 hover:text-blue-700 text-xs font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                              دانلود
                            </button>
                            <button onClick={() => restoreBackup(b.filename)} className="text-green-500 hover:text-green-700 text-xs font-medium px-3 py-1 rounded-lg hover:bg-green-50 transition-colors">
                              بازیابی
                            </button>
                            <button onClick={() => deleteBackup(b.filename)} className="text-red-400 hover:text-red-600 text-xs font-medium px-3 py-1 rounded-lg hover:bg-red-50 transition-colors">
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'permissions' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-l from-green-500 to-emerald-700 rounded-2xl p-5 text-white">
            <h3 className="font-bold text-lg">مدیریت دسترسی کاربران</h3>
            <p className="text-green-200 text-sm mt-1">کاربران را انتخاب کنید و دسترسی‌ها را تخصیص دهید</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-sm text-gray-500">{users.filter(u => u.is_active).length} کاربر فعال</p>
                <p className="text-xs text-gray-400 mt-0.5">{checkedUserIds.size} کاربر انتخاب شده</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allActive = users.filter(u => u.is_active);
                    const allIds = new Set(allActive.map(u => u.id));
                    setCheckedUserIds(allIds);
                  }}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-xl text-xs font-medium transition-colors"
                >
                  انتخاب همه
                </button>
                <button
                  type="button"
                  onClick={() => setCheckedUserIds(new Set())}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-xl text-xs font-medium transition-colors"
                >
                  از انتخاب خارج کن
                </button>
              </div>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b text-xs font-bold text-gray-600">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={users.filter(u => u.is_active).length > 0 && checkedUserIds.size === users.filter(u => u.is_active).length}
                    onChange={(e) => {
                      const allActive = users.filter(u => u.is_active);
                      if (e.target.checked) {
                        setCheckedUserIds(new Set(allActive.map(u => u.id)));
                      } else {
                        setCheckedUserIds(new Set());
                      }
                    }}
                    className="rounded"
                  />
                </div>
                <div className="col-span-5">نام کاربر</div>
                <div className="col-span-3">واحد</div>
                <div className="col-span-3">سمت</div>
              </div>
              <div className="max-h-[50vh] overflow-y-auto">
                {users.filter(u => u.is_active).map(u => (
                  <div
                    key={u.id}
                    className={`grid grid-cols-12 gap-2 px-4 py-2.5 border-b last:border-b-0 text-sm items-center transition-colors ${
                      checkedUserIds.has(u.id) ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="col-span-1">
                      <input
                        type="checkbox"
                        checked={checkedUserIds.has(u.id)}
                        onChange={(e) => {
                          const next = new Set(checkedUserIds);
                          if (e.target.checked) {
                            next.add(u.id);
                          } else {
                            next.delete(u.id);
                          }
                          setCheckedUserIds(next);
                        }}
                        className="rounded"
                      />
                    </div>
                    <div className="col-span-5 font-medium">{u.full_name}</div>
                    <div className="col-span-3 text-gray-600">{u.department_name || '-'}</div>
                    <div className="col-span-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${roleColors[u.role]}`}>
                        {roleLabels[u.role]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (checkedUserIds.size === 0) {
                    toast.error('حداقل یک کاربر را انتخاب کنید');
                    return;
                  }
                  setPendingSaveCount(checkedUserIds.size);
                  setShowConfirmModal(true);
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
              >
                <span>💾</span>
                ثبت نهایی
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'perm-matrix' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-l from-primary-500 to-primary-700 rounded-2xl p-5 text-white">
            <h3 className="font-bold text-lg">مدیریت دسترسی‌ها (ماتریکس)</h3>
            <p className="text-primary-200 text-sm mt-1">دسترسی‌ها را بر اساس واحد/شخص یا بر اساس دسترسی مدیریت کنید</p>
          </div>

          <PermMatrixMode matrix={matrix} loadMatrix={loadMatrix} />
        </div>
      )}

      {tab === 'toast-central' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-l from-orange-500 to-red-600 rounded-2xl p-5 text-white">
            <h3 className="font-bold text-lg">📢 سانترال اطلاعیه</h3>
            <p className="text-orange-200 text-sm mt-1">اطلاعیه‌ها و اعلانات سیستم را مدیریت کنید</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-sm text-gray-500">{announcements.length} اطلاعیه ثبت شده</p>
              </div>
              <button
                onClick={() => { setEditingAnnouncement(null); setAnnouncementForm({ title: '', body: '', target_audience: 'all', priority: 'normal' }); setShowAnnouncementForm(true); }}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <span className="text-lg leading-none">+</span>
                اطلاعیه جدید
              </button>
            </div>

            {announcements.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-5xl">📢</span>
                <p className="text-gray-400 mt-4">هنوز اطلاعیه‌ای ثبت نشده</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map(a => {
                  const audienceLabels = { all: 'همه کاربران', manager: 'مدیریت', supervisor: 'سرپرستان' };
                  const priorityLabels = { normal: 'عادی', important: 'مهم', urgent: 'فوری' };
                  const priorityColors = { normal: 'bg-gray-100 text-gray-700', important: 'bg-yellow-100 text-yellow-700', urgent: 'bg-red-100 text-red-700' };
                  const audienceColors = { all: 'bg-blue-100 text-blue-700', manager: 'bg-purple-100 text-purple-700', supervisor: 'bg-green-100 text-green-700' };

                  return (
                    <div key={a.id} className={`border rounded-xl p-4 transition-all ${a.is_active ? 'hover:shadow-md' : 'opacity-50 bg-gray-50'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-gray-800">{a.title}</h4>
                            {!a.is_active && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">غیرفعال</span>}
                          </div>
                          {a.body && <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{a.body}</p>}
                          {a.image_path && (
                            <div className="mb-3">
                              <img src={a.image_path} alt={a.title} className="w-full max-h-48 object-cover rounded-xl border" />
                            </div>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${audienceColors[a.target_audience]}`}>
                              {audienceLabels[a.target_audience]}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${priorityColors[a.priority]}`}>
                              {priorityLabels[a.priority]}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              توسط {a.creator_name || 'نامشخص'} • {toJalali(a.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleAnnouncementActive(a.id, a.is_active)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${a.is_active ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}`}
                          >
                            {a.is_active ? 'فعال' : 'غیرفعال'}
                          </button>
                          <button onClick={() => editAnnouncement(a)} className="text-blue-500 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="ویرایش">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => deleteAnnouncement(a.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors" title="حذف">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'job-applications' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-l from-blue-500 to-indigo-700 rounded-2xl p-5 text-white">
            <h3 className="font-bold text-lg">📋 پرسشنامه‌های استخدامی</h3>
            <p className="text-blue-200 text-sm mt-1">پرسشنامه‌های دریافتی از متقاضیان استخدام را بررسی و مدیریت کنید</p>
          </div>

          {selectedApplication && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in" dir="rtl">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <h3 className="text-lg font-bold">جزئیات پرسشنامه - {selectedApplication.full_name}</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => printJobApplication(selectedApplication)} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">چاپ</button>
                    <button onClick={() => { setSelectedApplication(null); setReviewComment(''); }} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedApplication.photo && (
                    <div className="flex justify-center">
                      <img src={selectedApplication.photo} alt={selectedApplication.full_name} className="w-32 h-32 object-cover rounded-2xl border-4 border-primary-200 shadow-lg cursor-pointer hover:opacity-80 transition" onClick={() => setViewPhoto(selectedApplication.photo)} />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-primary-700 text-sm border-b border-primary-100 pb-1 mb-3">اطلاعات شخصی</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-gray-500">نام:</span> <span className="font-medium">{selectedApplication.full_name}</span></div>
                      <div><span className="text-gray-500">نام پدر:</span> <span className="font-medium">{selectedApplication.father_name || '-'}</span></div>
                      <div><span className="text-gray-500">ش.ش:</span> <span className="font-medium">{selectedApplication.national_id || '-'}</span></div>
                      <div><span className="text-gray-500">صادره از:</span> <span className="font-medium">{selectedApplication.national_id_issued_from || '-'}</span></div>
                      <div><span className="text-gray-500">تاریخ تولد:</span> <span className="font-medium">{selectedApplication.birth_date || '-'}</span></div>
                      <div><span className="text-gray-500">محل تولد:</span> <span className="font-medium">{selectedApplication.birth_place || '-'}</span></div>
                      <div><span className="text-gray-500">مدت اقامت:</span> <span className="font-medium">{selectedApplication.residence_duration || '-'}</span></div>
                      <div><span className="text-gray-500">ملیت:</span> <span className="font-medium">{selectedApplication.nationality || '-'}</span></div>
                      <div><span className="text-gray-500">مذهب:</span> <span className="font-medium">{selectedApplication.religion || '-'}</span></div>
                      <div><span className="text-gray-500">مدرک تحصیلی:</span> <span className="font-medium">{selectedApplication.education_level || '-'}</span></div>
                      <div><span className="text-gray-500">محل تحصیل:</span> <span className="font-medium">{selectedApplication.education_place || '-'}</span></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-primary-700 text-sm border-b border-primary-100 pb-1 mb-3">نظام وظیفه</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-gray-500">انجام داده:</span> <span className="font-medium">{selectedApplication.military_done}</span></div>
                      <div><span className="text-gray-500">رسته خدمت:</span> <span className="font-medium">{selectedApplication.military_service_type || '-'}</span></div>
                      <div><span className="text-gray-500">معافیت پزشکی:</span> <span className="font-medium">{selectedApplication.military_exempt_medical || '-'}</span></div>
                      <div><span className="text-gray-500">علت معافیت:</span> <span className="font-medium">{selectedApplication.military_exempt_reason || '-'}</span></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-primary-700 text-sm border-b border-primary-100 pb-1 mb-3">وضعیت خانوادگی و مالی</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-gray-500">وضعیت تاهل:</span> <span className="font-medium">{selectedApplication.marital_status || '-'}</span></div>
                      <div><span className="text-gray-500">تعداد فرزندان:</span> <span className="font-medium">{selectedApplication.children_count}</span></div>
                      <div><span className="text-gray-500">شغل همسر:</span> <span className="font-medium">{selectedApplication.spouse_job || '-'}</span></div>
                      <div><span className="text-gray-500">حقوق درخواستی:</span> <span className="font-medium">{Number(selectedApplication.requested_salary || 0).toLocaleString()} ریال</span></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-primary-700 text-sm border-b border-primary-100 pb-1 mb-3">مسکن و تماس</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-gray-500">وضعیت مسکن:</span> <span className="font-medium">{selectedApplication.housing_status || '-'}</span></div>
                      <div><span className="text-gray-500">اجاره:</span> <span className="font-medium">{Number(selectedApplication.housing_rent_amount || 0).toLocaleString()} ریال</span></div>
                      <div><span className="text-gray-500">تلفن:</span> <span className="font-medium">{selectedApplication.phone_number || '-'}</span></div>
                      <div className="col-span-2"><span className="text-gray-500">نشانی:</span> <span className="font-medium">{selectedApplication.residential_address || '-'}</span></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-primary-700 text-sm border-b border-primary-100 pb-1 mb-3">سایر اطلاعات</h4>
                    <div className="space-y-2 text-sm">
                      {selectedApplication.moral_traits && <div><span className="text-gray-500">ویژگی‌های اخلاقی:</span><p className="mt-1 bg-gray-50 p-2 rounded">{selectedApplication.moral_traits}</p></div>}
                      <div><span className="text-gray-500">اقوام در شرکت:</span> <span className="font-medium">{selectedApplication.relatives_in_company}</span> {selectedApplication.relatives_details && `- ${selectedApplication.relatives_details}`}</div>
                      <div><span className="text-gray-500">محکومیت:</span> <span className="font-medium">{selectedApplication.criminal_record}</span></div>
                      <div><span className="text-gray-500">دخانیات:</span> <span className="font-medium">{selectedApplication.smoking}</span> {selectedApplication.smoking_duration && `- ${selectedApplication.smoking_duration}`}</div>
                      {selectedApplication.kave_factories && <div><span className="text-gray-500">سابقه در کاوه:</span> <span className="font-medium">{selectedApplication.kave_factories}</span></div>}
                    </div>
                  </div>

                  {selectedApplication.work_history && selectedApplication.work_history.length > 0 && (
                    <div>
                      <h4 className="font-bold text-primary-700 text-sm border-b border-primary-100 pb-1 mb-3">سوابق کاری</h4>
                      <div className="space-y-2">
                        {selectedApplication.work_history.map((w, i) => (
                          <div key={i} className="bg-gray-50 rounded-xl p-3 text-sm">
                            <p className="font-bold text-xs text-gray-500 mb-1">شغل {i + 1}</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              <div><span className="text-gray-500">سازمان:</span> {w.org_name || '-'}</div>
                              <div><span className="text-gray-500">سمت:</span> {w.position || '-'}</div>
                              <div><span className="text-gray-500">مدت:</span> {w.duration || '-'}</div>
                              <div><span className="text-gray-500">حقوق:</span> {w.last_salary || '-'}</div>
                              <div><span className="text-gray-500">علت ترک:</span> {w.leave_reason || '-'}</div>
                              <div><span className="text-gray-500">تماس:</span> {w.contact_info || '-'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-bold text-primary-700 text-sm border-b border-primary-100 pb-1 mb-3">معرف‌ها</h4>
                    <p className="text-sm bg-gray-50 p-2 rounded whitespace-pre-wrap">{selectedApplication.references_info || '-'}</p>
                  </div>

                  {selectedApplication.attachments && selectedApplication.attachments.length > 0 && (
                    <div>
                      <h4 className="font-bold text-primary-700 text-sm border-b border-primary-100 pb-1 mb-3">فایل‌های پیوست</h4>
                      <div className="space-y-1">
                        {selectedApplication.attachments.map((a, i) => (
                          <a key={i} href={a.file_path} target="_blank" rel="noreferrer" className="block text-sm text-blue-600 hover:underline p-1">{a.file_name}</a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4">
                    <h4 className="font-bold text-sm mb-2">نظر بررسی‌کننده</h4>
                    <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="نظر خود را بنویسید..." />
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => reviewApplication(selectedApplication.id, 'reviewed')} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-xl text-sm font-bold">بررسی شده</button>
                      <button onClick={() => reviewApplication(selectedApplication.id, 'accepted')} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-sm font-bold">پذیرفته شده</button>
                      <button onClick={() => reviewApplication(selectedApplication.id, 'rejected')} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-xl text-sm font-bold">رد شده</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <p className="text-sm text-gray-500">{jobApplications.length} پرسشنامه ثبت شده</p>
            </div>
            {jobApplications.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-5xl">📋</span>
                <p className="text-gray-400 mt-4">هنوز پرسشنامه‌ای ثبت نشده</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-right">نام</th>
                      <th className="p-3 text-right">مدرک تحصیلی</th>
                      <th className="p-3 text-right">تلفن</th>
                      <th className="p-3 text-right">تاریخ ثبت</th>
                      <th className="p-3 text-right">وضعیت</th>
                      <th className="p-3 text-right">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobApplications.map(a => {
                      const statusMap = {
                        new: { text: 'جدید', color: 'bg-blue-100 text-blue-700' },
                        reviewed: { text: 'بررسی شده', color: 'bg-yellow-100 text-yellow-700' },
                        accepted: { text: 'پذیرفته شده', color: 'bg-green-100 text-green-700' },
                        rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
                      };
                      const s = statusMap[a.status] || statusMap.new;
                      return (
                    <tr key={a.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {a.photo ? <img src={a.photo} alt="" className="w-8 h-8 rounded-full object-cover border cursor-pointer hover:opacity-80" onClick={(e) => { e.stopPropagation(); setViewPhoto(a.photo); }} /> : <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-500">{a.full_name?.charAt(0)}</div>}
                          <span className="font-medium">{a.full_name}</span>
                        </div>
                      </td>
                          <td className="p-3">{a.education_level || '-'}</td>
                          <td className="p-3" dir="ltr">{a.phone_number || '-'}</td>
                          <td className="p-3 text-xs">{toJalali(a.created_at)}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${s.color}`}>{s.text}</span></td>
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button onClick={() => viewApplication(a.id)} className="text-blue-500 hover:text-blue-700 text-xs font-medium">مشاهده</button>
                              <button onClick={() => deleteJobApplication(a.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">حذف</button>
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

      {tab === 'camera-settings' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-l from-green-500 to-emerald-700 rounded-2xl p-5 text-white">
            <h3 className="font-bold text-lg">📷 تنظیمات دوربین حراست</h3>
            <p className="text-green-200 text-sm mt-1">اطلاعات اتصال دوربین شبکه را تنظیم کنید</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">آیپی دوربین</label>
                <input type="text" value={cameraConfig.ip} onChange={(e) => setCameraConfig({...cameraConfig, ip: e.target.value})} className="w-full px-4 py-3 border rounded-xl" placeholder="172.20.2.26" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">پورت</label>
                <input type="number" value={cameraConfig.port} onChange={(e) => setCameraConfig({...cameraConfig, port: parseInt(e.target.value) || 80})} className="w-full px-4 py-3 border rounded-xl" placeholder="80" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">پورت RTSP</label>
                <input type="number" value={cameraConfig.rtsp_port || 554} onChange={(e) => setCameraConfig({...cameraConfig, rtsp_port: parseInt(e.target.value) || 554})} className="w-full px-4 py-3 border rounded-xl" placeholder="554" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نام کاربری</label>
                <input type="text" value={cameraConfig.username} onChange={(e) => setCameraConfig({...cameraConfig, username: e.target.value})} className="w-full px-4 py-3 border rounded-xl" placeholder="admin" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">رمز عبور</label>
                <input type="password" value={cameraConfig.password} onChange={(e) => setCameraConfig({...cameraConfig, password: e.target.value})} className="w-full px-4 py-3 border rounded-xl" placeholder="admin123" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">کانال</label>
                <input type="number" value={cameraConfig.channel} onChange={(e) => setCameraConfig({...cameraConfig, channel: parseInt(e.target.value) || 1})} className="w-full px-4 py-3 border rounded-xl" placeholder="1" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={saveCameraConfig} className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-xl font-bold text-sm transition-colors">💾 ذخیره تنظیمات</button>
              <button onClick={testCamera} className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm transition-colors">🔌 تست اتصال</button>
            </div>

            {cameraTestResult && (
              <div className={`p-4 rounded-xl ${cameraTestResult.connected ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{cameraTestResult.connected ? '✅' : '❌'}</span>
                  <span className="font-bold text-sm">{cameraTestResult.connected ? 'اتصال موفق' : 'اتصال ناموفق'}</span>
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">آیپی:</span> {cameraConfig.ip}:{cameraConfig.port}</p>
                  {cameraTestResult.model && <p><span className="text-gray-500">مدل:</span> {cameraTestResult.model}</p>}
                  {cameraTestResult.serial && <p><span className="text-gray-500">سریال:</span> {cameraTestResult.serial}</p>}
                  {cameraTestResult.rtsp_url && <p className="break-all"><span className="text-gray-500">آدرس RTSP:</span> <span className="text-xs bg-gray-100 px-2 py-1 rounded">{cameraTestResult.rtsp_url}</span></p>}
                  {cameraTestResult.error && <p className="text-red-600"><span className="text-gray-500">خطا:</span> {cameraTestResult.error}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {viewPhoto && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] cursor-pointer" onClick={() => setViewPhoto(null)}>
          <button onClick={() => setViewPhoto(null)} className="absolute top-4 left-4 bg-white/20 hover:bg-white/40 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold transition">✕</button>
          <img src={viewPhoto} alt="عکس بزرگ" className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in overflow-hidden">
            <div className="bg-yellow-50 px-6 py-4 border-b border-yellow-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                </div>
                <h3 className="font-bold text-gray-800 text-base">تایید ذخیره دسترسی‌ها</h3>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 leading-relaxed">
                شما در حال تخصیص دسترسی به <span className="font-bold text-primary-600">{pendingSaveCount}</span> کاربر هستید.
                <br />
                آیا از ذخیره این تغییرات اطمینان دارید؟
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowConfirmModal(false);
                  try {
                    const token = localStorage.getItem('token');
                    const response = await fetch('/api/permissions/bulk-set-users', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ userIds: Array.from(checkedUserIds) }),
                    });
                    const data = await response.json();
                    if (response.ok) {
                      toast.success('دسترسی‌ها با موفقیت ثبت شد');
                      setCheckedUserIds(new Set());
                    } else {
                      toast.error(data.error || 'خطا در ذخیره دسترسی‌ها');
                    }
                  } catch (err) {
                    toast.error('خطا در ارتباط با سرور');
                  }
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-700 transition-colors"
              >
                بله، اعمال شود
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
