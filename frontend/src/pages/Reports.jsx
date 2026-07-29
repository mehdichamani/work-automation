import { useState, useEffect } from 'react';
import moment from 'moment-jalaali';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#2563eb', '#16a34a', '#eab308', '#9333ea', '#ef4444', '#06b6d4', '#f97316', '#ec4899'];

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const currentJalaliYear = moment().jYear();
  const currentJalaliMonth = moment().jMonth() + 1;
  const [year, setYear] = useState(currentJalaliYear);
  const [month, setMonth] = useState(currentJalaliMonth);
  const [deptId, setDeptId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [reportType, setReportType] = useState('monthly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [allRequests, setAllRequests] = useState([]);

  useEffect(() => {
    loadDepartments();
    loadReport();
  }, [year, month, deptId, reportType]);

  const loadDepartments = async () => {
    try {
      const res = await api.get('/admin/stats');
      setDepartments(res.data.deptStats || []);
    } catch (err) { toast.error('خطا در بارگذاری واحدها'); }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const params = { year, month };
      if (deptId) params.department_id = deptId;
      if (reportType === 'custom' && customFrom && customTo) {
        params.from_date = customFrom;
        params.to_date = customTo;
      }
      const res = await api.get('/reports/monthly', { params });
      setData(res.data);

      const allReqs = [];
      try {
        const modules = ['purchase', 'mission', 'work-order', 'payment', 'repair', 'it', 'conference', 'security', 'daily-output', 'inspection'];
        const results = await Promise.allSettled(
          modules.map(mod => api.get(`/${mod}/my-requests`).catch(() => ({ data: [] })))
        );
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && Array.isArray(r.value.data)) {
            allReqs.push(...r.value.data.map(x => ({ ...x, _module: modules[i] })));
          }
        });
      } catch (e) { console.warn('خطا در بارگذاری برخی ماژول‌ها', e); }
      setAllRequests(allReqs);
    } catch (err) {
      toast.error('خطا در بارگذاری گزارش');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRequests = () => {
    let reqs = allRequests;
    if (statusFilter) reqs = reqs.filter(r => r.status === statusFilter);
    return reqs;
  };

  const exportToCSV = () => {
    const reqs = getFilteredRequests();
    if (reqs.length === 0) {
      toast.error('داده‌ای برای خروجی وجود ندارد');
      return;
    }
    const headers = ['ردیف', 'ماژول', 'تاریخ', 'وضعیف', 'توضیحات'];
    const rows = reqs.map((r, i) => [
      i + 1,
      r._module,
      r.created_at ? new Date(r.created_at).toLocaleDateString('fa-IR') : '',
      r.status,
      r.description || r.title || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${year}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('فایل CSV دانلود شد');
  };

  const printReport = () => {
    window.print();
  };

  const months = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const yearOptions = [];
  for (let y = currentJalaliYear - 2; y <= currentJalaliYear + 1; y++) {
    yearOptions.push(y);
  }

  const statusOptions = [
    { value: '', label: 'همه وضعیت‌ها' },
    { value: 'approved', label: 'تأیید شده' },
    { value: 'rejected', label: 'رد شده' },
    { value: 'pending', label: 'در انتظار' },
    { value: 'pending_manager', label: 'در انتظار مدیر' },
    { value: 'pending_supervisor', label: 'در انتظار سرپرست' },
  ];

  const filteredReqs = getFilteredRequests();
  const statusCounts = {};
  filteredReqs.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: statusOptions.find(s => s.value === name)?.label || name, value
  }));

  const moduleCounts = {};
  filteredReqs.forEach(r => {
    moduleCounts[r._module] = (moduleCounts[r._module] || 0) + 1;
  });
  const barData = Object.entries(moduleCounts).map(([name, count]) => ({
    name, تعداد: count
  }));

  return (
    <div className="animate-fade-in space-y-6 print:space-y-2">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-6 print:bg-none print:text-black print:border print:border-gray-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">گزارش‌گیری پیشرفته</h1>
            <p className="text-primary-100 text-sm mt-1">تحلیل و بررسی درخواست‌ها</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button onClick={exportToCSV} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm">
              📥 خروجی Excel
            </button>
            <button onClick={printReport} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm">
              🖨️ چاپ
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm print:hidden">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">نوع گزارش</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm">
              <option value="monthly">ماهانه</option>
              <option value="custom">بازه دلخواه</option>
            </select>
          </div>
          {reportType === 'monthly' ? (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">سال</label>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl text-sm">
                  {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">ماه</label>
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl text-sm">
                  {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">از تاریخ</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">تا تاریخ</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-sm" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">واحد</label>
            <select value={deptId} onChange={e => setDeptId(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-sm">
              <option value="">همه واحدها</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm">
            {statusOptions.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{data.leave?.total || 0}</p>
              <p className="text-xs text-gray-500 mt-1">درخواست مرخصی</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{data.leave?.total_days || 0}</p>
              <p className="text-xs text-gray-500 mt-1">روز مرخصی</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">{data.overtime?.total || 0}</p>
              <p className="text-xs text-gray-500 mt-1">درخواست اضافه کار</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">{data.overtime?.total_hours || 0}</p>
              <p className="text-xs text-gray-500 mt-1">ساعت اضافه کار</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{data.mission?.total || 0}</p>
              <p className="text-xs text-gray-500 mt-1">ماموریت</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
              <p className="text-3xl font-bold text-teal-600">{data.production?.total_quantity || 0}</p>
              <p className="text-xs text-gray-500 mt-1">تعداد تولید</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {barData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4">📊 تعداد درخواست‌ها بر اساس ماژول</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="تعداد" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {pieData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4">📈 توزیع وضعیت درخواست‌ها</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                      label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {filteredReqs.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-4">📋 جزئیات درخواست‌ها ({filteredReqs.length} مورد)</h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100">
                    <tr className="text-gray-600">
                      <th className="px-3 py-2 text-right">ردیف</th>
                      <th className="px-3 py-2 text-right">ماژول</th>
                      <th className="px-3 py-2 text-right">تاریخ</th>
                      <th className="px-3 py-2 text-right">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReqs.slice(0, 200).map((r, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2 font-medium">{r._module}</td>
                        <td className="px-3 py-2 text-gray-500">{r.created_at ? new Date(r.created_at).toLocaleDateString('fa-IR') : '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            r.status === 'approved' ? 'bg-green-100 text-green-700' :
                            r.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {statusOptions.find(s => s.value === r.status)?.label || r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.departments?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800 mb-4">🏢 درخواست‌ها بر اساس واحد</h3>
              <div className="space-y-2">
                {data.departments.map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2">
                    <span className="text-sm">{d.name}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div className="bg-primary-500 h-2 rounded-full"
                          style={{ width: `${Math.min(100, (d.request_count / Math.max(...data.departments.map(x => x.request_count || 1))) * 100)}%` }}></div>
                      </div>
                      <span className="text-sm font-bold text-primary-600 min-w-[60px] text-left">{d.request_count} درخواست</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
