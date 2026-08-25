import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import moment from 'moment-jalaali';
import toast from 'react-hot-toast';

const CONTENT_TYPE_CONFIG = {
  pdf: { label: 'کتابچه PDF', icon: '📄', color: 'bg-rose-50 text-rose-600 border-rose-200' },
  video: { label: 'ویدیو آموزشی', icon: '🎬', color: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  audio: { label: 'صوت / پادکست', icon: '🎵', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  article: { label: 'مقاله و راهنما', icon: '📝', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  embed: { label: 'پخش آنلاین', icon: '🌐', color: 'bg-sky-50 text-sky-600 border-sky-200' },
};

const DIFFICULTY_LABELS = {
  all: 'عمومی',
  beginner: 'مقدماتی',
  intermediate: 'متوسط',
  advanced: 'پیشرفته',
};

export default function LearningViewer() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, bookmarked: 0, progress_percentage: 0 });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [onlyCompleted, setOnlyCompleted] = useState(false);

  // Modal Viewer State
  const [activeMaterial, setActiveMaterial] = useState(null);

  const canManage = user?.role === 'admin' || hasPermission('learning_manage');

  const loadData = useCallback(async () => {
    try {
      const [catsRes, matsRes, statsRes] = await Promise.all([
        api.get('/educational/categories'),
        api.get('/educational'),
        api.get('/educational/my-stats').catch(() => ({ data: { total: 0, completed: 0, bookmarked: 0, progress_percentage: 0 } })),
      ]);
      setCategories(catsRes.data);
      setMaterials(matsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      toast.error('خطا در دریافت اطلاعات پرتال آموزش');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleBookmark = async (e, material) => {
    e.stopPropagation();
    const newStatus = !material.is_bookmarked;
    try {
      await api.post(`/educational/${material.id}/progress`, {
        is_bookmarked: newStatus,
      });
      setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, is_bookmarked: newStatus } : m));
      setStats(prev => ({
        ...prev,
        bookmarked: newStatus ? prev.bookmarked + 1 : Math.max(0, prev.bookmarked - 1)
      }));
      toast.success(newStatus ? 'به لیست نشان‌شده‌ها اضافه شد' : 'از لیست نشان‌شده‌ها حذف شد');
    } catch (err) {
      toast.error('خطا در تغییر وضعیت');
    }
  };

  const handleToggleComplete = async (e, material) => {
    e.stopPropagation();
    const newStatus = !material.is_completed;
    try {
      await api.post(`/educational/${material.id}/progress`, {
        is_completed: newStatus,
      });
      setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, is_completed: newStatus } : m));
      setStats(prev => {
        const completed = newStatus ? prev.completed + 1 : Math.max(0, prev.completed - 1);
        const progress_percentage = prev.total > 0 ? Math.round((completed / prev.total) * 100) : 0;
        return { ...prev, completed, progress_percentage };
      });
      toast.success(newStatus ? 'تبریک! این آموزش تکمیل شد 🎉' : 'وضعیت آموزش به در حال یادگیری تغییر کرد');
    } catch (err) {
      toast.error('خطا در ثبت وضعیت تکمیل');
    }
  };

  const handleOpenMaterial = async (item) => {
    setActiveMaterial(item);
    // Fetch fresh details (and increment view count on backend)
    try {
      const res = await api.get(`/educational/${item.id}`);
      setActiveMaterial(res.data);
      setMaterials(prev => prev.map(m => m.id === item.id ? { ...m, view_count: res.data.view_count } : m));
    } catch (err) {}
  };

  const filteredMaterials = materials.filter(m => {
    if (selectedCategory !== 'all' && String(m.category_id) !== String(selectedCategory)) return false;
    if (selectedType !== 'all' && m.content_type !== selectedType) return false;
    if (onlyBookmarked && !m.is_bookmarked) return false;
    if (onlyCompleted && !m.is_completed) return false;
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
      {/* Top Banner & Progress Hub */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-2xl -ml-20 -mb-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-blue-200">
              <span>🎓</span>
              <span>سامانه آموزش و ارتقای مهارت سازمانی</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              مرکز آموزش و مستندات سازمانی
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              مشاهده دوره‌ها، راهنماهای گام‌به‌گام سامانه‌ها، فیلم‌های آموزشی و مستندات تخصصی متناسب با واحد کاری شما.
            </p>
          </div>

          {/* Quick Learning Stats Card */}
          <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 min-w-[280px]">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-2xl font-black text-blue-300">
              {stats.progress_percentage}%
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-200">پیشرفت یادگیری</span>
                <span className="text-blue-300">{stats.completed} از {stats.total} دوره</span>
              </div>
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${stats.progress_percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300 pt-0.5">
                <span>⭐ {stats.bookmarked} نشان‌شده</span>
                {canManage && (
                  <button
                    onClick={() => navigate('/admin/educational')}
                    className="text-amber-300 hover:text-amber-200 font-bold underline cursor-pointer"
                  >
                    ⚙️ مدیریت آموزش
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black transition-all shrink-0 ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80'
          }`}
        >
          <span>📁</span>
          <span>همه موضوعات ({materials.length})</span>
        </button>

        {categories.map((cat) => {
          const isSelected = String(selectedCategory) === String(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                isSelected
                  ? 'text-white shadow-md scale-105 border-transparent'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200/80'
              }`}
              style={isSelected ? { backgroundColor: cat.color || '#3B82F6' } : {}}
            >
              <span>{cat.icon}</span>
              <span>{cat.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {cat.material_count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Media Type Filters */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-4">
        {/* Search */}
        <div className="flex-1 min-w-[260px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 جستجو در دوره‌ها، مقالات، فایل‌ها یا برچسب‌ها..."
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
          />
        </div>

        {/* Media Type Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedType === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            همه فرمت‌ها
          </button>
          {Object.entries(CONTENT_TYPE_CONFIG).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setSelectedType(k)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedType === k
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{v.icon}</span>
              <span>{v.label}</span>
            </button>
          ))}
        </div>

        {/* Bookmarks & Completed Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyBookmarked(!onlyBookmarked)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              onlyBookmarked
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>⭐</span>
            <span>نشان‌شده‌ها</span>
          </button>
          <button
            onClick={() => setOnlyCompleted(!onlyCompleted)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              onlyCompleted
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>✅</span>
            <span>تکمیل‌شده‌ها</span>
          </button>
        </div>
      </div>

      {/* Materials Cards Grid */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center text-slate-400">
          <div className="animate-spin text-3xl mb-2">⏳</div>
          <p>در حال بارگذاری دوره‌های آموزشی...</p>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center text-slate-400 border border-slate-100">
          <p className="text-5xl mb-3">🔍</p>
          <p className="text-base font-bold text-slate-600">موردی با فیلترهای انتخابی یافت نشد</p>
          <p className="text-xs text-slate-400 mt-1">عبارت جستجو یا دسته‌بندی را تغییر دهید.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map((material) => {
            const typeConf = CONTENT_TYPE_CONFIG[material.content_type] || CONTENT_TYPE_CONFIG.pdf;
            return (
              <div
                key={material.id}
                onClick={() => handleOpenMaterial(material)}
                className="group bg-white rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 overflow-hidden cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Card Media Header */}
                  <div className="relative h-44 bg-gradient-to-br from-slate-100 to-indigo-50/50 overflow-hidden flex items-center justify-center">
                    {material.thumbnail_url ? (
                      <img
                        src={material.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="text-6xl text-slate-300 group-hover:scale-110 transition-transform duration-500">
                        {typeConf.icon}
                      </div>
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <span
                        className="px-3 py-1 rounded-xl text-xs font-black text-white shadow-md backdrop-blur-md"
                        style={{ backgroundColor: material.category_color || '#3B82F6' }}
                      >
                        {material.category_icon || '📁'} {material.category_title}
                      </span>
                      {material.is_pinned && (
                        <span className="bg-amber-500 text-white text-xs font-black px-2 py-0.5 rounded-lg shadow-sm">
                          📌 پین شده
                        </span>
                      )}
                    </div>

                    {/* Top Left Quick Actions */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleToggleBookmark(e, material)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm backdrop-blur-md shadow-md transition-all ${
                          material.is_bookmarked
                            ? 'bg-amber-400 text-white'
                            : 'bg-white/80 hover:bg-white text-slate-600'
                        }`}
                        title="نشان کردن"
                      >
                        {material.is_bookmarked ? '★' : '☆'}
                      </button>
                      <button
                        onClick={(e) => handleToggleComplete(e, material)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm backdrop-blur-md shadow-md transition-all ${
                          material.is_completed
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white/80 hover:bg-white text-slate-600'
                        }`}
                        title="علامت‌گذاری به عنوان تکمیل شده"
                      >
                        {material.is_completed ? '✓' : '○'}
                      </button>
                    </div>

                    {/* Bottom Left Duration Badge */}
                    {material.duration_minutes && (
                      <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-bold">
                        ⏱️ {material.duration_minutes} دقیقه
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${typeConf.color}`}>
                        <span>{typeConf.icon}</span>
                        <span>{typeConf.label}</span>
                      </span>
                      {material.difficulty && material.difficulty !== 'all' && (
                        <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg font-bold">
                          {DIFFICULTY_LABELS[material.difficulty]}
                        </span>
                      )}
                    </div>

                    <h3 className="font-black text-slate-800 text-base leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {material.title}
                    </h3>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed min-h-[32px]">
                      {material.description || 'فایل و مستند آموزشی مرتبط با فرآیندهای سازمانی.'}
                    </p>

                    {/* Tags */}
                    {Array.isArray(material.tags) && material.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {material.tags.slice(0, 3).map((t, idx) => (
                          <span key={idx} className="text-[10px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded-md">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="p-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    <span>👁️ {material.view_count || 0} بازدید</span>
                    {material.attachments && material.attachments.length > 0 && (
                      <span>📎 {material.attachments.length} پیوست</span>
                    )}
                  </div>

                  <span className="text-blue-600 font-bold flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
                    <span>مشاهده</span>
                    <span>←</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==========================================
          MODAL: INTERACTIVE CONTENT VIEWER
      ========================================== */}
      {activeMaterial && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6"
          onClick={() => setActiveMaterial(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Topbar */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg text-white font-bold shrink-0 shadow-sm"
                  style={{ backgroundColor: activeMaterial.category_color || '#3B82F6' }}
                >
                  {activeMaterial.category_icon || '📁'}
                </span>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-black text-slate-800 truncate">
                    {activeMaterial.title}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>دسته‌بندی: {activeMaterial.category_title}</span>
                    <span>•</span>
                    <span>توسط: {activeMaterial.uploader_name}</span>
                    <span>•</span>
                    <span>{moment(activeMaterial.created_at).format('jYYYY/jMM/jDD')}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pr-4">
                <button
                  onClick={(e) => handleToggleBookmark(e, activeMaterial)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                    activeMaterial.is_bookmarked
                      ? 'bg-amber-400 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  <span>{activeMaterial.is_bookmarked ? '★' : '☆'}</span>
                  <span>نشان شده</span>
                </button>

                <button
                  onClick={(e) => handleToggleComplete(e, activeMaterial)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                    activeMaterial.is_completed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <span>{activeMaterial.is_completed ? '✓' : '○'}</span>
                  <span>{activeMaterial.is_completed ? 'تکمیل شده' : 'اتمام دوره'}</span>
                </button>

                <button
                  onClick={() => setActiveMaterial(null)}
                  className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-lg font-bold transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body: Player / Viewer */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Media Renderer */}
              <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center min-h-[320px]">
                {/* VIDEO */}
                {activeMaterial.content_type === 'video' && (
                  <video
                    src={activeMaterial.file_url}
                    controls
                    autoPlay
                    className="w-full max-h-[65vh] bg-black rounded-3xl"
                    style={{ direction: 'ltr' }}
                  >
                    مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
                  </video>
                )}

                {/* AUDIO / PODCAST */}
                {activeMaterial.content_type === 'audio' && (
                  <div className="p-10 flex flex-col items-center justify-center text-center w-full max-w-lg space-y-6">
                    <div className="w-24 h-24 rounded-3xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-5xl animate-pulse">
                      🎵
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-white font-bold text-lg">{activeMaterial.title}</h4>
                      <p className="text-slate-400 text-xs">پادکست آموزشی صوتی</p>
                    </div>
                    <audio
                      src={activeMaterial.file_url}
                      controls
                      autoPlay
                      className="w-full"
                      style={{ direction: 'ltr' }}
                    >
                      مرورگر شما از پخش صدا پشتیبانی نمی‌کند.
                    </audio>
                  </div>
                )}

                {/* PDF VIEWER */}
                {activeMaterial.content_type === 'pdf' && (
                  <div className="w-full h-[65vh] bg-slate-800 flex flex-col">
                    <iframe
                      src={`${activeMaterial.file_url}#toolbar=1`}
                      className="w-full flex-1 border-0 rounded-t-3xl"
                      title={activeMaterial.title}
                    />
                    <div className="bg-slate-900 p-3 flex items-center justify-between text-xs text-slate-300">
                      <span>کتابچه آموزشی با فرمت استاندارد PDF</span>
                      <a
                        href={activeMaterial.file_url}
                        download={`${activeMaterial.title}.pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center gap-1.5"
                      >
                        <span>📥</span>
                        <span>دانلود فایل اصلی PDF</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* ARTICLE / TEXT GUIDE */}
                {activeMaterial.content_type === 'article' && (
                  <div className="w-full max-h-[65vh] overflow-y-auto bg-white p-8 rounded-3xl text-right" dir="rtl">
                    <div className="prose max-w-none text-slate-800 leading-relaxed whitespace-pre-wrap font-sans text-sm sm:text-base">
                      {activeMaterial.content_text || activeMaterial.description}
                    </div>
                  </div>
                )}

                {/* EMBED CODE */}
                {activeMaterial.content_type === 'embed' && (
                  <div
                    className="w-full min-h-[420px] flex items-center justify-center bg-black p-4"
                    dangerouslySetInnerHTML={{ __html: activeMaterial.embed_code }}
                  />
                )}
              </div>

              {/* Material Details & Description */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                <h4 className="font-black text-slate-800 text-sm">توضیحات و سرفصل‌های این آموزش:</h4>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {activeMaterial.description || 'توضیحات بیشتری برای این آموزش درج نشده است.'}
                </p>

                {/* Supplementary Attachments List */}
                {activeMaterial.attachments && activeMaterial.attachments.length > 0 && (
                  <div className="pt-4 border-t border-slate-200 space-y-2">
                    <h5 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                      <span>📎</span>
                      <span>فایل‌های ضمیمه و تمرینی این آموزش ({activeMaterial.attachments.length} فایل):</span>
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeMaterial.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.file_url}
                          download={att.title}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between p-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-700 transition-all shadow-sm"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span>📄</span>
                            <span className="truncate">{att.title}</span>
                          </div>
                          <span className="text-blue-600 text-xs shrink-0">دانلود 📥</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}