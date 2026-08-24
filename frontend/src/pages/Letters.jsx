import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import { printTable, printLetter } from '../utils/printUtils';
import { toJalaliDateTime } from '../utils/dateUtils';
import RichTextEditor from '../components/RichTextEditor';
import HtmlContent from '../components/HtmlContent';
import LettersHelpModal from '../components/LettersHelpModal';

const statusMap = {
  pending_central: { text: 'در انتظار سانترال', color: 'bg-blue-100 text-blue-700' },
  pending_manager: { text: 'در انتظار مدیر', color: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'تایید شده', color: 'bg-green-100 text-green-700' },
  rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
  archived: { text: 'بایگانی شده', color: 'bg-purple-100 text-purple-700' },
  forwarded: { text: 'ارجاع شده', color: 'bg-indigo-100 text-indigo-700' },
  pending_archive: { text: 'در انتظار بایگانی', color: 'bg-blue-100 text-blue-700' },
};

const priorityMap = {
  priority_1: { text: 'اولویت 1', color: 'bg-red-100 text-red-700' },
  priority_2: { text: 'اولویت 2', color: 'bg-orange-100 text-orange-700' },
  priority_3: { text: 'اولویت 3', color: 'bg-gray-100 text-gray-700' },
};

const historyActions = {
  created: { text: 'ثبت نامه', color: 'bg-blue-500' },
  sent_to_manager: { text: 'ارسال به مدیر', color: 'bg-yellow-500' },
  approved: { text: 'تایید', color: 'bg-green-500' },
  rejected: { text: 'رد', color: 'bg-red-500' },
  archived: { text: 'بایگانی', color: 'bg-purple-500' },
  forwarded: { text: 'ارجاع', color: 'bg-indigo-500' },
  seen_unit: { text: 'رویت واحد', color: 'bg-gray-500' },
};

export default function Letters() {
  const { user, hasPermission } = useAuth();
  const [tab, setTab] = useState('my');
  const [myLetters, setMyLetters] = useState([]);
  const [pendingCentral, setPendingCentral] = useState([]);
  const [pendingManager, setPendingManager] = useState([]);
  const [processedManager, setProcessedManager] = useState([]);
  const [returnedCentral, setReturnedCentral] = useState([]);
  const [archivedLetters, setArchivedLetters] = useState([]);
  const [unitLetters, setUnitLetters] = useState([]);
  const [allLetters, setAllLetters] = useState([]);
  const [allLettersTotal, setAllLettersTotal] = useState(0);
  const [allLettersPage, setAllLettersPage] = useState(1);
  const [allLettersSearch, setAllLettersSearch] = useState('');
  const [allLettersDebounce, setAllLettersDebounce] = useState('');
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showSendManager, setShowSendManager] = useState(null);
  const [showForward, setShowForward] = useState(null);
  const [showHistory, setShowHistory] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [selectedManagers, setSelectedManagers] = useState([]);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState([]);
  const fileInputRef = useRef(null);
  const [letterSearch, setLetterSearch] = useState('');
  const [form, setForm] = useState({ subject: '', body: '', priority: 'priority_3' });
  const [nextNumber, setNextNumber] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  const isSantral = hasPermission('letters_central');
  const isManager = user.role === 'manager' || user.role === 'admin';

  const filteredArchived = archivedLetters.filter(l => !letterSearch || (l.letter_number && l.letter_number.includes(letterSearch)));
  const filteredAll = allLetters;
  const filteredMy = myLetters.filter(l => 
    !letterSearch || 
    (l.letter_number && l.letter_number.toLowerCase().includes(letterSearch.toLowerCase())) ||
    (l.subject && l.subject.toLowerCase().includes(letterSearch.toLowerCase()))
  );
  const filteredUnit = unitLetters.filter(l => 
    !letterSearch || 
    (l.letter_number && l.letter_number.toLowerCase().includes(letterSearch.toLowerCase())) ||
    (l.subject && l.subject.toLowerCase().includes(letterSearch.toLowerCase()))
  );
  const filteredProcessedManager = processedManager.filter(l => 
    !letterSearch || 
    (l.letter_number && l.letter_number.toLowerCase().includes(letterSearch.toLowerCase())) ||
    (l.subject && l.subject.toLowerCase().includes(letterSearch.toLowerCase()))
  );

  const fetchPendingCounts = useCallback(async () => {
    try {
      const promises = [
        api.get('/letters/my-unit').then(r => setUnitLetters(r.data)).catch(() => {})
      ];
      if (isSantral) {
        promises.push(api.get('/letters/pending-central').then(r => setPendingCentral(r.data)).catch(() => {}));
        promises.push(api.get('/letters/returned-central').then(r => setReturnedCentral(r.data)).catch(() => {}));
        promises.push(api.get('/letters/archived').then(r => setArchivedLetters(r.data)).catch(() => {}));
      }
      if (isManager) {
        promises.push(api.get('/letters/pending-manager').then(r => setPendingManager(r.data)).catch(() => {}));
        promises.push(api.get('/letters/processed-manager').then(r => setProcessedManager(r.data)).catch(() => {}));
      }
      await Promise.all(promises);
    } catch (e) {
      /* ignore */
    }
  }, [isSantral, isManager]);

  useEffect(() => {
    fetchPendingCounts();
  }, [fetchPendingCounts]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
      fetchPendingCounts();
    };
    window.addEventListener('ws-update', handleUpdate);
    return () => window.removeEventListener('ws-update', handleUpdate);
  }, [tab, allLettersPage, fetchPendingCounts]);

  useEffect(() => {
    const timer = setTimeout(() => setAllLettersDebounce(allLettersSearch), 400);
    return () => clearTimeout(timer);
  }, [allLettersSearch]);

  useEffect(() => {
    if (tab === 'all') setAllLettersPage(1);
  }, [allLettersDebounce, tab]);

  const fetchNextNumber = async () => {
    try {
      const res = await api.get('/letters/next-number');
      setNextNumber(res.data.next_number);
    } catch (err) {
      toast.error('خطا در دریافت شماره نامه');
    }
  };

  const loadData = async () => {
    try {
      if (tab === 'my') {
        const myRes = await api.get('/letters/my-letters');
        setMyLetters(myRes.data);
      } else if (tab === 'unit') {
        const unitRes = await api.get('/letters/my-unit');
        setUnitLetters(unitRes.data);
      } else if (tab === 'central' || tab === 'returned' || tab === 'archived' || tab === 'all') {
        if (departments.length === 0 || managers.length === 0) {
          const [deptRes, mgrRes] = await Promise.all([
            api.get('/admin/departments'),
            api.get('/letters/managers')
          ]);
          setDepartments(deptRes.data);
          setManagers(mgrRes.data);
        }
        if (tab === 'central') {
          const pendRes = await api.get('/letters/pending-central');
          setPendingCentral(pendRes.data);
        } else if (tab === 'returned') {
          const retRes = await api.get('/letters/returned-central');
          setReturnedCentral(retRes.data);
        } else if (tab === 'archived') {
          const archRes = await api.get('/letters/archived');
          setArchivedLetters(archRes.data);
        } else if (tab === 'all') {
          const allRes = await api.get('/letters/all', { params: { page: allLettersPage, limit: 50, search: allLettersDebounce } });
          setAllLetters(allRes.data.data);
          setAllLettersTotal(allRes.data.total);
        }
      } else if (tab === 'manager' || tab === 'manager_processed') {
        if (managers.length === 0) {
          const mgrRes = await api.get('/letters/managers');
          setManagers(mgrRes.data);
        }
        const [mgrLetters, procLetters] = await Promise.all([
          api.get('/letters/pending-manager'),
          api.get('/letters/processed-manager')
        ]);
        setPendingManager(mgrLetters.data);
        setProcessedManager(procLetters.data);
      }
    } catch (err) {
      toast.error('خطا در بارگذاری');
    }
  };

  const submitLetter = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('subject', form.subject);
      formData.append('body', form.body);
      formData.append('priority', form.priority);
      if (files && files.length > 0) {
        files.forEach(f => {
          formData.append('attachments', f);
        });
      }

      await api.post('/letters', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('نامه ثبت شد و برای سانترال ارسال شد');
      setShowForm(false);
      setForm({ subject: '', body: '', priority: 'priority_3' });
      setFiles([]);
      setNextNumber('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const sendToManager = async (letterId) => {
    if (selectedManagers.length === 0) {
      toast.error('حداقل یک مدیر انتخاب کنید');
      return;
    }
    try {
      for (const mgrId of selectedManagers) {
        await api.put(`/letters/${letterId}/send-to-manager`, { manager_id: mgrId, comment });
      }
      toast.success('نامه به مدیران ارسال شد');
      setShowSendManager(null);
      setSelectedManagers([]);
      setComment('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const approveLetter = async (id) => {
    try {
      await api.put(`/letters/${id}/approve`, { comment });
      toast.success('تایید شد و به سانترال بازگشت');
      setComment('');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const rejectLetter = async (id) => {
    try {
      await api.put(`/letters/${id}/reject`, { comment: comment || 'رد شده' });
      toast.success('رد شد');
      setComment('');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const archiveLetter = async (id) => {
    try {
      await api.put(`/letters/${id}/archive`);
      toast.success('بایگانی شد');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const forwardLetter = async (id) => {
    if (selectedUnits.length === 0) {
      toast.error('حداقل یک واحد انتخاب کنید');
      return;
    }
    try {
      await api.put(`/letters/${id}/forward`, { unit_ids: selectedUnits });
      toast.success('ارجاع شد');
      setShowForward(null);
      setSelectedUnits([]);
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const seenUnit = async (id) => {
    try {
      await api.put(`/letters/${id}/seen-unit`);
      toast.success('رویت شد');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const viewHistory = async (id) => {
    setShowHistory(id);
    try {
      const res = await api.get(`/letters/${id}/history`);
      setHistoryData(res.data);
    } catch (err) {
      toast.error('خطا');
    }
  };

  const FileBadge = ({ name, link }) => {
    if (!name) return <span className="text-gray-400 text-xs">-</span>;
    const ext = name.split('.').pop().toLowerCase();
    const icons = { pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', zip: '📦', rar: '📦', txt: '📃' };
    return (
      <a href={link} target="_blank" rel="noopener noreferrer"
         className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-xs hover:bg-blue-100 transition-colors">
        <span>{icons[ext] || '📎'}</span>
        <span className="max-w-[120px] truncate">{name}</span>
      </a>
    );
  };

  const tabs = [
    { id: 'my', label: 'نامه‌های من' },
    { id: 'unit', label: `نامه‌های واحد (${unitLetters.length})` },
    ...(isSantral ? [
      { id: 'central', label: `در انتظار سانترال (${pendingCentral.length})` },
      { id: 'returned', label: `برگشتی از مدیر (${returnedCentral.length})` },
      { id: 'archived', label: `بایگانی (${archivedLetters.length})` },
      { id: 'all', label: 'همه نامه‌ها' },
    ] : []),
    ...(isManager ? [
      { id: 'manager', label: `در انتظار مدیر (${pendingManager.length})` },
      { id: 'manager_processed', label: `اقدام شده توسط من (${processedManager.length})` },
    ] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">مدیریت نامه‌ها</h2>
        <button
          onClick={() => setShowHelpModal(true)}
          className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-xs"
          title="راهنمای سامانه و گردش نامه‌ها"
        >
          <span className="text-base">📖</span>
          <span>راهنما</span>
        </button>
      </div>

      <LettersHelpModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6">نامه جدید</h3>
            <form onSubmit={submitLetter} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">شماره نامه</label>
                  <input type="text" value={nextNumber} readOnly className="w-full px-4 py-3 border rounded-xl bg-gray-50 text-gray-600 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">اولویت</label>
                  <select value={form.priority} onChange={(e) => setForm({...form, priority: e.target.value})} className="w-full px-4 py-3 border rounded-xl">
                    <option value="priority_1">اولویت 1</option>
                    <option value="priority_2">اولویت 2</option>
                    <option value="priority_3">اولویت 3</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">موضوع</label>
                <input type="text" value={form.subject} onChange={(e) => setForm({...form, subject: e.target.value})} className="w-full px-4 py-3 border rounded-xl" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">متن نامه</label>
                <RichTextEditor
                  value={form.body}
                  onChange={(val) => setForm({ ...form, body: val })}
                  placeholder="متن نامه را همراه با امکان قالب‌بندی (تیتر، پررنگ، خط زیر، فهرست و تراز) اینجا وارد کنید..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">فایل‌های پیوست (حداکثر ۱۰ فایل، تا ۲۰ مگابایت)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.zip,.rar,.txt,.webp,.bmp,.svg,.tiff,.tar,.gz,.7z"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (!selectedFile) return;
                    if (selectedFile.size > 20 * 1024 * 1024) {
                      toast.error('حجم فایل باید کمتر از ۲۰ مگابایت باشد');
                      e.target.value = '';
                      return;
                    }
                    if (files.length >= 10) {
                      toast.error('حداکثر ۱۰ فایل مجاز است');
                      e.target.value = '';
                      return;
                    }
                    setFiles(prev => [...prev, selectedFile]);
                    e.target.value = '';
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs">
                      <span>📎 {f.name.length > 20 ? f.name.substring(0, 20) + '...' : f.name}</span>
                      <span className="text-blue-400">({(f.size / 1024 / 1024).toFixed(1)}MB)</span>
                      <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 mr-1 font-bold">×</button>
                    </div>
                  ))}
                  {files.length < 10 && (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-8 h-8 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors text-lg font-bold">+</button>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{files.length}/10 فایل انتخاب شده</p>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold">ثبت نامه</button>
                <button type="button" onClick={() => { setShowForm(false); setFiles([]); setNextNumber(''); }} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSendManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-bold mb-2">ارسال به مدیر</h3>
            <p className="text-sm text-gray-500 mb-6">مدیر(ان) مورد نظر را انتخاب کنید</p>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {managers.map(m => (
                <label key={m.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl cursor-pointer border border-transparent hover:border-gray-200 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedManagers.includes(m.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedManagers([...selectedManagers, m.id]);
                      else setSelectedManagers(selectedManagers.filter(id => id !== m.id));
                    }}
                    className="w-4 h-4 rounded"
                  />
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">{m.full_name.charAt(0)}</div>
                  <span className="text-sm font-medium">{m.full_name}</span>
                </label>
              ))}
            </div>
            <div>
              <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="توضیحات (اختیاری)" className="w-full px-4 py-2 border rounded-xl text-sm mb-4" />
            </div>
            <div className="flex gap-4">
              <button onClick={() => sendToManager(showSendManager)} className="flex-1 bg-yellow-500 text-white py-3 rounded-xl font-bold">ارسال به مدیر</button>
              <button onClick={() => { setShowSendManager(null); setSelectedManagers([]); setComment(''); }} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
            </div>
          </div>
        </div>
      )}

      {showForward && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-bold mb-4">ارجاع به واحدها</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto mb-6">
              {departments.map(d => (
                <label key={d.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={selectedUnits.includes(d.id)} onChange={(e) => {
                    if (e.target.checked) setSelectedUnits([...selectedUnits, d.id]);
                    else setSelectedUnits(selectedUnits.filter(id => id !== d.id));
                  }} className="w-4 h-4" />
                  <span className="text-sm">{d.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={() => forwardLetter(showForward)} className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold">ارجاع</button>
              <button onClick={() => { setShowForward(null); setSelectedUnits([]); }} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg animate-fade-in max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6">روند چرخش نامه</h3>
            {historyData.length === 0 ? (
              <p className="text-center text-gray-400 py-4">تاریخچه‌ای ثبت نشده</p>
            ) : (
              <div className="relative">
                <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                <div className="space-y-4">
                  {historyData.map((h, i) => {
                    const act = historyActions[h.action] || { text: h.action, color: 'bg-gray-400' };
                    return (
                      <div key={h.id} className="flex gap-4 relative">
                        <div className={`w-8 h-8 ${act.color} text-white rounded-full flex items-center justify-center text-xs font-bold z-10 shrink-0`}>
                          {i + 1}
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium text-white ${act.color}`}>{act.text}</span>
                            <span className="text-[10px] text-gray-400">{h.created_at?.replace('T', ' ').substring(0, 16)}</span>
                          </div>
                          <p className="text-xs font-medium text-gray-700">{h.user_name}</p>
                          {h.comment && <p className="text-xs text-gray-500 mt-1">{h.comment}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex justify-end mt-6">
              <button onClick={() => { setShowHistory(null); setHistoryData([]); }} className="bg-gray-200 hover:bg-gray-300 px-6 py-2 rounded-xl font-bold transition-colors">بستن</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setLetterSearch(''); }} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t.id ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label || t.return}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        {/* نامه‌های من */}
        {tab === 'my' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4 gap-3">
              <div className="flex items-center gap-3 flex-1">
                <p className="text-sm text-gray-500 whitespace-nowrap">{filteredMy.length} نامه</p>
                <input
                  type="text"
                  value={letterSearch}
                  onChange={(e) => setLetterSearch(e.target.value)}
                  placeholder="جستجو بر اساس شماره یا موضوع..."
                  className="flex-1 max-w-xs px-4 py-2 border rounded-xl text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => printTable('نامه‌های من', [
                  { key: 'letter_number', label: 'شماره' },
                  { key: 'subject', label: 'موضوع' },
{ key: 'priority', label: 'اولویت', render: (v) => ({priority_1:'اولویت 1',priority_2:'اولویت 2',priority_3:'اولویت 3'}[v] || v) },
                  { key: 'status', label: 'وضعیت', render: (v) => ({pending_central:'در انتظار سانترال',pending_manager:'در انتظار مدیر',approved:'تایید شده',rejected:'رد شده',archived:'بایگانی شده',forwarded:'ارجاع شده'}[v] || v) },
                  { key: 'created_at', label: 'تاریخ', render: (v) => toJalaliDateTime(v) },
                ], filteredMy)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                  چاپ لیست
                </button>
                <button onClick={() => { setShowForm(true); fetchNextNumber(); }} className="bg-primary-500 hover:bg-primary-600 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors">+ نامه جدید</button>
              </div>
            </div>
            {myLetters.length === 0 && <p className="text-center text-gray-400 py-8">نامه‌ای ثبت نشده</p>}
            {myLetters.map(l => (
              <div key={l.id} className="border rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityMap[l.priority]?.color}`}>{priorityMap[l.priority]?.text}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[l.status]?.color}`}>{statusMap[l.status]?.text}</span>
                    </div>
                    <h4 className="font-bold text-sm">{l.subject}</h4>
                    <p className="text-xs text-gray-500 mt-1">شماره: {l.letter_number || '-'} | {toJalaliDateTime(l.created_at)}</p>
                    {l.body && <HtmlContent html={l.body} className="text-xs text-gray-500 mt-1.5 line-clamp-2" />}
                    {l.manager_name && <p className="text-xs text-gray-400 mt-0.5">مدیر: {l.manager_name}</p>}
                    {l.manager_comment && (
                      <p className={`text-xs mt-1 p-2 rounded-lg ${l.status === 'rejected' ? 'bg-red-50 text-red-700 font-medium border border-red-100' : 'bg-blue-50 text-blue-700'}`}>
                        {l.status === 'rejected' ? 'علت رد: ' : 'توضیح مدیر: '}{l.manager_comment}
                      </p>
                    )}
                    {l.attachments && l.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {l.attachments.map((att, idx) => (
                          <FileBadge key={idx} name={att.name} link={att.path} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => printLetter(l)} className="text-gray-400 hover:text-primary-500 p-2 rounded-lg hover:bg-primary-50 transition-colors" title="چاپ نامه">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    </button>
                    <button onClick={() => viewHistory(l.id)} className="text-gray-400 hover:text-primary-500 p-2 rounded-lg hover:bg-primary-50 transition-colors" title="روند چرخش">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* نامه‌های واحد */}
        {tab === 'unit' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4 gap-3">
              <div className="flex items-center gap-3 flex-1">
                <p className="text-sm text-gray-500 whitespace-nowrap">{filteredUnit.length} نامه</p>
                <input
                  type="text"
                  value={letterSearch}
                  onChange={(e) => setLetterSearch(e.target.value)}
                  placeholder="جستجو بر اساس شماره یا موضوع..."
                  className="flex-1 max-w-xs px-4 py-2 border rounded-xl text-sm"
                />
              </div>
            </div>
            {filteredUnit.length === 0 && <p className="text-center text-gray-400 py-8">نامه‌ای ارجاع نشده</p>}
            {filteredUnit.map(lu => (
              <div key={lu.id} className="border rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityMap[lu.priority]?.color}`}>{priorityMap[lu.priority]?.text}</span>
                      {lu.status === 'pending' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">جدید</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">رویت شده</span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm">{lu.subject}</h4>
                    <p className="text-xs text-gray-500 mt-1">شماره: {lu.letter_number || '-'} | از: {lu.sender_unit_name}</p>
                    {lu.body && <HtmlContent html={lu.body} className="text-xs text-gray-500 mt-1.5 line-clamp-2" />}
                    {lu.attachments && lu.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {lu.attachments.map((att, idx) => (
                          <FileBadge key={idx} name={att.name} link={att.path} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {lu.status === 'pending' && (
                      <button onClick={() => seenUnit(lu.letter_id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm">رویت شد</button>
                    )}
                    {lu.status === 'seen' && <span className="text-green-500 text-sm font-medium">✓ رویت شده</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* سانترال - در انتظار */}
        {tab === 'central' && (
          <div className="space-y-3">
            {pendingCentral.length === 0 && <p className="text-center text-gray-400 py-8">نامه‌ای در انتظار نیست</p>}
            {pendingCentral.map(l => (
              <div key={l.id} className="border rounded-xl p-4 bg-blue-50/30">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityMap[l.priority]?.color}`}>{priorityMap[l.priority]?.text}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">منتظر ارسال به مدیر</span>
                    </div>
                    <h4 className="font-bold text-sm">{l.subject}</h4>
                    <p className="text-xs text-gray-500 mt-1">فرستنده: {l.sender_name} ({l.sender_unit_name})</p>
                    {l.body && <HtmlContent html={l.body} className="text-xs text-gray-500 mt-1.5 line-clamp-2" />}
                    {l.attachments && l.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {l.attachments.map((att, idx) => (
                          <FileBadge key={idx} name={att.name} link={att.path} />
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowSendManager(l.id)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                    ارسال به مدیر
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* سانترال - برگشتی از مدیر */}
        {tab === 'returned' && (
          <div className="space-y-3">
            {returnedCentral.length === 0 && <p className="text-center text-gray-400 py-8">نامه‌ای برگشتی نیست</p>}
            {returnedCentral.map(l => (
              <div key={l.id} className={`border rounded-xl p-4 ${l.status === 'approved' ? 'bg-green-50/30 border-green-200' : 'bg-red-50/30 border-red-200'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[l.status]?.color}`}>{statusMap[l.status]?.text}</span>
                      {l.manager_name && <span className="text-xs text-gray-500">مدیر: {l.manager_name}</span>}
                    </div>
                    <h4 className="font-bold text-sm">{l.subject}</h4>
                    <p className="text-xs text-gray-500 mt-1">فرستنده: {l.sender_name} ({l.sender_unit_name})</p>
                    {l.manager_comment && <p className="text-xs text-blue-600 mt-1">نظر مدیر: {l.manager_comment}</p>}
                  </div>
                  <div className="flex gap-2">
                    {l.status === 'approved' && (
                      <>
                        <button onClick={() => archiveLetter(l.id)} className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">بایگانی</button>
                        <button onClick={() => setShowForward(l.id)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">ارجاع</button>
                      </>
                    )}
                    <button onClick={() => printLetter(l)} className="text-gray-400 hover:text-primary-500 p-2 rounded-lg hover:bg-gray-100 transition-colors" title="چاپ">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    </button>
                    <button onClick={() => viewHistory(l.id)} className="text-gray-400 hover:text-primary-500 p-2 rounded-lg hover:bg-gray-100 transition-colors" title="روند">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* مدیر - در انتظار */}
        {tab === 'manager' && (
          <div className="space-y-3">
            {pendingManager.length === 0 && <p className="text-center text-gray-400 py-8">نامه‌ای در انتظار بررسی نیست</p>}
            {pendingManager.map(l => (
              <div key={l.id} className="border rounded-xl p-4 bg-yellow-50/30">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityMap[l.priority]?.color}`}>{priorityMap[l.priority]?.text}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">منتظر بررسی</span>
                    </div>
                    <h4 className="font-bold text-sm">{l.subject}</h4>
                    <p className="text-xs text-gray-500 mt-1">شماره: {l.letter_number || '-'} | فرستنده: {l.sender_name} ({l.sender_unit_name})</p>
                    {l.body && (
                      <div className="mt-3 p-3 bg-white/80 rounded-xl border border-yellow-100/80">
                        <HtmlContent html={l.body} className="text-sm" />
                      </div>
                    )}
                    {l.central_comment && (
                      <p className="text-xs text-amber-800 mt-2 bg-amber-50 p-2 rounded-lg border border-amber-100 font-medium">
                        توضیحات دبیرخانه: {l.central_comment}
                      </p>
                    )}
                    {l.attachments && l.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {l.attachments.map((att, idx) => (
                          <FileBadge key={idx} name={att.name} link={att.path} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 mt-4 pt-4 border-t">
                  <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="توضیحات..." className="flex-1 px-4 py-2 border rounded-xl text-sm" />
                  <button onClick={() => approveLetter(l.id)} className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors">تایید</button>
                  <button onClick={() => rejectLetter(l.id)} className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors">رد</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* مدیر - اقدام شده */}
        {tab === 'manager_processed' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center mb-4 gap-3">
              <div className="flex items-center gap-3 flex-1">
                <p className="text-sm text-gray-500 whitespace-nowrap">{filteredProcessedManager.length} نامه اقدام شده</p>
                <input
                  type="text"
                  value={letterSearch}
                  onChange={(e) => setLetterSearch(e.target.value)}
                  placeholder="جستجو بر اساس شماره یا موضوع..."
                  className="flex-1 max-w-xs px-4 py-2 border rounded-xl text-sm"
                />
              </div>
            </div>
            {filteredProcessedManager.length === 0 && <p className="text-center text-gray-400 py-8">نامه‌ای یافت نشد</p>}
            {filteredProcessedManager.map(l => (
              <div key={l.id} className={`border rounded-xl p-4 ${l.status === 'approved' ? 'bg-green-50/20 border-green-200' : 'bg-red-50/20 border-red-200'}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityMap[l.priority]?.color}`}>{priorityMap[l.priority]?.text}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[l.status]?.color}`}>{statusMap[l.status]?.text}</span>
                    </div>
                    <h4 className="font-bold text-sm">{l.subject}</h4>
                    <p className="text-xs text-gray-500 mt-1">شماره: {l.letter_number || '-'} | فرستنده: {l.sender_name} ({l.sender_unit_name})</p>
                    {l.body && (
                      <div className="mt-3 p-3 bg-white/80 rounded-xl border border-gray-100">
                        <HtmlContent html={l.body} className="text-sm" />
                      </div>
                    )}
                    {l.central_comment && (
                      <p className="text-xs text-amber-800 mt-2 bg-amber-50 p-2 rounded-lg border border-amber-100 font-medium">
                        توضیحات دبیرخانه: {l.central_comment}
                      </p>
                    )}
                    {l.manager_comment && (
                      <p className={`text-xs mt-2 p-2 rounded-lg ${l.status === 'rejected' ? 'bg-red-50 text-red-700 font-medium border border-red-100' : 'bg-blue-50 text-blue-700'}`}>
                        {l.status === 'rejected' ? 'علت رد: ' : 'توضیحات من: '}{l.manager_comment}
                      </p>
                    )}
                    {l.attachments && l.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {l.attachments.map((att, idx) => (
                          <FileBadge key={idx} name={att.name} link={att.path} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => printLetter(l)} className="text-gray-400 hover:text-primary-500 p-2 rounded-lg hover:bg-gray-100 transition-colors" title="چاپ">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    </button>
                    <button onClick={() => viewHistory(l.id)} className="text-gray-400 hover:text-primary-500 p-2 rounded-lg hover:bg-gray-100 transition-colors" title="روند چرخش">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

         {/* بایگانی */}
         {tab === 'archived' && (
           <div className="space-y-3">
             <div className="flex justify-between items-center mb-2 gap-3">
               <div className="flex items-center gap-3 flex-1">
                 <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium whitespace-nowrap">{filteredArchived.length} نامه بایگانی شده</span>
                 <input
                   type="text"
                   value={letterSearch}
                   onChange={(e) => setLetterSearch(e.target.value)}
                   placeholder="جستجو بر اساس شماره نامه..."
                   className="flex-1 max-w-xs px-4 py-2 border rounded-xl text-sm"
                   dir="ltr"
                 />
               </div>
               <button onClick={() => printTable('نامه‌های بایگانی شده', [
                 { key: 'letter_number', label: 'شماره' },
                 { key: 'subject', label: 'موضوع' },
                 { key: 'sender_name', label: 'فرستنده' },
                 { key: 'sender_unit_name', label: 'واحد فرستنده' },
                 { key: 'manager_name', label: 'مدیر' },
                 { key: 'priority', label: 'اولویت', render: (v) => ({priority_1:'اولویت 1',priority_2:'اولویت 2',priority_3:'اولویت 3'}[v] || v) },
                 { key: 'status', label: 'وضعیت', render: (v) => ({archived:'بایگانی شده',forwarded:'ارجاع شده'}[v] || v) },
{ key: 'created_at', label: 'تاریخ', render: (v) => toJalaliDateTime(v) },
                ], filteredArchived)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                 چاپ
               </button>
             </div>
             {filteredArchived.length === 0 && <p className="text-center text-gray-400 py-8">نامه بایگانی شده‌ای یافت نشد</p>}
             {filteredArchived.map(l => (
              <div key={l.id} className="border rounded-xl p-4 bg-purple-50/30 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityMap[l.priority]?.color}`}>{priorityMap[l.priority]?.text}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[l.status]?.color}`}>{statusMap[l.status]?.text}</span>
                    </div>
                    <h4 className="font-bold text-sm">{l.subject}</h4>
                    <p className="text-xs text-gray-500 mt-1">شماره: {l.letter_number || '-'} | فرستنده: {l.sender_name} ({l.sender_unit_name})</p>
                    {l.manager_name && <p className="text-xs text-gray-400 mt-0.5">مدیر: {l.manager_name} | {l.manager_comment || ''}</p>}
                    {l.body && <HtmlContent html={l.body} className="text-xs text-gray-500 mt-1.5 line-clamp-2" />}
                    {l.attachments && l.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {l.attachments.map((att, idx) => (
                          <FileBadge key={idx} name={att.name} link={att.path} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 items-start">
                    <button onClick={() => setShowForward(l.id)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">ارجاع به واحدها</button>
                    <button onClick={() => printLetter(l)} className="text-gray-400 hover:text-primary-500 p-2 rounded-lg hover:bg-gray-100 transition-colors" title="چاپ">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    </button>
                    <button onClick={() => viewHistory(l.id)} className="text-gray-400 hover:text-primary-500 p-2 rounded-lg hover:bg-gray-100 transition-colors" title="روند چرخش">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* همه نامه‌ها */}
        {tab === 'all' && (
          <div>
            <div className="flex justify-between items-center mb-4 gap-3">
              <div className="flex items-center gap-3 flex-1">
                <input
                  type="text"
                  value={allLettersSearch}
                  onChange={(e) => setAllLettersSearch(e.target.value)}
                  placeholder="جستجو شماره نامه..."
                  className="flex-1 max-w-xs px-4 py-2 border rounded-xl text-sm"
                  dir="ltr"
                />
                <p className="text-sm text-gray-500 whitespace-nowrap">{allLettersTotal} نامه</p>
              </div>
              <button onClick={() => printTable('همه نامه‌ها', [
                { key: 'letter_number', label: 'شماره' },
                { key: 'subject', label: 'موضوع' },
                { key: 'sender_name', label: 'فرستنده' },
                { key: 'manager_name', label: 'مدیر' },
                { key: 'priority', label: 'اولویت', render: (v) => ({priority_1:'اولویت 1',priority_2:'اولویت 2',priority_3:'اولویت 3'}[v] || v) },
                { key: 'status', label: 'وضعیت', render: (v) => ({pending_central:'در انتظار سانترال',pending_manager:'در انتظار مدیر',approved:'تایید شده',rejected:'رد شده',archived:'بایگانی شده',forwarded:'ارجاع شده'}[v] || v) },
                { key: 'created_at', label: 'تاریخ', render: (v) => toJalaliDateTime(v) },
              ], filteredAll)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                چاپ لیست
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-right">شماره</th>
                    <th className="p-3 text-right">موضوع</th>
                    <th className="p-3 text-right">فرستنده</th>
                    <th className="p-3 text-right">مدیر</th>
                    <th className="p-3 text-right">اولویت</th>
                    <th className="p-3 text-right">وضعیت</th>
                    <th className="p-3 text-right">تاریخ</th>
                    <th className="p-3 text-center">چاپ</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAll.map(l => (
                    <tr key={l.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 text-xs" dir="ltr">{l.letter_number || '-'}</td>
                      <td className="p-3 font-medium cursor-pointer" onClick={() => viewHistory(l.id)}>{l.subject}</td>
                      <td className="p-3 cursor-pointer" onClick={() => viewHistory(l.id)}>{l.sender_name}</td>
                      <td className="p-3 text-xs cursor-pointer" onClick={() => viewHistory(l.id)}>{l.manager_name || '-'}</td>
                      <td className="p-3 cursor-pointer" onClick={() => viewHistory(l.id)}><span className={`px-2 py-1 rounded text-xs ${priorityMap[l.priority]?.color}`}>{priorityMap[l.priority]?.text}</span></td>
                      <td className="p-3 cursor-pointer" onClick={() => viewHistory(l.id)}><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusMap[l.status]?.color}`}>{statusMap[l.status]?.text}</span></td>
                      <td className="p-3 text-xs text-gray-500 cursor-pointer" onClick={() => viewHistory(l.id)}>{toJalaliDateTime(l.created_at)}</td>
                      <td className="p-3 text-center">
                        <button onClick={(e) => { e.stopPropagation(); printLetter(l); }} className="text-gray-400 hover:text-primary-500 p-1.5 rounded-lg hover:bg-gray-100 transition-colors" title="چاپ نامه">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={allLettersPage} total={allLettersTotal} limit={50} onChange={setAllLettersPage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
