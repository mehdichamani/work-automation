import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import moment from 'moment-jalaali';
import toast from 'react-hot-toast';

const CONTENT_TYPE_CONFIG = {
  pdf: { label: 'کتابچه / PDF', icon: '📄', color: 'bg-rose-50 text-rose-600 border-rose-200' },
  video: { label: 'فیلم و ویدیو', icon: '🎬', color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  audio: { label: 'صوت / پادکست', icon: '🎵', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  article: { label: 'راهنما و مقاله متنی', icon: '📝', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  embed: { label: 'امبد / پخش‌کننده آنلاین', icon: '🌐', color: 'bg-sky-50 text-sky-600 border-sky-200' },
};

const DIFFICULTY_OPTIONS = [
  { value: 'all', label: 'عمومی (همه سطوح)' },
  { value: 'beginner', label: 'مقدماتی' },
  { value: 'intermediate', label: 'متوسط' },
  { value: 'advanced', label: 'پیشرفته' },
];

const TARGET_AUDIENCE_OPTIONS = [
  { value: 'all', label: 'عمومی (همه کاربران)' },
  { value: 'manager', label: 'فقط مدیران' },
  { value: 'supervisor', label: 'سرپرستان و مدیران' },
];

const PRESET_ICONS = ['📁', '📘', '💻', '📊', '🛡️', '⚙️', '🧪', '🏢', '📦', '🎓', '🚀', '🛠️', '💡', '📑'];
const PRESET_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];

export default function EducationalManager() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('materials'); // 'materials' | 'categories'

  // Data States
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter States for Materials
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');

  // Material Form States
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [materialForm, setMaterialForm] = useState({
    title: '',
    description: '',
    category_id: '',
    content_type: 'video',
    media_source: 'upload',
    external_url: '',
    content_text: '',
    embed_code: '',
    duration_minutes: '',
    difficulty: 'all',
    target_audience: 'all',
    target_department_id: '',
    is_pinned: false,
    tags: '',
    is_active: true,
    file: null,
    thumbnail: null,
    attachments: [],
  });
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Category Form States
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    title: '',
    description: '',
    icon: '📁',
    color: '#3B82F6',
    order_index: 0,
    is_active: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catsRes, matsRes, deptsRes] = await Promise.all([
        api.get('/educational/categories'),
        api.get('/educational'),
        api.get('/departments').catch(() => ({ data: [] })),
      ]);
      setCategories(catsRes.data);
      setMaterials(matsRes.data);
      setDepartments(deptsRes.data || []);
    } catch (err) {
      toast.error('خطا در دریافت اطلاعات آموزشی');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ==========================================
  // MATERIAL HANDLERS
  // ==========================================
  const openAddMaterial = () => {
    setEditingMaterialId(null);
    setExistingAttachments([]);
    setMaterialForm({
      title: '',
      description: '',
      category_id: categories.length > 0 ? categories[0].id : '',
      content_type: 'video',
      media_source: 'upload',
      external_url: '',
      content_text: '',
      embed_code: '',
      duration_minutes: '',
      difficulty: 'all',
      target_audience: 'all',
      target_department_id: '',
      is_pinned: false,
      tags: '',
      is_active: true,
      file: null,
      thumbnail: null,
      attachments: [],
    });
    setShowMaterialModal(true);
  };

  const openEditMaterial = (item) => {
    setEditingMaterialId(item.id);
    setExistingAttachments(item.attachments || []);
    setMaterialForm({
      title: item.title,
      description: item.description || '',
      category_id: item.category_id || '',
      content_type: item.content_type || 'pdf',
      media_source: item.media_source || 'upload',
      external_url: item.media_source === 'external_url' ? (item.file_url || '') : '',
      content_text: item.content_text || '',
      embed_code: item.embed_code || '',
      duration_minutes: item.duration_minutes || '',
      difficulty: item.difficulty || 'all',
      target_audience: item.target_audience || 'all',
      target_department_id: item.target_department_id || '',
      is_pinned: !!item.is_pinned,
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : (item.tags || ''),
      is_active: !!item.is_active,
      file: null,
      thumbnail: null,
      attachments: [],
    });
    setShowMaterialModal(true);
  };

  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    if (!materialForm.title.trim()) {
      toast.error('عنوان آموزش الزامی است');
      return;
    }

    setFormSubmitting(true);
    const data = new FormData();
    data.append('title', materialForm.title.trim());
    data.append('description', materialForm.description || '');
    if (materialForm.category_id) data.append('category_id', materialForm.category_id);
    data.append('content_type', materialForm.content_type);
    data.append('media_source', materialForm.media_source);
    if (materialForm.external_url) data.append('external_url', materialForm.external_url);
    if (materialForm.content_text) data.append('content_text', materialForm.content_text);
    if (materialForm.embed_code) data.append('embed_code', materialForm.embed_code);
    if (materialForm.duration_minutes) data.append('duration_minutes', materialForm.duration_minutes);
    data.append('difficulty', materialForm.difficulty);
    data.append('target_audience', materialForm.target_audience);
    if (materialForm.target_department_id) data.append('target_department_id', materialForm.target_department_id);
    data.append('is_pinned', materialForm.is_pinned);
    data.append('is_active', materialForm.is_active);
    if (materialForm.tags) data.append('tags', materialForm.tags);

    if (materialForm.file) data.append('file', materialForm.file);
    if (materialForm.thumbnail) data.append('thumbnail', materialForm.thumbnail);
    if (materialForm.attachments && materialForm.attachments.length > 0) {
      for (let i = 0; i < materialForm.attachments.length; i++) {
        data.append('attachments', materialForm.attachments[i]);
      }
    }

    try {
      if (editingMaterialId) {
        await api.put(`/educational/${editingMaterialId}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('محتوای آموزشی با موفقیت ویرایش شد');
      } else {
        await api.post('/educational', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('محتوای آموزشی جدید با موفقیت ذخیره شد');
      }
      setShowMaterialModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ذخیره سازی محتوا');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (id, title) => {
    if (!window.confirm(`آیا از حذف "${title}" مطمئن هستید؟`)) return;
    try {
      await api.delete(`/educational/${id}`);
      toast.success('محتوای آموزشی حذف شد');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در حذف');
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('آیا از حذف این فایل پیوست اطمینان دارید؟')) return;
    try {
      await api.delete(`/educational/attachments/${attachmentId}`);
      setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId));
      toast.success('فایل پیوست حذف شد');
    } catch (err) {
      toast.error('خطا در حذف فایل پیوست');
    }
  };

  const handleToggleMaterialStatus = async (item) => {
    try {
      await api.put(`/educational/${item.id}`, { is_active: !item.is_active });
      toast.success('وضعیت تغییر یافت');
      setMaterials(prev => prev.map(m => m.id === item.id ? { ...m, is_active: !item.is_active } : m));
    } catch (err) {
      toast.error('خطا در تغییر وضعیت');
    }
  };

  // ==========================================
  // CATEGORY HANDLERS
  // ==========================================
  const openAddCategory = () => {
    setEditingCategoryId(null);
    setCategoryForm({
      title: '',
      description: '',
      icon: '📁',
      color: '#3B82F6',
      order_index: categories.length + 1,
      is_active: true,
    });
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat) => {
    setEditingCategoryId(cat.id);
    setCategoryForm({
      title: cat.title,
      description: cat.description || '',
      icon: cat.icon || '📁',
      color: cat.color || '#3B82F6',
      order_index: cat.order_index !== undefined ? cat.order_index : 0,
      is_active: !!cat.is_active,
    });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryForm.title.trim()) {
      toast.error('عنوان دسته‌بندی الزامی است');
      return;
    }

    try {
      if (editingCategoryId) {
        await api.put(`/educational/categories/${editingCategoryId}`, categoryForm);
        toast.success('دسته‌بندی با موفقیت ویرایش شد');
      } else {
        await api.post('/educational/categories', categoryForm);
        toast.success('دسته‌بندی جدید با موفقیت اضافه شد');
      }
      setShowCategoryModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ثبت دسته‌بندی');
    }
  };

  const handleDeleteCategory = async (id, title) => {
    if (!window.confirm(`آیا از حذف دسته‌بندی "${title}" اطمینان دارید؟`)) return;
    try {
      await api.delete(`/educational/categories/${id}`);
      toast.success('دسته‌بندی حذف شد');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در حذف دسته‌بندی');
    }
  };

  // Filter materials for view
  const filteredMaterials = materials.filter(m => {
    if (selectedCategoryFilter !== 'all' && String(m.category_id) !== String(selectedCategoryFilter)) {
      return false;
    }
    if (selectedTypeFilter !== 'all' && m.content_type !== selectedTypeFilter) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = m.title?.toLowerCase().includes(q);
      const matchDesc = m.description?.toLowerCase().includes(q);
      const matchTags = Array.isArray(m.tags) ? m.tags.some(t => t.toLowerCase().includes(q)) : false;
      if (!matchTitle && !matchDesc && !matchTags) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl p-2.5 bg-blue-50 text-blue-600 rounded-2xl">📚</span>
            <div>
              <h1 className="text-2xl font-black text-slate-800">مدیریت مرکز آموزش و یادگیری</h1>
              <p className="text-sm text-slate-500 mt-0.5">افزودن و ساماندهی دوره‌ها، فایل‌ها، مقالات و دسته‌بندی‌های سازمانی</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate('/learning')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
          >
            <span>👁️</span>
            <span>مشاهده پرتال آموزش</span>
          </button>
          {activeTab === 'materials' ? (
            <button
              onClick={openAddMaterial}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all"
            >
              <span>+</span>
              <span>افزودن محتوای جدید</span>
            </button>
          ) : (
            <button
              onClick={openAddCategory}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all"
            >
              <span>+</span>
              <span>افزودن دسته‌بندی جدید</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-200/70 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'materials'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>📑</span>
          <span>محتواها و دوره‌ها ({materials.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'categories'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>🏷️</span>
          <span>دسته‌بندی‌های موضوعی ({categories.length})</span>
        </button>
      </div>

      {/* Tab 1: Materials Management */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 جستجو بر اساس عنوان، توضیحات یا برچسب..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              />
            </div>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">همه دسته‌ها</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
              ))}
            </select>
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">همه انواع رسانه</option>
              {Object.entries(CONTENT_TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>

          {/* Materials Table */}
          {loading ? (
            <div className="bg-white rounded-3xl p-16 text-center text-slate-400">
              <div className="animate-spin text-3xl mb-2">⏳</div>
              <p>در حال بارگذاری اطلاعات...</p>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="bg-white rounded-3xl p-16 text-center text-slate-400 border border-slate-100">
              <p className="text-5xl mb-3">📭</p>
              <p className="text-base font-bold text-slate-600">هیچ محتوای آموزشی یافت نشد</p>
              <p className="text-xs text-slate-400 mt-1">با کلیک روی دکمه افزودن، اولین دوره یا فایل آموزشی را ایجاد نمایید.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-600 font-bold">
                    <tr>
                      <th className="px-5 py-4">عنوان و مشخصات</th>
                      <th className="px-4 py-4">نوع محتوا</th>
                      <th className="px-4 py-4">دسته‌بندی موضوعی</th>
                      <th className="px-4 py-4">مخاطب مجاز</th>
                      <th className="px-4 py-4">پیوست‌ها</th>
                      <th className="px-4 py-4">آمار بازدید</th>
                      <th className="px-4 py-4">وضعیت</th>
                      <th className="px-5 py-4 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMaterials.map((m) => {
                      const typeConf = CONTENT_TYPE_CONFIG[m.content_type] || CONTENT_TYPE_CONFIG.pdf;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              {m.thumbnail_url ? (
                                <img
                                  src={m.thumbnail_url}
                                  alt=""
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl border border-slate-200/60">
                                  {typeConf.icon}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  {m.is_pinned && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                      📌 پین شده
                                    </span>
                                  )}
                                  <span className="font-black text-slate-800 max-w-[280px] truncate block">
                                    {m.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                  <span>توسط: {m.uploader_name}</span>
                                  <span>•</span>
                                  <span>{moment(m.created_at).format('jYYYY/jMM/jDD')}</span>
                                  {m.duration_minutes && (
                                    <>
                                      <span>•</span>
                                      <span>⏱️ {m.duration_minutes} دقیقه</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${typeConf.color}`}>
                              <span>{typeConf.icon}</span>
                              <span>{typeConf.label}</span>
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-white shadow-sm"
                              style={{ backgroundColor: m.category_color || '#3B82F6' }}
                            >
                              <span>{m.category_icon || '📁'}</span>
                              <span>{m.category_title}</span>
                            </span>
                          </td>

                          <td className="px-4 py-4 text-xs text-slate-600">
                            <div className="space-y-0.5">
                              <div>
                                {m.target_audience === 'all' && <span className="text-slate-500">🌐 عمومی</span>}
                                {m.target_audience === 'manager' && <span className="text-purple-600 font-bold">👔 مدیران</span>}
                                {m.target_audience === 'supervisor' && <span className="text-blue-600 font-bold">📋 سرپرستان</span>}
                              </div>
                              {m.target_department_name && (
                                <div className="text-slate-400">واحد: {m.target_department_name}</div>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-xs text-slate-500">
                            {m.attachments && m.attachments.length > 0 ? (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                📎 {m.attachments.length} فایل
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          <td className="px-4 py-4 text-xs font-bold text-slate-600">
                            👁️ {m.view_count}
                          </td>

                          <td className="px-4 py-4">
                            <button
                              onClick={() => handleToggleMaterialStatus(m)}
                              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                m.is_active
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                              }`}
                            >
                              {m.is_active ? 'فعال' : 'غیرفعال'}
                            </button>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditMaterial(m)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-bold transition-all"
                                title="ویرایش"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteMaterial(m.id, m.title)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-bold transition-all"
                                title="حذف"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Categories Management */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between"
              >
                <div
                  className="absolute top-0 right-0 left-0 h-1.5"
                  style={{ backgroundColor: cat.color }}
                />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      {cat.icon}
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-bold">
                      {cat.material_count} محتوا
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-800 text-base mb-1">{cat.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                    {cat.description || 'بدون توضیحات'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400">اولویت نمایش: {cat.order_index}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditCategory(cat)}
                      className="text-blue-600 hover:underline font-bold"
                    >
                      ویرایش
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.id, cat.title)}
                      className="text-rose-600 hover:underline font-bold"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: ADD / EDIT MATERIAL
      ========================================== */}
      {showMaterialModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-scale-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📚</span>
                <h3 className="font-black text-lg text-slate-800">
                  {editingMaterialId ? 'ویرایش محتوای آموزشی' : 'افزودن محتوای آموزشی جدید'}
                </h3>
              </div>
              <button
                onClick={() => setShowMaterialModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-lg font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveMaterial} className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Row 1: Title & Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان آموزش *</label>
                  <input
                    type="text"
                    required
                    value={materialForm.title}
                    onChange={(e) => setMaterialForm({ ...materialForm, title: e.target.value })}
                    placeholder="مثال: راهنمای گام‌به‌گام ثبت درخواست مرخصی و ماموریت"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">دسته‌بندی موضوعی *</label>
                  <select
                    value={materialForm.category_id}
                    onChange={(e) => setMaterialForm({ ...materialForm, category_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">بدون دسته‌بندی</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">خلاصه و توضیحات</label>
                <textarea
                  rows={2}
                  value={materialForm.description}
                  onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                  placeholder="توضیح کوتاه درباره سرفصل‌ها و اهداف این آموزش..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Row 3: Content Type Selection */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                <label className="block text-xs font-bold text-slate-700">نوع محتوا و شیوه نمایش</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {Object.entries(CONTENT_TYPE_CONFIG).map(([k, v]) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => setMaterialForm({ ...materialForm, content_type: k })}
                      className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                        materialForm.content_type === k
                          ? 'bg-white border-blue-600 ring-2 ring-blue-500 shadow-sm'
                          : 'bg-white/60 border-slate-200 hover:bg-white text-slate-600'
                      }`}
                    >
                      <span className="text-2xl">{v.icon}</span>
                      <span className="text-xs font-bold">{v.label}</span>
                    </button>
                  ))}
                </div>

                {/* Source Selection for Media */}
                {['video', 'pdf', 'audio'].includes(materialForm.content_type) && (
                  <div className="pt-2 border-t border-slate-200/70">
                    <div className="flex gap-4 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                        <input
                          type="radio"
                          name="media_source"
                          checked={materialForm.media_source === 'upload'}
                          onChange={() => setMaterialForm({ ...materialForm, media_source: 'upload' })}
                          className="text-blue-600"
                        />
                        <span>آپلود فایل روی سرور</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                        <input
                          type="radio"
                          name="media_source"
                          checked={materialForm.media_source === 'external_url'}
                          onChange={() => setMaterialForm({ ...materialForm, media_source: 'external_url' })}
                          className="text-blue-600"
                        />
                        <span>لینک مستقیم اینترنتی (هاست/سایت دیگر)</span>
                      </label>
                    </div>

                    {materialForm.media_source === 'upload' ? (
                      <div>
                        <input
                          type="file"
                          onChange={(e) => setMaterialForm({ ...materialForm, file: e.target.files[0] })}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white text-xs"
                        />
                        {materialForm.file && (
                          <p className="text-xs text-emerald-600 mt-1">فایل جدید انتخاب شده: {materialForm.file.name}</p>
                        )}
                      </div>
                    ) : (
                      <input
                        type="url"
                        value={materialForm.external_url}
                        onChange={(e) => setMaterialForm({ ...materialForm, external_url: e.target.value })}
                        placeholder="https://example.com/video.mp4"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    )}
                  </div>
                )}

                {/* Article Content Text */}
                {materialForm.content_type === 'article' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">متن کامل مقاله و آموزش</label>
                    <textarea
                      rows={8}
                      value={materialForm.content_text}
                      onChange={(e) => setMaterialForm({ ...materialForm, content_text: e.target.value })}
                      placeholder="متن کامل آموزش، مراحل و راهنما را در اینجا بنویسید..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none font-sans"
                    />
                  </div>
                )}

                {/* Embed Code */}
                {materialForm.content_type === 'embed' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">کد امبد (Iframe یا اسکریپت آپارات و...)</label>
                    <textarea
                      rows={3}
                      dir="ltr"
                      value={materialForm.embed_code}
                      onChange={(e) => setMaterialForm({ ...materialForm, embed_code: e.target.value })}
                      placeholder='<iframe src="https://www.aparat.com/video/video/embed/videohash/..." ...></iframe>'
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-mono bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Row 4: Cover Image & Supplementary Attachments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">تصویر کاور / Thumbnail</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setMaterialForm({ ...materialForm, thumbnail: e.target.files[0] })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white text-xs"
                  />
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">فایل‌های پیوست ضمیمه (اکسل، تمرین، نمونه و...)</label>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setMaterialForm({ ...materialForm, attachments: Array.from(e.target.files) })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl bg-white text-xs"
                  />
                  {/* Existing attachments */}
                  {existingAttachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-bold text-slate-500">پیوست‌های فعلی:</p>
                      {existingAttachments.map(att => (
                        <div key={att.id} className="flex items-center justify-between text-xs bg-white p-1.5 rounded-lg border border-slate-200">
                          <span className="truncate max-w-[200px]">{att.title}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            className="text-rose-600 font-bold hover:underline"
                          >
                            حذف
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 5: Details (Duration, Difficulty, Audience, Target Department, Tags) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">مدت زمان (دقیقه)</label>
                  <input
                    type="number"
                    min="1"
                    value={materialForm.duration_minutes}
                    onChange={(e) => setMaterialForm({ ...materialForm, duration_minutes: e.target.value })}
                    placeholder="مثال: 15"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">سطح دشواری</label>
                  <select
                    value={materialForm.difficulty}
                    onChange={(e) => setMaterialForm({ ...materialForm, difficulty: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {DIFFICULTY_OPTIONS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">مخاطب سازمانی</label>
                  <select
                    value={materialForm.target_audience}
                    onChange={(e) => setMaterialForm({ ...materialForm, target_audience: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {TARGET_AUDIENCE_OPTIONS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">واحد سازمانی مجاز</label>
                  <select
                    value={materialForm.target_department_id}
                    onChange={(e) => setMaterialForm({ ...materialForm, target_department_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">همه واحدها</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 6: Tags & Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">برچسب‌ها (با کاما جدا کنید)</label>
                  <input
                    type="text"
                    value={materialForm.tags}
                    onChange={(e) => setMaterialForm({ ...materialForm, tags: e.target.value })}
                    placeholder="اتوماسیون, مرخصی, حقوق, منابع انسانی"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-6 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={materialForm.is_pinned}
                      onChange={(e) => setMaterialForm({ ...materialForm, is_pinned: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span>📌 پین در بالای لیست آموزش‌ها</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={materialForm.is_active}
                      onChange={(e) => setMaterialForm({ ...materialForm, is_active: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span>وضعیت فعال و قابل رویت</span>
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  {formSubmitting ? 'در حال ذخیره‌سازی...' : (editingMaterialId ? 'ذخیره تغییرات' : 'افزودن محتوا')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: ADD / EDIT CATEGORY
      ========================================== */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-black text-lg text-slate-800">
                {editingCategoryId ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی جدید'}
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-lg font-bold transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان دسته‌بندی *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.title}
                  onChange={(e) => setCategoryForm({ ...categoryForm, title: e.target.value })}
                  placeholder="مثال: امور مالی و حسابداری"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">توضیحات دسته‌بندی</label>
                <textarea
                  rows={2}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="توضیح کوتاه درباره محتواهای این بخش..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">آیکون دسته‌بندی</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PRESET_ICONS.map(ic => (
                    <button
                      type="button"
                      key={ic}
                      onClick={() => setCategoryForm({ ...categoryForm, icon: ic })}
                      className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all ${
                        categoryForm.icon === ic
                          ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-400'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">رنگ شاخص</label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setCategoryForm({ ...categoryForm, color: c })}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        categoryForm.color === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ترتیب اولویت نمایش</label>
                <input
                  type="number"
                  value={categoryForm.order_index}
                  onChange={(e) => setCategoryForm({ ...categoryForm, order_index: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all"
                >
                  {editingCategoryId ? 'ذخیره تغییرات' : 'ایجاد دسته‌بندی'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}