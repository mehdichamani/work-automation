import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import moment from 'moment-jalaali';
import toast from 'react-hot-toast';
import JalaliCalendar from '../components/JalaliCalendar';
import { printCardex, printTable } from '../utils/printUtils';

const statusMap = {
  pending_user: { text: 'در انتظار تایید کاربر', color: 'bg-yellow-100 text-yellow-700' },
  confirmed: { text: 'تایید شده', color: 'bg-green-100 text-green-700' },
  rejected: { text: 'رد شده', color: 'bg-red-100 text-red-700' },
};

export default function Inventory() {
  const { user, hasPermission } = useAuth();
  const [tab, setTab] = useState('my');
  const [items, setItems] = useState([]);
  const [myCardex, setMyCardex] = useState([]);
  const [pendingConfirm, setPendingConfirm] = useState([]);
  const [allCardex, setAllCardex] = useState([]);
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCalendar, setShowCalendar] = useState(null);
  const [formRows, setFormRows] = useState([{ user_id: '', item_id: '', quantity: '', delivery_date: '', notes: '' }]);
  const [itemForm, setItemForm] = useState({ name: '', description: '', unit: 'عدد' });
  const [editItem, setEditItem] = useState(null);
  const [userSearch, setUserSearch] = useState({});
  const [itemSearch, setItemSearch] = useState({});
  const [openDropdown, setOpenDropdown] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRefs = useRef({});

  const isWarehouse = user.role === 'admin' || user.department_name === 'انبار';
  const canAddCardex = hasPermission('inventory_add');
  const canManageItems = hasPermission('inventory_items');
  const canViewAll = hasPermission('inventory_all');

  useEffect(() => {
    loadData();
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('ws-update', handleUpdate);
    return () => window.removeEventListener('ws-update', handleUpdate);
  }, [tab]);

  const loadData = async () => {
    try {
      if (tab === 'my') {
        const myRes = await api.get('/inventory/my-cardex');
        setMyCardex(myRes.data);
      } else if (tab === 'pending') {
        const pendRes = await api.get('/inventory/pending-confirm');
        setPendingConfirm(pendRes.data);
      } else if (tab === 'all' || tab === 'add') {
        if (canViewAll || canManageItems || canAddCardex) {
          const [allRes, usersRes] = await Promise.all([
            api.get('/inventory/all'),
            api.get('/admin/users')
          ]);
          setAllCardex(allRes.data);
          setUsers(usersRes.data.filter(u => u.is_active));
        }
      } else if (tab === 'items') {
        const itemsRes = await api.get('/inventory/items');
        setItems(itemsRes.data);
      }
    } catch (err) {
      toast.error('خطا در بارگذاری');
    }
  };

  const addCardex = async () => {
    const validRows = formRows.filter(r => r.user_id && r.item_id && r.quantity && r.delivery_date);
    if (validRows.length === 0) {
      toast.error('حداقل یک ردیف با اطلاعات کامل وارد کنید');
      return;
    }
    try {
      for (const row of validRows) {
        await api.post('/inventory', row);
      }
      toast.success(`${validRows.length} ردیف به کارتکس اضافه شد`);
      setShowForm(false);
      setFormRows([{ user_id: '', item_id: '', quantity: '', delivery_date: '', notes: '' }]);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const addFormRow = () => {
    const lastRow = formRows[formRows.length - 1];
    setFormRows([...formRows, { user_id: lastRow.user_id || '', item_id: '', quantity: '', delivery_date: lastRow.delivery_date || '', notes: '' }]);
  };

  const removeFormRow = (index) => {
    if (formRows.length <= 1) return;
    setFormRows(formRows.filter((_, i) => i !== index));
  };

  const updateFormRow = (index, field, value) => {
    const updated = [...formRows];
    updated[index] = { ...updated[index], [field]: value };
    setFormRows(updated);
  };

  const openDropdownAt = (key, refKey) => {
    const el = inputRefs.current[refKey];
    if (el) {
      const rect = el.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpenDropdown(key);
  };

  const addItem = async (e) => {
    e.preventDefault();
    try {
      await api.post('/inventory/items', itemForm);
      toast.success('کالا اضافه شد');
      setShowItemForm(false);
      setItemForm({ name: '', description: '', unit: 'عدد' });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const updateItem = async () => {
    try {
      await api.put(`/inventory/items/${editItem.id}`, editItem);
      toast.success('کالا ویرایش شد');
      setEditItem(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const deleteItem = async (id) => {
    if (!confirm('آیا از حذف این کالا مطمئن هستید؟')) return;
    try {
      await api.delete(`/inventory/items/${id}`);
      toast.success('کالا حذف شد');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    }
  };

  const confirmItem = async (id) => {
    try {
      await api.put(`/inventory/${id}/confirm`);
      toast.success('تایید شد');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const rejectItem = async (id) => {
    try {
      await api.put(`/inventory/${id}/reject`);
      toast.success('رد شد');
      loadData();
    } catch (err) {
      toast.error('خطا');
    }
  };

  const tabs = [
    { id: 'my', label: 'کارتکس من' },
    { id: 'pending', label: `در انتظار تایید (${pendingConfirm.length})` },
    ...(canAddCardex ? [{ id: 'add', label: 'افزودن اقلام' }] : []),
    ...(canManageItems ? [{ id: 'items', label: 'مدیریت کالاها' }] : []),
    ...(canViewAll ? [{ id: 'all', label: 'همه کارتکس‌ها' }] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold">کارتکس انبار</h2>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-5xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">افزودن اقلام به کارتکس</h3>
              <button onClick={addFormRow} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">+ ردیف جدید</button>
            </div>
            <div className="mb-4">
              <table className="w-full text-sm border border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-center border w-10">ردیف</th>
                    <th className="p-2 text-right border">کاربر</th>
                    <th className="p-2 text-right border">کالا</th>
                    <th className="p-2 text-center border w-24">تعداد</th>
                    <th className="p-2 text-center border w-36">تاریخ تحویل</th>
                    <th className="p-2 text-right border">توضیحات</th>
                    <th className="p-2 text-center border w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {formRows.map((row, idx) => {
                    const userKey = `user_${idx}`;
                    const itemKey = `item_${idx}`;
                    return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-1 text-center border text-xs text-gray-400">{idx + 1}</td>
                      <td className="p-1 border">
                        <input
                          ref={(el) => { inputRefs.current[`user_${idx}`] = el; }}
                          type="text"
                          value={openDropdown === userKey ? (userSearch[idx] || '') : (users.find(u => u.id == row.user_id)?.full_name || '')}
                          onFocus={() => { setUserSearch({...userSearch, [idx]: ''}); openDropdownAt(userKey, `user_${idx}`); }}
                          onChange={(e) => { setUserSearch({...userSearch, [idx]: e.target.value}); openDropdownAt(userKey, `user_${idx}`); }}
                          className="w-full px-2 py-2 border rounded-lg text-xs"
                          placeholder="جستجوی کاربر..."
                        />
                      </td>
                      <td className="p-1 border">
                        <input
                          ref={(el) => { inputRefs.current[`item_${idx}`] = el; }}
                          type="text"
                          value={openDropdown === itemKey ? (itemSearch[idx] || '') : (items.find(i => i.id == row.item_id) ? `${items.find(i => i.id == row.item_id).name} (${items.find(i => i.id == row.item_id).unit})` : '')}
                          onFocus={() => { setItemSearch({...itemSearch, [idx]: ''}); openDropdownAt(itemKey, `item_${idx}`); }}
                          onChange={(e) => { setItemSearch({...itemSearch, [idx]: e.target.value}); openDropdownAt(itemKey, `item_${idx}`); }}
                          className="w-full px-2 py-2 border rounded-lg text-xs"
                          placeholder="جستجوی کالا..."
                        />
                      </td>
                      <td className="p-1 border">
                        <input type="number" value={row.quantity} onChange={(e) => updateFormRow(idx, 'quantity', e.target.value)} className="w-full px-2 py-2 border rounded-lg text-xs text-center" min="0.1" step="0.1" placeholder="0" />
                      </td>
                      <td className="p-1 border">
                        <input type="text" value={row.delivery_date} readOnly onClick={(e) => { e.stopPropagation(); setShowCalendar(showCalendar === idx ? null : idx); }} className="w-full px-2 py-2 border rounded-lg text-xs text-center cursor-pointer bg-white" placeholder="انتخاب تاریخ" dir="ltr" />
                      </td>
                      <td className="p-1 border">
                        <input type="text" value={row.notes} onChange={(e) => updateFormRow(idx, 'notes', e.target.value)} className="w-full px-2 py-2 border rounded-lg text-xs" placeholder="توضیحات" />
                      </td>
                      <td className="p-1 text-center border">
                        {formRows.length > 1 && (
                          <button onClick={() => removeFormRow(idx)} className="text-red-400 hover:text-red-600 text-lg font-bold" title="حذف ردیف">×</button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-4">
              <button onClick={addCardex} className="flex-1 bg-primary-500 hover:bg-primary-600 text-white py-3 rounded-xl font-bold transition-colors">ذخیره اقلام</button>
              <button onClick={() => { setShowForm(false); setFormRows([{ user_id: '', item_id: '', quantity: '', delivery_date: '', notes: '' }]); setShowCalendar(null); setUserSearch({}); setItemSearch({}); setOpenDropdown(null); }} className="flex-1 bg-gray-200 hover:bg-gray-300 py-3 rounded-xl font-bold transition-colors">انصراف</button>
            </div>
          </div>
        </div>
      )}

      {showCalendar !== null && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowCalendar(null)}>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <JalaliCalendar
              selectedDate={formRows[showCalendar]?.delivery_date}
              showPast={true}
              onSelect={(date) => {
                updateFormRow(showCalendar, 'delivery_date', date);
                setShowCalendar(null);
              }}
            />
          </div>
        </div>
      )}

      {openDropdown && openDropdown.startsWith('user_') && (() => {
        const idx = parseInt(openDropdown.split('_')[1]);
        const filtered = users.filter(u => (userSearch[idx] || '') === '' || u.full_name.includes(userSearch[idx] || ''));
        return (
          <>
            <div className="fixed inset-0 z-[54]" onClick={() => setOpenDropdown(null)} />
            <div className="fixed z-[55] bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}>
              {filtered.length === 0 && <p className="p-2 text-xs text-gray-400">یافت نشد</p>}
              {filtered.map(u => (
                <button key={u.id} type="button"
                  onMouseDown={() => { updateFormRow(idx, 'user_id', u.id); setUserSearch({...userSearch, [idx]: ''}); setOpenDropdown(null); }}
                  className={`w-full text-right px-3 py-2 text-xs hover:bg-primary-50 ${formRows[idx]?.user_id == u.id ? 'bg-primary-100 font-bold' : ''}`}>
                  {u.full_name}
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {openDropdown && openDropdown.startsWith('item_') && (() => {
        const idx = parseInt(openDropdown.split('_')[1]);
        const filtered = items.filter(i => (itemSearch[idx] || '') === '' || i.name.includes(itemSearch[idx] || ''));
        return (
          <>
            <div className="fixed inset-0 z-[54]" onClick={() => setOpenDropdown(null)} />
            <div className="fixed z-[55] bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}>
              {filtered.length === 0 && <p className="p-2 text-xs text-gray-400">یافت نشد</p>}
              {filtered.map(i => (
                <button key={i.id} type="button"
                  onMouseDown={() => { updateFormRow(idx, 'item_id', i.id); setItemSearch({...itemSearch, [idx]: ''}); setOpenDropdown(null); }}
                  className={`w-full text-right px-3 py-2 text-xs hover:bg-primary-50 ${formRows[idx]?.item_id == i.id ? 'bg-primary-100 font-bold' : ''}`}>
                  {i.name} ({i.unit})
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {showItemForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-bold mb-6">کالای جدید</h3>
            <form onSubmit={addItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">نام کالا</label>
                <input type="text" value={itemForm.name} onChange={(e) => setItemForm({...itemForm, name: e.target.value})} className="w-full px-4 py-3 border rounded-xl" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">واحد</label>
                  <select value={itemForm.unit} onChange={(e) => setItemForm({...itemForm, unit: e.target.value})} className="w-full px-4 py-3 border rounded-xl">
                    <option value="عدد">عدد</option>
                    <option value="بسته">بسته</option>
                    <option value="کارتن">کارتن</option>
                    <option value="لیتر">لیتر</option>
                    <option value="کیلوگرم">کیلوگرم</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">توضیحات</label>
                  <input type="text" value={itemForm.description} onChange={(e) => setItemForm({...itemForm, description: e.target.value})} className="w-full px-4 py-3 border rounded-xl" />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold">افزودن</button>
                <button type="button" onClick={() => setShowItemForm(false)} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-bold mb-6">ویرایش کالا</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">نام کالا</label>
                <input type="text" value={editItem.name} onChange={(e) => setEditItem({...editItem, name: e.target.value})} className="w-full px-4 py-3 border rounded-xl" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">واحد</label>
                  <select value={editItem.unit} onChange={(e) => setEditItem({...editItem, unit: e.target.value})} className="w-full px-4 py-3 border rounded-xl">
                    <option value="عدد">عدد</option>
                    <option value="بسته">بسته</option>
                    <option value="کارتن">کارتن</option>
                    <option value="لیتر">لیتر</option>
                    <option value="کیلوگرم">کیلوگرم</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">توضیحات</label>
                  <input type="text" value={editItem.description} onChange={(e) => setEditItem({...editItem, description: e.target.value})} className="w-full px-4 py-3 border rounded-xl" />
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={updateItem} className="flex-1 bg-primary-500 text-white py-3 rounded-xl font-bold">ذخیره</button>
                <button onClick={() => setEditItem(null)} className="flex-1 bg-gray-200 py-3 rounded-xl font-bold">انصراف</button>
              </div>
            </div>
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

      <div className="bg-white rounded-2xl shadow-sm p-6">
        {tab === 'my' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{myCardex.length} ردیف</p>
              <button onClick={() => printCardex('کارتکس شخصی من', myCardex)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                چاپ
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-right">کالا</th>
                    <th className="p-3 text-right">تعداد</th>
                    <th className="p-3 text-right">تاریخ تحویل</th>
                    <th className="p-3 text-right">وضعیت</th>
                    <th className="p-3 text-right">توضیحات</th>
                  </tr>
                </thead>
                <tbody>
                  {myCardex.map(c => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{c.item_name}</td>
                      <td className="p-3">{c.quantity} {c.item_unit}</td>
                      <td className="p-3" dir="ltr">{c.delivery_date}</td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusMap[c.status]?.color}`}>
                          {statusMap[c.status]?.text}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500 text-xs">{c.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {myCardex.length === 0 && <p className="text-center text-gray-400 py-8">آیتمی در کارتکس وجود ندارد</p>}
          </div>
        )}

        {tab === 'pending' && (
          <div className="space-y-3">
            {pendingConfirm.length === 0 && <p className="text-center text-gray-400 py-8">آیتمی در انتظار تایید نیست</p>}
            {pendingConfirm.map(c => (
              <div key={c.id} className="border rounded-xl p-4 flex justify-between items-center">
                <div>
                  <p className="font-bold">{c.item_name} - {c.quantity} {c.item_unit}</p>
                  <p className="text-sm text-gray-500">تحویل‌دهنده: {c.warehouse_user_name} | تاریخ تحویل: {c.delivery_date}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => confirmItem(c.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium">تایید دریافت</button>
                  <button onClick={() => rejectItem(c.id)} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium">رد</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'add' && (
          <div>
            <button onClick={() => setShowForm(true)} className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-xl font-medium transition-colors mb-4">
              + افزودن اقلام به کارتکس
            </button>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-right">کاربر</th>
                    <th className="p-3 text-right">کالا</th>
                    <th className="p-3 text-right">تعداد</th>
                    <th className="p-3 text-right">تاریخ تحویل</th>
                    <th className="p-3 text-right">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {allCardex.map(c => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">{c.user_name}</td>
                      <td className="p-3 font-medium">{c.item_name}</td>
                      <td className="p-3">{c.quantity} {c.item_unit}</td>
                      <td className="p-3" dir="ltr">{c.delivery_date}</td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusMap[c.status]?.color}`}>
                          {statusMap[c.status]?.text}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'items' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setShowItemForm(true)} className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-2 rounded-xl font-medium transition-colors">
                + کالای جدید
              </button>
              <button onClick={() => printTable('لیست کالاها', [{ key: 'name', label: 'نام کالا' }, { key: 'unit', label: 'واحد' }, { key: 'description', label: 'توضیحات' }], items)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                چاپ لیست
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-right">نام کالا</th>
                    <th className="p-3 text-right">واحد</th>
                    <th className="p-3 text-right">توضیحات</th>
                    <th className="p-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(i => (
                    <tr key={i.id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-medium">{i.name}</td>
                      <td className="p-3">{i.unit}</td>
                      <td className="p-3 text-gray-500 text-xs">{i.description}</td>
                      <td className="p-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button onClick={() => setEditItem({ id: i.id, name: i.name, unit: i.unit, description: i.description || '' })} className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">ویرایش</button>
                          <button onClick={() => deleteItem(i.id)} className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors">حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'all' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{allCardex.length} ردیف</p>
              <button onClick={() => printCardex('همه کارتکس‌ها', allCardex)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                چاپ
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-right">کاربر</th>
                    <th className="p-3 text-right">کالا</th>
                    <th className="p-3 text-right">تعداد</th>
                    <th className="p-3 text-right">تاریخ تحویل</th>
                    <th className="p-3 text-right">ثبت‌کننده</th>
                    <th className="p-3 text-right">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {allCardex.map(c => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">{c.user_name}</td>
                      <td className="p-3 font-medium">{c.item_name}</td>
                      <td className="p-3">{c.quantity} {c.item_unit}</td>
                      <td className="p-3" dir="ltr">{c.delivery_date}</td>
                      <td className="p-3">{c.warehouse_user_name}</td>
                      <td className="p-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusMap[c.status]?.color}`}>
                          {statusMap[c.status]?.text}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
