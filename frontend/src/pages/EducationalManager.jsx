import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import moment from 'moment-jalaali';
import toast from 'react-hot-toast';

const CATEGORY_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'video', label: 'فیلم' },
  { value: 'audio', label: 'صوتی' },
  { value: 'text', label: 'متن' },
];

const TARGET_AUDIENCE_OPTIONS = [
  { value: 'all', label: 'همه کاربران' },
  { value: 'manager', label: 'مدیران' },
  { value: 'supervisor', label: 'سرپرستان' },
];

export default function EducationalManager() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'pdf',
    target_audience: 'all',
    tags: '',
    is_active: true,
    file: null,
  });
  const [formLoading, setFormLoading] = useState(false);

  const loadMaterials = useCallback(async () => {
    try {
      const res = await api.get('/educational');
      setMaterials(res.data);
    } catch (err) {
      toast.error('خطا در بارگذاری محتوا');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'pdf',
      target_audience: 'all',
      tags: '',
      is_active: true,
      file: null,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (material) => {
    setFormData({
      title: material.title,
      description: material.description || '',
      category: material.category,
      target_audience: material.target_audience || 'all',
      tags: Array.isArray(material.tags) ? material.tags.join(', ') : (material.tags || ''),
      is_active: material.is_active,
      file: null,
    });
    setEditingId(material.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('عنوان الزامی است');
      return;
    }
    if (!formData.category) {
      toast.error('دسته‌بندی الزامی است');
      return;
    }

    setFormLoading(true);
    const data = new FormData();
    data.append('title', formData.title.trim());
    data.append('description', formData.description || '');
    data.append('category', formData.category);
    data.append('target_audience', formData.target_audience);
    if (formData.tags) data.append('tags', formData.tags);
    data.append('is_active', formData.is_active);
    if (formData.file) data.append('file', formData.file);

    try {
      if (editingId) {
        await api.put(`/educational/${editingId}`, data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('محتوای آموزشی ویرایش شد');
      } else {
        await api.post('/educational', data, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('محتوای آموزشی اضافه شد');
      }
      resetForm();
      loadMaterials();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در ذخیره');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!confirm(`آیا از حذف "${title}" مطمئن هستید؟`)) return;
    try {
      await api.delete(`/educational/${id}`);
      toast.success('محتوای آموزشی حذف شد');
      loadMaterials();
    } catch (err) {
      toast.error('خطا در حذف');
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      await api.put(`/educational/${id}`, { is_active: !currentStatus });
      loadMaterials();
      toast.success('وضعیت تغییر یافت');
    } catch (err) {
      toast.error('خطا در تغییر وضعیت');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📚 مدیریت محتوای آموزشی</h1>
        <button
          onClick={openAddForm}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          + افزودن محتوا
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-lg border p-6">
          <h2 className="text-lg font-bold mb-4">
            {editingId ? 'ویرایش محتای آموزشی' : 'افزودن محتوای آموزشی جدید'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">عنوان *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="عنوان محتوا"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">توضیحات</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                rows={3}
                placeholder="توضیحات اختیاری"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">دسته‌بندی *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  required
                >
                  {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">مخاطب هدف</label>
                <select
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {TARGET_AUDIENCE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">برچسب‌ها</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="تازه، مهم، پربازدید"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">فایل (PDF یا فیلم - حداکثر 100 مگابایت)</label>
              <input
                type="file"
                accept=".pdf,.mp4,.avi,.mov,.mkv,.webm,.mp3,.wav,.ogg,.aac,.m4a"
                onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
                className="w-full px-4 py-2.5 border rounded-xl"
              />
              {formData.file && (
                <p className="text-sm text-gray-500 mt-1">فایل انتخاب شده: {formData.file.name}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">فعال</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={formLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {formLoading ? 'در حال ذخیره...' : (editingId ? 'ویرایش' : 'ذخیره')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2.5 rounded-xl font-medium transition-colors"
              >
                انصراف
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="text-lg text-gray-400">در حال بارگذاری...</div></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">عنوان</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">دسته‌بندی</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">مخاطب</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">برچسب‌ها</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">بازدید</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">تاریخ</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">وضعیت</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {materials.map((material) => (
                  <tr key={material.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-[200px] truncate">{material.title}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                        {CATEGORY_OPTIONS.find(o => o.value === material.category)?.label || material.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {TARGET_AUDIENCE_OPTIONS.find(o => o.value === material.target_audience)?.label || material.target_audience}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {Array.isArray(material.tags) ? material.tags.join(', ') : (material.tags || '-')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{material.view_count || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{moment(material.created_at).format('jYYYY/jMM/jDD')}</td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => handleToggleActive(material.id, material.is_active)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          material.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {material.is_active ? 'فعال' : 'غیرفعال'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditForm(material)}
                          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          ویرایش
                        </button>
                        <button
                          onClick={() => handleDelete(material.id, material.title)}
                          className="text-red-600 hover:text-red-800 text-xs font-medium"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {materials.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      هیچ محتوای آموزشی ثبت نشده است
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}