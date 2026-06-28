import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import moment from 'moment-jalaali';
import toast from 'react-hot-toast';
import { printTable, printReservations, printMonitoringSummary } from '../utils/printUtils';

export default function Restaurant() {
  const { user } = useAuth();
  const [tab, setTab] = useState('menu');
  const [menu, setMenu] = useState([]);
  const [allMenu, setAllMenu] = useState([]);
  const [myReservations, setMyReservations] = useState([]);
  const [monitoring, setMonitoring] = useState(null);
  const [detailed, setDetailed] = useState([]);

  const isAdmin = user.role === 'admin';
  const isRestaurantSupervisor = user.role === 'supervisor' && user.department_name === 'رستوران';
  const canManage = isAdmin || isRestaurantSupervisor;

  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const d = moment().add(i, 'days');
    weekDates.push({
      date: d.format('jYYYY/jMM/jDD'),
      label: d.format('dddd'),
      shortLabel: d.format('jMM/jDD'),
    });
  }

  useEffect(() => { loadData(); }, [tab]);

  const loadData = async () => {
    try {
      if (tab === 'menu' || tab === 'my') {
        const [menuRes, myRes] = await Promise.all([
          api.get('/restaurant/menu'),
          api.get('/restaurant/my-reservations')
        ]);
        setMenu(menuRes.data);
        setMyReservations(myRes.data);
      } else if (tab === 'plan') {
        const allMenuRes = await api.get('/restaurant/menu-all');
        setAllMenu(allMenuRes.data);
      } else if (tab === 'monitoring') {
        const [monRes, detRes] = await Promise.all([
          api.get('/restaurant/monitoring'),
          api.get('/restaurant/monitoring-detailed')
        ]);
        setMonitoring(monRes.data);
        setDetailed(detRes.data);
      }
    } catch (err) {
      toast.error('خطا در بارگذاری');
    }
  };

  const reserveFood = async (foodId) => {
    try {
      await api.post('/restaurant/reserve', { food_id: foodId, quantity: 1 });
      toast.success('رزرو شد');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در رزرو');
    }
  };

  const cancelReservation = async (id) => {
    try {
      await api.put(`/restaurant/cancel/${id}`);
      toast.success('لغو شد');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const tabs = [
    { id: 'menu', label: 'منوی هفته' },
    { id: 'my', label: `رزروهای من (${myReservations.filter(r => r.status === 'active').length})` },
    ...(canManage ? [
      { id: 'plan', label: 'برنامه‌ریزی هفتگی' },
      { id: 'monitoring', label: 'مانیتورینگ' },
    ] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold">رستوران</h2>

      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t.id ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'menu' && (
        <MenuTab
          weekDates={weekDates}
          menu={menu}
          myReservations={myReservations}
          onReserve={reserveFood}
        />
      )}

      {tab === 'my' && (
        <MyReservationsTab
          reservations={myReservations}
          onCancel={cancelReservation}
        />
      )}

      {tab === 'plan' && canManage && (
        <PlanTab
          weekDates={weekDates}
          allMenu={allMenu}
          onReload={loadData}
        />
      )}

      {tab === 'monitoring' && canManage && monitoring && (
        <MonitoringTab
          weekDates={weekDates}
          monitoring={monitoring}
          detailed={detailed}
        />
      )}
    </div>
  );
}

function MenuTab({ weekDates, menu, myReservations, onReserve }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
      {weekDates.map(day => {
        const dayFoods = menu.filter(m => m.food_date === day.date);
        const myReservation = myReservations.find(r => {
          const food = dayFoods.find(f => f.id === r.food_id);
          return food && r.status === 'active';
        });

        return (
          <div key={day.date} className="bg-white rounded-2xl shadow-sm p-4">
            <div className="text-center mb-3 pb-3 border-b">
              <p className="text-sm font-bold text-primary-600">{day.label}</p>
              <p className="text-xs text-gray-400" dir="ltr">{day.date}</p>
            </div>
            <div className="space-y-2">
              {dayFoods.length > 0 ? (
                dayFoods.sort((a, b) => a.option_number - b.option_number).map(food => {
                  const isReserved = myReservation && myReservation.food_id === food.id;
                  const hasReservationForDay = myReservation && myReservation.food_id !== food.id;
                  return (
                    <div key={food.id} className={`rounded-xl p-3 transition-all ${isReserved ? 'bg-green-50 border-2 border-green-300' : 'bg-gray-50 border-2 border-transparent'}`}>
                      <div className="flex items-start justify-between">
                        <span className="text-[10px] font-bold bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">گزینه {food.option_number}</span>
                        {isReserved && <span className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">انتخاب شما</span>}
                      </div>
                      <p className="font-medium text-sm mt-2">{food.food_name}</p>
                      {food.description && <p className="text-xs text-gray-500 mt-1">{food.description}</p>}
                      {food.price > 0 && <p className="text-xs text-gray-400 mt-1">{food.price.toLocaleString()} تومان</p>}
                      <button
                        onClick={() => isReserved ? null : onReserve(food.id)}
                        disabled={isReserved || hasReservationForDay}
                        className={`mt-2 w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isReserved
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : hasReservationForDay
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-primary-500 text-white hover:bg-primary-600'
                        }`}
                      >
                        {isReserved ? '✓ رزرو شده' : hasReservationForDay ? 'روز دیگری رزرو شده' : 'انتخاب'}
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-400 text-center py-4">غذایی ثبت نشده</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MyReservationsTab({ reservations, onCancel }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-start gap-2">
        <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
        <div className="text-sm text-yellow-700">
          <p className="font-bold">توجه</p>
          <p className="text-xs mt-0.5">امکان لغو یا ویرایش رزرو کمتر از ۲۴ ساعت قبل از وعده غذا وجود ندارد</p>
        </div>
      </div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{reservations.length} رزرو</p>
        <button onClick={() => printReservations(reservations)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          چاپ
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3 text-right">غذا</th>
              <th className="p-3 text-right">گزینه</th>
              <th className="p-3 text-right">تاریخ</th>
              <th className="p-3 text-right">تعداد</th>
              <th className="p-3 text-right">وضعیت</th>
              <th className="p-3 text-right">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map(r => (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{r.food_name}</td>
                <td className="p-3"><span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full text-xs font-medium">گزینه {r.option_number}</span></td>
                <td className="p-3" dir="ltr">{r.food_date}</td>
                <td className="p-3">{r.quantity}</td>
                <td className="p-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${r.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {r.status === 'active' ? 'فعال' : 'لغو شده'}
                  </span>
                </td>
                <td className="p-3">
                  {r.status === 'active' && (
                    r.can_cancel ? (
                      <button onClick={() => onCancel(r.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">لغو</button>
                    ) : (
                      <span className="text-xs text-gray-400 cursor-not-allowed" title="کمتر از ۲۴ ساعت مانده">لغو محدود شده</span>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reservations.length === 0 && <p className="text-center text-gray-400 py-8">رزرویی ثبت نشده</p>}
      </div>
    </div>
  );
}

function PlanTab({ weekDates, allMenu, onReload }) {
  const [editingDay, setEditingDay] = useState(null);
  const [form1, setForm1] = useState({ food_name: '', description: '', price: '' });
  const [form2, setForm2] = useState({ food_name: '', description: '', price: '' });
  const [saving, setSaving] = useState(false);

  const addBothFoods = async () => {
    if (!form1.food_name.trim() || !form2.food_name.trim()) {
      toast.error('نام هر دو غذا را وارد کنید');
      return;
    }
    setSaving(true);
    try {
      await api.post('/restaurant/menu-bulk', {
        items: [
          { food_date: editingDay, option_number: 1, food_name: form1.food_name, description: form1.description, price: form1.price || 0 },
          { food_date: editingDay, option_number: 2, food_name: form2.food_name, description: form2.description, price: form2.price || 0 },
        ]
      });
      toast.success('غذاهای هفته ثبت شد');
      setEditingDay(null);
      setForm1({ food_name: '', description: '', price: '' });
      setForm2({ food_name: '', description: '', price: '' });
      onReload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    } finally {
      setSaving(false);
    }
  };

  const deleteFood = async (id) => {
    if (!confirm('آیا از حذف این غذا مطمئن هستید؟')) return;
    try {
      await api.delete(`/restaurant/menu/${id}`);
      toast.success('غذا حذف شد');
      onReload();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 rounded-2xl p-5 text-white">
        <h3 className="font-bold text-lg">برنامه‌ریزی منوی هفتگی</h3>
        <p className="text-primary-200 text-sm mt-1">برای هر روز ۲ غذا (گزینه ۱ و ۲) مشخص کنید تا کاربران انتخاب کنند</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {weekDates.map(day => {
          const dayFoods = allMenu.filter(m => m.food_date === day.date);
          const food1 = dayFoods.find(f => f.option_number === 1);
          const food2 = dayFoods.find(f => f.option_number === 2);
          const isEditing = editingDay === day.date;

          return (
            <div key={day.date} className="bg-white rounded-2xl shadow-sm p-4 flex flex-col">
              <div className="text-center mb-3 pb-3 border-b">
                <p className="text-sm font-bold text-primary-600">{day.label}</p>
                <p className="text-xs text-gray-400" dir="ltr">{day.date}</p>
                <div className="flex justify-center gap-1 mt-1">
                  {food1 && <span className="w-2 h-2 rounded-full bg-green-400"></span>}
                  {food2 && <span className="w-2 h-2 rounded-full bg-blue-400"></span>}
                  {!food1 && !food2 && <span className="w-2 h-2 rounded-full bg-gray-300"></span>}
                </div>
              </div>

              <div className="space-y-2 flex-1">
                {food1 && (
                  <div className="bg-green-50 rounded-xl p-2.5 relative group border border-green-200">
                    <span className="text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded">گزینه ۱</span>
                    <p className="font-medium text-xs mt-1">{food1.food_name}</p>
                    {food1.description && <p className="text-[10px] text-gray-500 mt-0.5">{food1.description}</p>}
                    {food1.price > 0 && <p className="text-[10px] text-gray-400">{food1.price.toLocaleString()} ت</p>}
                    <button onClick={() => deleteFood(food1.id)} className="absolute top-1 left-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">✕</button>
                  </div>
                )}
                {food2 && (
                  <div className="bg-blue-50 rounded-xl p-2.5 relative group border border-blue-200">
                    <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded">گزینه ۲</span>
                    <p className="font-medium text-xs mt-1">{food2.food_name}</p>
                    {food2.description && <p className="text-[10px] text-gray-500 mt-0.5">{food2.description}</p>}
                    {food2.price > 0 && <p className="text-[10px] text-gray-400">{food2.price.toLocaleString()} ت</p>}
                    <button onClick={() => deleteFood(food2.id)} className="absolute top-1 left-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">✕</button>
                  </div>
                )}
                {!food1 && !food2 && !isEditing && (
                  <p className="text-xs text-gray-400 text-center py-2">غذایی ثبت نشده</p>
                )}
              </div>

              {isEditing ? (
                <div className="mt-3 p-3 bg-primary-50 rounded-xl space-y-3 border border-primary-200">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded">گزینه ۱</span>
                    </div>
                    <input type="text" placeholder="نام غذا *" value={form1.food_name} onChange={e => setForm1({...form1, food_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-xs" autoFocus />
                    <input type="text" placeholder="توضیحات" value={form1.description} onChange={e => setForm1({...form1, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-xs" />
                    <input type="number" placeholder="قیمت (تومان)" value={form1.price} onChange={e => setForm1({...form1, price: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-xs" min="0" />
                  </div>
                  <hr className="border-primary-200" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded">گزینه ۲</span>
                    </div>
                    <input type="text" placeholder="نام غذا *" value={form2.food_name} onChange={e => setForm2({...form2, food_name: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-xs" />
                    <input type="text" placeholder="توضیحات" value={form2.description} onChange={e => setForm2({...form2, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-xs" />
                    <input type="number" placeholder="قیمت (تومان)" value={form2.price} onChange={e => setForm2({...form2, price: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-xs" min="0" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addBothFoods} disabled={saving} className="flex-1 bg-primary-500 text-white py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">{saving ? 'در حال ذخیره...' : 'ذخیره هر دو'}</button>
                    <button onClick={() => { setEditingDay(null); setForm1({ food_name: '', description: '', price: '' }); setForm2({ food_name: '', description: '', price: '' }); }} className="flex-1 bg-gray-200 py-1.5 rounded-lg text-xs font-medium">انصراف</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingDay(day.date); setForm1({ food_name: food1?.food_name || '', description: food1?.description || '', price: food1?.price || '' }); setForm2({ food_name: food2?.food_name || '', description: food2?.description || '', price: food2?.price || '' }); }}
                  className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-primary-400 hover:text-primary-500 hover:bg-primary-50 transition-all"
                >
                  {food1 || food2 ? 'ویرایش غذاها' : '+ ثبت غذاهای روز'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonitoringTab({ weekDates, monitoring, detailed }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800">خلاصه روزانه</h3>
          <button onClick={() => printMonitoringSummary(monitoring.totalCounts)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            چاپ
          </button>
        </div>
        <div className="grid grid-cols-7 gap-4">
          {monitoring.totalCounts.map(t => {
            const day = weekDates.find(w => w.date === t.food_date);
            return (
              <div key={t.food_date} className="bg-primary-50 rounded-xl p-4 text-center">
                <p className="text-sm font-bold text-primary-600">{day?.label}</p>
                <p className="text-2xl font-bold mt-2">{t.total_meals}</p>
                <p className="text-xs text-gray-500">وعده غذا</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800">جزئیات هر غذا</h3>
          <button onClick={() => printTable('جزئیات رزروهای رستوران', [
            { key: 'food_date', label: 'تاریخ' },
            { key: 'food_name', label: 'غذا' },
            { key: 'option_number', label: 'گزینه', render: (v) => `گزینه ${v}` },
            { key: 'reservation_count', label: 'تعداد رزرو' },
            { key: 'total_quantity', label: 'تعداد کل وعده' },
          ], monitoring.dailyCounts)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            چاپ
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-right">تاریخ</th>
                <th className="p-3 text-right">غذا</th>
                <th className="p-3 text-right">گزینه</th>
                <th className="p-3 text-right">تعداد رزرو</th>
                <th className="p-3 text-right">تعداد کل وعده</th>
              </tr>
            </thead>
            <tbody>
              {monitoring.dailyCounts.map(c => (
                <tr key={`${c.food_date}-${c.food_name}`} className="border-t hover:bg-gray-50">
                  <td className="p-3" dir="ltr">{c.food_date}</td>
                  <td className="p-3 font-medium">{c.food_name}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${c.option_number === 1 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>گزینه {c.option_number}</span></td>
                  <td className="p-3">{c.reservation_count}</td>
                  <td className="p-3 font-bold text-primary-600">{c.total_quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800">لیست رزروها</h3>
          <button onClick={() => printReservations(detailed)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            چاپ
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-right">نام</th>
                <th className="p-3 text-right">واحد</th>
                <th className="p-3 text-right">غذا</th>
                <th className="p-3 text-right">گزینه</th>
                <th className="p-3 text-right">تاریخ</th>
                <th className="p-3 text-right">تعداد</th>
              </tr>
            </thead>
            <tbody>
              {detailed.map(d => (
                <tr key={d.id} className="border-t hover:bg-gray-50">
                  <td className="p-3">{d.user_name}</td>
                  <td className="p-3">{d.user_dept}</td>
                  <td className="p-3 font-medium">{d.food_name}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${d.option_number === 1 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>گزینه {d.option_number}</span></td>
                  <td className="p-3" dir="ltr">{d.food_date}</td>
                  <td className="p-3">{d.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
