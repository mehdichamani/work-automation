import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { toJalali } from '../utils/dateUtils';

const MODULE_LABELS = {
  purchase: 'درخواست خرید', mission: 'ماموریت', work_order: 'دستور کار',
  payment: 'پرداخت', repair: 'تعمیرات', it_request: 'درخواست IT',
  conference: 'رزرو سمینار', security: 'گزارش ایمنی', daily_output: 'خروجی روزانه',
  inspection: 'بازرسی', leave: 'مرخصی', project_supply: 'تأمین پروژه',
};

const ROLE_LABELS = {
  admin: 'مدیر سیستم', manager: 'مدیر', supervisor: 'سرپرست',
  user: 'کارمند', security: 'ایمنی', warehouse: 'انبار',
};

export default function WorkflowBuilder() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState({ name: '', module_name: 'purchase', steps: [] });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({}); // Track loading state per instance to prevent double-clicks
  const [tab, setTab] = useState('templates');

  useEffect(() => {
    loadTemplates();
    loadInstances();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await api.get('/workflow/templates');
      setTemplates(res.data);
    } catch (err) {
      toast.error('خطا در بارگذاری قالب‌ها');
    }
  };

  const loadInstances = async () => {
    try {
      const res = await api.get('/workflow/instances');
      setInstances(res.data);
    } catch (err) { toast.error('خطا در بارگذاری درخواست‌ها'); }
  };

  const addStep = () => {
    setForm({
      ...form,
      steps: [...form.steps, { name: '', role: 'supervisor', description: '' }]
    });
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...form.steps];
    newSteps[index][field] = value;
    setForm({ ...form, steps: newSteps });
  };

  const removeStep = (index) => {
    setForm({ ...form, steps: form.steps.filter((_, i) => i !== index) });
  };

  const moveStep = (index, dir) => {
    const newSteps = [...form.steps];
    const swap = index + dir;
    if (swap < 0 || swap >= newSteps.length) return;
    [newSteps[index], newSteps[swap]] = [newSteps[swap], newSteps[index]];
    setForm({ ...form, steps: newSteps });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.steps.length === 0) {
      toast.error('حداقل یک مرحله اضافه کنید');
      return;
    }
    setLoading(true);
    try {
      if (editingTemplate) {
        await api.put(`/workflow/templates/${editingTemplate.id}`, form);
        toast.success('قالب ویرایش شد');
      } else {
        await api.post('/workflow/templates', form);
        toast.success('قالب ایجاد شد');
      }
      setShowForm(false);
      setEditingTemplate(null);
      setForm({ name: '', module_name: 'purchase', steps: [] });
      loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (tpl) => {
    setEditingTemplate(tpl);
    let parsedSteps = [];
    try { parsedSteps = JSON.parse(tpl.steps || '[]'); } catch (e) { parsedSteps = []; }
    setForm({ name: tpl.name, module_name: tpl.module_name, steps: parsedSteps });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('آیا مطمئن هستید؟')) return;
    try {
      await api.delete(`/workflow/templates/${id}`);
      toast.success('حذف شد');
      loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در حذف');
    }
  };

  const toggleActive = async (tpl) => {
    try {
      await api.put(`/workflow/templates/${tpl.id}`, { is_active: tpl.is_active ? 0 : 1 });
      loadTemplates();
    } catch (err) { toast.error('خطا در تغییر وضعیت'); }
  };

  const handleAction = async (instanceId, action) => {
    if (actionLoading[instanceId]) return;
    const comment = prompt(action === 'approve' ? 'توضیحات (اختیاری):' : 'دلیل رد:');
    if (action === 'reject' && !comment) return;

    setActionLoading(prev => ({ ...prev, [instanceId]: true }));
    try {
      await api.post(`/workflow/instances/${instanceId}/action`, { action, comment: comment || '' });
      toast.success(action === 'approve' ? 'تأیید شد' : 'رد شد');
      loadInstances();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    } finally {
      setActionLoading(prev => ({ ...prev, [instanceId]: false }));
    }
  };

  const statusLabels = {
    active: { label: 'فعال', color: 'bg-blue-100 text-blue-700' },
    completed: { label: 'تکمیل', color: 'bg-green-100 text-green-700' },
    rejected: { label: 'رد شده', color: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">⚙️ گردش کار سفارشی</h1>
        {user.role === 'admin' && (
          <button onClick={() => { setShowForm(!showForm); setEditingTemplate(null); setForm({ name: '', module_name: 'purchase', steps: [] }); }}
            className="bg-primary-500 text-white px-4 py-2 rounded-xl hover:bg-primary-600 text-sm">
            {showForm ? 'انصراف' : '+ قالب جدید'}
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b pb-2">
        <button onClick={() => setTab('templates')} className={`px-4 py-2 rounded-t-lg text-sm font-medium ${tab === 'templates' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          قالب‌ها ({templates.length})
        </button>
        <button onClick={() => setTab('instances')} className={`px-4 py-2 rounded-t-lg text-sm font-medium ${tab === 'instances' ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          درخواست‌های جاری ({instances.length})
        </button>
      </div>

      {showForm && user.role === 'admin' && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-gray-800">{editingTemplate ? 'ویرایش قالب' : 'قالب جدید'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نام قالب *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-xl" placeholder="مثال: گردش کار خرید" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ماژول *</label>
              <select value={form.module_name} onChange={e => setForm({ ...form, module_name: e.target.value })}
                className="w-full px-4 py-2 border rounded-xl">
                {Object.entries(MODULE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-700">مراحل تأیید</h4>
              <button type="button" onClick={addStep} className="text-primary-500 hover:text-primary-700 text-sm">+ افزودن مرحله</button>
            </div>
            {form.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl">
                <span className="text-lg font-bold text-gray-400 w-8 text-center">{i + 1}</span>
                <input value={step.name} onChange={e => updateStep(i, 'name', e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="نام مرحله" required />
                <select value={step.role} onChange={e => updateStep(i, 'role', e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input value={step.description || ''} onChange={e => updateStep(i, 'description', e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="توضیحات (اختیاری)" />
                <button type="button" onClick={() => moveStep(i, -1)} className="text-gray-400 hover:text-gray-600">↑</button>
                <button type="button" onClick={() => moveStep(i, 1)} className="text-gray-400 hover:text-gray-600">↓</button>
                <button type="button" onClick={() => removeStep(i)} className="text-red-400 hover:text-red-600">✕</button>
              </div>
            ))}
            {form.steps.length === 0 && <p className="text-sm text-gray-400 text-center py-4">مرحله‌ای اضافه نشده</p>}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <button type="submit" disabled={loading}
              className="bg-primary-500 text-white px-6 py-2 rounded-xl hover:bg-primary-600 disabled:opacity-50">
              {loading ? 'در حال ذخیره...' : 'ذخیره'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingTemplate(null); }}
              className="bg-gray-200 text-gray-700 px-6 py-2 rounded-xl hover:bg-gray-300">
              انصراف
            </button>
          </div>
        </form>
      )}

      {tab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(tpl => {
            let steps = [];
            try { steps = JSON.parse(tpl.steps || '[]'); } catch (e) { steps = []; }
            return (
              <div key={tpl.id} className={`bg-white rounded-2xl p-5 shadow-sm border-2 ${tpl.is_active ? 'border-green-200' : 'border-gray-200 opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">{tpl.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{MODULE_LABELS[tpl.module_name] || tpl.module_name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${tpl.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {tpl.is_active ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  {steps.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-5 h-5 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold">{i + 1}</span>
                      <span className="text-gray-700">{s.name}</span>
                      <span className="text-gray-400">←</span>
                      <span className="text-gray-500">{ROLE_LABELS[s.role] || s.role}</span>
                    </div>
                  ))}
                </div>
                {user.role === 'admin' && (
                  <div className="flex gap-2 pt-3 border-t">
                    <button onClick={() => toggleActive(tpl)} className="text-xs text-gray-500 hover:text-primary-600">
                      {tpl.is_active ? 'غیرفعال' : 'فعال'}
                    </button>
                    <button onClick={() => handleEdit(tpl)} className="text-xs text-gray-500 hover:text-blue-600">ویرایش</button>
                    <button onClick={() => handleDelete(tpl.id)} className="text-xs text-gray-500 hover:text-red-600">حذف</button>
                  </div>
                )}
              </div>
            );
          })}
          {templates.length === 0 && <p className="text-gray-400 text-center py-8 col-span-3">قالبی تعریف نشده</p>}
        </div>
      )}

      {tab === 'instances' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="px-4 py-3 text-right">ردیف</th>
                <th className="px-4 py-3 text-right">قالب</th>
                <th className="px-4 py-3 text-right">ماژول</th>
                <th className="px-4 py-3 text-right">مرحله فعلی</th>
                <th className="px-4 py-3 text-right">وضعیت</th>
                <th className="px-4 py-3 text-right">تاریخ</th>
                <th className="px-4 py-3 text-right">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {instances.map(inst => {
                const st = statusLabels[inst.status] || statusLabels.active;
                const isLoading = actionLoading[inst.id];
                return (
                  <tr key={inst.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{inst.id}</td>
                    <td className="px-4 py-3 font-medium">{inst.template_name}</td>
                    <td className="px-4 py-3">{MODULE_LABELS[inst.module_name] || inst.module_name}</td>
                    <td className="px-4 py-3">مرحله {inst.current_step + 1}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${st.color}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-gray-500">{toJalali(inst.created_at)}</td>
                    <td className="px-4 py-3">
                      {inst.status === 'active' && (
                        <div className="flex gap-2">
                          <button disabled={isLoading} onClick={() => handleAction(inst.id, 'approve')} className="text-xs text-green-600 hover:text-green-800 disabled:opacity-50">
                            {isLoading ? '...' : 'تأیید'}
                          </button>
                          <button disabled={isLoading} onClick={() => handleAction(inst.id, 'reject')} className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50">
                            {isLoading ? '...' : 'رد'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {instances.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">درخواستی موجود نیست</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
