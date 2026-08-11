import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import moment from 'moment-jalaali';
import toast from 'react-hot-toast';

const CATEGORY_LABELS = {
  pdf: 'PDF',
  video: 'فیلم',
  audio: 'صوتی',
  text: 'متن',
};

const CATEGORY_ICONS = {
  pdf: '📄',
  video: '🎬',
  audio: '🎵',
  text: '📝',
};

export default function LearningViewer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [targetFilter, setTargetFilter] = useState('all');
  const [viewingMaterial, setViewingMaterial] = useState(null);

  const loadMaterials = useCallback(async () => {
    try {
      const params = {};
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (search) params.search = search;
      if (targetFilter !== 'all') params.target_audience = targetFilter;
      const res = await api.get('/educational', { params });
      setMaterials(res.data);
    } catch (err) {
      toast.error('خطا در بارگذاری محتوا');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, targetFilter]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const handleView = (material) => {
    setViewingMaterial(material);
  };

  const handleCloseViewer = () => {
    setViewingMaterial(null);
  };

  const renderViewer = (material) => {
    if (material.category === 'video') {
      return (
        <video
          src={material.file_url}
          controls
          className="w-full max-h-[70vh] rounded-lg bg-black"
          style={{ direction: 'ltr' }}
        >
          مرورگر شما از پخش ویدیو پشتیبانی نمی‌کند.
        </video>
      );
    }
    if (material.category === 'audio') {
      return (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="text-6xl mb-4">🎵</div>
          <audio
            src={material.file_url}
            controls
            className="w-full max-w-md"
            style={{ direction: 'ltr' }}
          >
            مرورگر شما از پخش صوتی پشتیبانی نمی‌کند.
          </audio>
          <p className="mt-4 text-gray-600 text-center">{material.title}</p>
        </div>
      );
    }
    if (material.category === 'pdf') {
      return (
        <iframe
          src={material.file_url}
          className="w-full h-[70vh] rounded-lg border"
          title={material.title}
          style={{ direction: 'ltr' }}
        />
      );
    }
    return (
      <div className="w-full h-[70vh] overflow-auto bg-white rounded-lg border p-6 text-right" dir="rtl">
        <h3 className="text-xl font-bold mb-4">{material.title}</h3>
        <p className="text-gray-700 whitespace-pre-wrap">{material.description}</p>
      </div>
    );
  };

  const filteredMaterials = materials.filter(m => {
    if (search && !m.title.toLowerCase().includes(search.toLowerCase()) && !m.description?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
    if (targetFilter !== 'all' && m.target_audience !== targetFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">📚 آموزش</h1>
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/admin/educational')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
          >
            + افزودن محتوا
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder="جستجو در محتوا..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 border dark:border-slate-800 dark:bg-slate-900 dark:text-white rounded-xl flex-1 min-w-[200px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border dark:border-slate-800 dark:bg-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="all">همه دسته‌ها</option>
          <option value="pdf">PDF</option>
          <option value="video">فیلم</option>
          <option value="text">متن</option>
        </select>
        <select
          value={targetFilter}
          onChange={(e) => setTargetFilter(e.target.value)}
          className="px-4 py-2 border dark:border-slate-800 dark:bg-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          <option value="all">همه مخاطبان</option>
          <option value="all">همه</option>
          <option value="manager">مدیران</option>
          <option value="supervisor">سرپرستان</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="text-lg text-gray-400 dark:text-slate-500">در حال بارگذاری...</div></div>
      ) : filteredMaterials.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-550">
          <p className="text-4xl mb-4">📭</p>
          <p>محتوای آموزشی یافت نشد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map((material) => (
            <div
              key={material.id}
              onClick={() => handleView(material)}
              className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden group"
            >
              <div className="h-40 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-850 dark:to-slate-800 flex items-center justify-center text-6xl">
                {CATEGORY_ICONS[material.category] || '📁'}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-1 rounded-full">
                    {CATEGORY_LABELS[material.category] || material.category}
                  </span>
                  {material.target_audience !== 'all' && (
                    <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 px-2 py-1 rounded-full">
                      {material.target_audience === 'manager' ? 'مدیران' : 'سرپرستان'}
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-gray-800 dark:text-slate-100 mb-2 line-clamp-2">{material.title}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2">{material.description}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-450">
                  <span>توسط {material.uploader_name}</span>
                  <span>{moment(material.created_at).format('jYYYY/jMM/jDD')}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-455">
                  <span>👁 {material.view_count || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewingMaterial && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={handleCloseViewer}>
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-800">
              <h2 className="font-bold text-lg text-gray-800 dark:text-slate-100">{viewingMaterial.title}</h2>
              <button onClick={handleCloseViewer} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-60px)]">
              {renderViewer(viewingMaterial)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}