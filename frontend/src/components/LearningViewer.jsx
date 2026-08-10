import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { printPDF } from '../utils/printUtils';

const LearningViewer = () => {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [materials, setMaterials] = useState([]);
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);

  const isAdmin = user?.role === 'admin';
  const canUpload = isAdmin;

  useEffect(() => {
    fetchMaterials();
    fetchStats();
    if (isAdmin) {
      fetchCategories();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    let filtered = materials.filter(material => material.is_active === 1);
    
    if (activeTab === 'pdf') {
      filtered = filtered.filter(m => m.file_extension === '.pdf');
    } else if (activeTab === 'video') {
      filtered = filtered.filter(m => m.file_type.startsWith('video/'));
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.title.toLowerCase().includes(searchLower) ||
        m.description.toLowerCase().includes(searchLower) ||
        m.tags.toLowerCase().includes(searchLower)
      );
    }

    if (categoryFilter) {
      filtered = filtered.filter(m => m.category === categoryFilter);
    }

    setFilteredMaterials(filtered);
  }, [materials, activeTab, searchTerm, categoryFilter]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const endpoint = isAdmin && activeTab === 'admin'
        ? '/api/educational'
        : '/api/educational/active';
      
      const response = await api.get(endpoint);
      setMaterials(response.data);
    } catch (error) {
      toast.error('خطا در بارگذاری فایل‌های آموزشی');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      if (isAdmin) {
        const response = await api.get('/api/educational/stats/overview');
        setStats(response.data);
      }
    } catch (error) {
      console.error('خطا در بارگذاری آمار:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const uniqueCategories = [...new Set(materials.map(m => m.category))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('خطا در بارگذاری دسته‌بندی‌ها:', error);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.includes('pdf') && !file.type.startsWith('video/')) {
      toast.error('فقط فایل‌های PDF و ویدیویی پشتیبانی می‌شوند');
      return;
    }

    if (file.type === 'application/pdf' && file.size > 50 * 1024 * 1024) {
      toast.error('حجم فایل PDF باید کمتر از 50 مگابایت باشد');
      return;
    }

    if (file.type.startsWith('video/') && file.size > 100 * 1024 * 1024) {
      toast.error('حجم فایل ویدیویی باید کمتر از 100 مگابایت باشد');
      return;
    }

    uploadMaterial(file);
  };

  const uploadMaterial = async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', `فایل آموزشی جدید - ${new Date().toLocaleDateString('fa-IR')}`);
      formData.append('description', '');
      formData.append('category', 'عمومی');
      formData.append('target_audience', 'all');
      formData.append('tags', '');

      await api.post('/api/educational', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('فایل آموزشی با موفقیت بارگذاری شد');
      fetchMaterials();
    } catch (error) {
      toast.error(error.response?.data?.error || 'خطا در بارگذاری فایل');
    }
  };

  const deleteMaterial = async (id) => {
    if (!window.confirm('آیا مطمئن هستید که می‌خواهید این فایل را حذف کنید؟')) {
      return;
    }

    try {
      await api.delete(`/api/educational/${id}`);
      toast.success('فایل با موفقیت حذف شد');
      fetchMaterials();
    } catch (error) {
      toast.error('خطا در حذف فایل');
    }
  };

  const openPdfViewer = (material) => {
    setSelectedMaterial(material);
    setShowPdfViewer(true);
  };

  const openVideoPlayer = (material) => {
    setSelectedMaterial(material);
    setShowVideoPlayer(true);
  };

  const closeViewers = () => {
    setSelectedMaterial(null);
    setShowPdfViewer(false);
    setShowVideoPlayer(false);
  };

  const getFileIcon = (material) => {
    if (material.file_extension === '.pdf') {
      return '📄';
    } else if (material.file_type.startsWith('video/')) {
      return '🎥';
    }
    return '📎';
  };

  const getFileTypeLabel = (material) => {
    if (material.file_extension === '.pdf') {
      return 'PDF';
    } else if (material.file_type.startsWith('video/')) {
      return material.file_type.split('/')[1].toUpperCase();
    }
    return 'فایل';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">📚 آموزش و یادگیری</h1>
        <p className="text-blue-100">مجموعه‌ای از مطالب آموزشی برای همه کاربران</p>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-bold mb-4">🎬 بارگذاری فایل آموزشی جدید</h2>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,video/mp4,video/x-msvideo,video/quicktime,video/x-matroska,video/webm"
              onChange={handleFileUpload}
              disabled={!canUpload}
            />
            <label
              htmlFor="file-upload"
              className={`cursor-pointer ${!canUpload ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="text-6xl mb-4">📤</div>
              <h3 className="text-xl font-bold mb-2">
                {canUpload ? 'فایل آموزشی خود را انتخاب کنید' : 'دسترسی مورد نیاز: ادمین'}
              </h3>
              <p className="text-gray-500 mb-4">
                PDF (≤ 50MB) یا ویدیو (≤ 100MB) - قابل فشرده‌سازی
              </p>
              <button
                disabled={!canUpload}
                className={`bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-colors ${!canUpload ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {canUpload ? 'انتخاب فایل' : 'دسترسی غیرمجاز'}
              </button>
            </label>
          </div>
          <p className="text-sm text-gray-400 mt-4">
            * فقط ادمین‌ها می‌توانند فایل‌های آموزشی جدید بارگذاری کنند
          </p>
        </div>
      )}

      {isAdmin && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="text-sm text-blue-600 font-medium">کل فایل‌ها</h3>
            <p className="text-2xl font-bold text-blue-900">{stats.overview.total_materials}</p>
          </div>
          <div className="bg-green-50 rounded-xl p-4">
            <h3 className="text-sm text-green-600 font-medium">فعال</h3>
            <p className="text-2xl font-bold text-green-900">{stats.overview.active_materials}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4">
            <h3 className="text-sm text-purple-600 font-medium">فایل‌های PDF</h3>
            <p className="text-2xl font-bold text-purple-900">{stats.overview.pdf_files}</p>
          </div>
          <div className="bg-orange-50 rounded-xl p-4">
            <h3 className="text-sm text-orange-600 font-medium">فایل‌های ویدیویی</h3>
            <p className="text-2xl font-bold text-orange-900">{stats.overview.video_files}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                همه ({filteredMaterials.length})
              </button>
              <button
                onClick={() => setActiveTab('pdf')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'pdf'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                PDF ({filteredMaterials.filter(m => m.file_extension === '.pdf').length})
              </button>
              <button
                onClick={() => setActiveTab('video')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'video'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                ویدیو ({filteredMaterials.filter(m => m.file_type.startsWith('video/')).length})
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'admin'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  مدیریت ({materials.length})
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="جستجو در عنوان، توضیحات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">همه دسته‌بندی‌ها</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-500">در حال بارگذاری...</p>
          </div>
        ) : (
          <div className="p-6">
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📭</div>
                <h3 className="text-xl font-bold mb-2">فایلی یافت نشد</h3>
                <p className="text-gray-500">
                  {activeTab === 'admin' && isAdmin
                    ? 'هنوز فایلی بارگذاری نشده است'
                    : 'در حال حاضر فایل آموزشی در دسترس نیست'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMaterials.map(material => (
                  <div key={material.id} className="border rounded-xl p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-4xl mb-2">{getFileIcon(material)}</div>
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${material.file_extension === '.pdf'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                        }`}>{
                          getFileTypeLabel(material)
                        }</span>
                        {isAdmin && (
                          <button
                            onClick={() => deleteMaterial(material.id)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >🗑️ حذف</button>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-lg mb-2 line-clamp-2">{material.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{material.description}</p>

                    <div className="space-y-2 mb-4 text-sm text-gray-500">
                      <div className="flex justify-between">
                        <span>حجم:</span>
                        <span>{formatFileSize(material.file_size)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>دسته‌بندی:</span>
                        <span>{material.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>بارگذاری شده:</span>
                        <span>{material.uploader_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>تاریخ:</span>
                        <span>{new Date(material.created_at).toLocaleDateString('fa-IR')}</span>
                      </div>
                    </div>

                    {material.tags && (
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-1">
                          {material.tags.split(',').map(tag => tag.trim()).filter(tag => tag).map((tag, index) => (
                            <span key={index} className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (material.file_extension === '.pdf') {
                          openPdfViewer(material);
                        } else if (material.file_type.startsWith('video/')) {
                          openVideoPlayer(material);
                        }
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
                    >
                      🔍 مشاهده {material.file_extension === '.pdf' ? 'PDF' : 'ویدیو'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showPdfViewer && selectedMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">مشاهده PDF: {selectedMaterial.title}</h2>
              <button
                onClick={closeViewers}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >×</button>
            </div>
            <div className="p-6">
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(window.location.origin + selectedMaterial.file_path)}&embedded=1`}
                className="w-full h-96 rounded-lg"
                title={selectedMaterial.title}
              />
            </div>
          </div>
        </div>
      )}

      {showVideoPlayer && selectedMaterial && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold">مشاهده ویدیو: {selectedMaterial.title}</h2>
              <button
                onClick={closeViewers}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >×</button>
            </div>
            <div className="p-6">
              <video
                controls
                className="w-full rounded-lg"
                poster=""
              >
                <source src={selectedMaterial.file_path} type={selectedMaterial.file_type} />
                مرورگر شما از پخش ویدیوی پشتیبانی نمی‌کند.
              </video>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LearningViewer;