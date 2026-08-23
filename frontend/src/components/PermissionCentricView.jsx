import { useState, useMemo, useEffect } from 'react';
import ThreeStateToggle from './ThreeStateToggle';
import api from '../api/axios';
import toast from 'react-hot-toast';

const ROLE_DEFINITIONS = {
  manager: { label: 'مدیر', plural: 'مدیران', icon: '👑', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  supervisor: { label: 'سرپرست', plural: 'سرپرستان', icon: '👔', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  user: { label: 'کاربر عادی', plural: 'کاربران عادی', icon: '👤', badge: 'bg-gray-100 text-gray-700 border-gray-200' },
  admin: { label: 'ادمین', plural: 'ادمین‌ها', icon: '🛡️', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function PermissionCentricView({ matrix, onRefresh }) {
  const [selectedModule, setSelectedModule] = useState(null);
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [initialUserIds, setInitialUserIds] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [permSearch, setPermSearch] = useState('');
  const [deptSearch, setDeptSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'manager' | 'supervisor' | 'user' | 'admin'

  // Extract all active user IDs in the matrix
  const allActiveUsers = useMemo(() => {
    const users = [];
    (matrix?.departments || []).forEach(dept => {
      (matrix?.deptUsers?.[dept.id] || []).forEach(user => {
        users.push({ ...user, deptId: dept.id, deptName: dept.name });
      });
    });
    return users;
  }, [matrix]);

  // Group active users by role
  const usersByRole = useMemo(() => {
    const map = { manager: [], supervisor: [], user: [], admin: [] };
    allActiveUsers.forEach(u => {
      if (map[u.role]) {
        map[u.role].push(u);
      } else {
        map.user.push(u);
      }
    });
    return map;
  }, [allActiveUsers]);

  // Compute active user IDs for current module from matrix
  const getSavedModuleUserIds = (moduleKey) => {
    if (!moduleKey || !matrix) return new Set();
    const ids = new Set();
    (matrix.departments || []).forEach(dept => {
      (matrix.deptUsers?.[dept.id] || []).forEach(user => {
        const userPerms = matrix.userPermMap?.[user.id] || {};
        if (moduleKey in userPerms) {
          if (userPerms[moduleKey]) ids.add(user.id);
        } else {
          const deptPerm = matrix.deptPermMap?.[dept.id]?.[moduleKey];
          if (deptPerm) ids.add(user.id);
        }
      });
    });
    return ids;
  };

  // Reset selected users whenever selectedModule or matrix changes
  useEffect(() => {
    if (selectedModule) {
      const initial = getSavedModuleUserIds(selectedModule);
      setSelectedUserIds(new Set(initial));
      setInitialUserIds(new Set(initial));
    } else {
      setSelectedUserIds(new Set());
      setInitialUserIds(new Set());
    }
  }, [selectedModule, matrix]);

  const hasChanges = useMemo(() => {
    if (!selectedModule) return false;
    if (selectedUserIds.size !== initialUserIds.size) return true;
    for (const id of selectedUserIds) {
      if (!initialUserIds.has(id)) return true;
    }
    return false;
  }, [selectedUserIds, initialUserIds, selectedModule]);

  const groups = useMemo(() => {
    const g = {};
    (matrix?.modules || []).forEach(m => {
      if (!g[m.group]) g[m.group] = [];
      g[m.group].push(m);
    });
    return g;
  }, [matrix]);

  const filteredModules = useMemo(() => {
    if (!permSearch) return null;
    const q = permSearch.toLowerCase();
    return (matrix?.modules || []).filter(m =>
      m.label.toLowerCase().includes(q) || m.key.toLowerCase().includes(q) || m.group.toLowerCase().includes(q)
    );
  }, [matrix, permSearch]);

  const filteredGroups = useMemo(() => {
    if (!permSearch) return null;
    const q = permSearch.toLowerCase();
    const result = {};
    (filteredModules || []).forEach(m => {
      if (!result[m.group]) result[m.group] = [];
      result[m.group].push(m);
    });
    return result;
  }, [filteredModules]);

  const filteredDepartments = useMemo(() => {
    let list = matrix?.departments || [];
    if (deptSearch) {
      const q = deptSearch.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }
    if (roleFilter !== 'all') {
      list = list.filter(d =>
        (matrix?.deptUsers?.[d.id] || []).some(u => u.role === roleFilter)
      );
    }
    return list;
  }, [matrix, deptSearch, roleFilter]);

  const getUserPermState = (userId) => {
    return selectedUserIds.has(userId) ? 'on' : 'off';
  };

  const getDeptSwitchState = (deptId) => {
    let users = matrix.deptUsers?.[deptId] || [];
    if (roleFilter !== 'all') {
      users = users.filter(u => u.role === roleFilter);
    }
    if (users.length === 0) return 'off';
    const onCount = users.filter(u => selectedUserIds.has(u.id)).length;
    if (onCount === users.length) return 'on';
    if (onCount === 0) return 'off';
    return 'indeterminate';
  };

  const toggleDeptSwitch = (deptId, newState) => {
    let users = matrix.deptUsers?.[deptId] || [];
    if (roleFilter !== 'all') {
      users = users.filter(u => u.role === roleFilter);
    }
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      users.forEach(u => {
        if (newState) {
          next.add(u.id);
        } else {
          next.delete(u.id);
        }
      });
      return next;
    });
  };

  const getRoleSwitchState = (roleKey) => {
    const list = usersByRole[roleKey] || [];
    if (list.length === 0) return 'off';
    const onCount = list.filter(u => selectedUserIds.has(u.id)).length;
    if (onCount === list.length) return 'on';
    if (onCount === 0) return 'off';
    return 'indeterminate';
  };

  const toggleRoleSwitch = (roleKey, newState) => {
    const list = usersByRole[roleKey] || [];
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      list.forEach(u => {
        if (newState) next.add(u.id);
        else next.delete(u.id);
      });
      return next;
    });
  };

  const selectAllState = useMemo(() => {
    if (allActiveUsers.length === 0) return 'off';
    const onCount = allActiveUsers.filter(u => selectedUserIds.has(u.id)).length;
    if (onCount === allActiveUsers.length) return 'on';
    if (onCount === 0) return 'off';
    return 'indeterminate';
  }, [allActiveUsers, selectedUserIds]);

  const toggleSelectAll = (newState) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (newState) {
        allActiveUsers.forEach(u => next.add(u.id));
      } else {
        next.clear();
      }
      return next;
    });
  };

  const toggleUserPerm = (userId, newState) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (newState) {
        next.add(userId);
      } else {
        next.delete(userId);
      }
      return next;
    });
  };

  const handleReset = () => {
    setSelectedUserIds(new Set(initialUserIds));
    toast('تغییرات لغو و به حالت قبلی بازگشت', { icon: '↩️' });
  };

  const handleSave = async () => {
    if (!selectedModule) return;
    setSaving(true);
    try {
      await api.put('/permissions/bulk-set-module-users', {
        module_key: selectedModule,
        user_ids: Array.from(selectedUserIds),
      });
      toast.success('تغییرات دسترسی با موفقیت ذخیره شد');
      if (typeof onRefresh === 'function') {
        try {
          await onRefresh();
        } catch (refreshErr) {
          console.error('Error refreshing permission matrix:', refreshErr);
        }
      }
    } catch (err) {
      toast.error(err.friendlyMessage || err.response?.data?.error || err.message || 'خطا در ذخیره دسترسی‌ها');
    } finally {
      setSaving(false);
    }
  };

  const toggleDeptExpand = (deptId) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  const selectedModuleObj = (matrix.modules || []).find(m => m.key === selectedModule);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Right sidebar: Permissions tree */}
      <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm p-4 max-h-[75vh] overflow-y-auto flex flex-col gap-3">
        <div>
          <input
            type="text"
            value={permSearch}
            onChange={(e) => setPermSearch(e.target.value)}
            placeholder="جستجوی دسترسی..."
            className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-primary-400 transition-colors"
          />
        </div>
        <h4 className="font-bold text-sm text-gray-700 border-b pb-2">دسترسی‌ها</h4>
        <div className="space-y-3 overflow-y-auto flex-1">
          {Object.entries(filteredGroups || groups).map(([group, mods]) => (
            <div key={group}>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide mb-1">{group}</p>
              <div className="space-y-0.5">
                {mods.map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setSelectedModule(m.key)}
                    className={`w-full text-right px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      selectedModule === m.key
                        ? 'bg-primary-500 text-white shadow-md'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Left body: Departments + members with toggles */}
      <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm p-6">
        {!selectedModule ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            یک دسترسی را از سایدبار انتخاب کنید
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <h3 className="font-bold text-base text-gray-800">
                  {selectedModuleObj?.label || selectedModule}
                </h3>
                <p className="text-[11px] text-gray-400 mt-1">
                  کاربران دارای این دسترسی ({selectedUserIds.size} از {allActiveUsers.length} نفر)
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {hasChanges && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                  >
                    لغو تغییرات
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className={`px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 ${
                    hasChanges
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      در حال ذخیره...
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      ذخیره تغییرات {hasChanges ? `(${selectedUserIds.size} نفر)` : ''}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Actions By Role Bar */}
            <div className="bg-gradient-to-r from-gray-50 to-indigo-50/30 p-3.5 rounded-2xl border border-indigo-100/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <span>⚡</span>
                  اعمال سریع دسترسی بر اساس سمت سازمانی:
                </span>
                <span className="text-[10px] text-gray-400">
                  کلیک روی سوئیچ‌ها کل افراد آن سمت را فعال/غیرفعال می‌کند
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {/* Managers */}
                {(() => {
                  const state = getRoleSwitchState('manager');
                  const total = usersByRole.manager.length;
                  const active = usersByRole.manager.filter(u => selectedUserIds.has(u.id)).length;
                  return (
                    <div className="bg-white px-3 py-2 rounded-xl border border-indigo-100 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">👑</span>
                        <div>
                          <span className="text-xs font-bold text-indigo-900 block">همه مدیران</span>
                          <span className="text-[10px] text-gray-400">{active} از {total} نفر فعال</span>
                        </div>
                      </div>
                      <ThreeStateToggle
                        state={state}
                        size="sm"
                        onChange={(val) => toggleRoleSwitch('manager', val)}
                      />
                    </div>
                  );
                })()}

                {/* Supervisors */}
                {(() => {
                  const state = getRoleSwitchState('supervisor');
                  const total = usersByRole.supervisor.length;
                  const active = usersByRole.supervisor.filter(u => selectedUserIds.has(u.id)).length;
                  return (
                    <div className="bg-white px-3 py-2 rounded-xl border border-amber-100 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">👔</span>
                        <div>
                          <span className="text-xs font-bold text-amber-900 block">همه سرپرستان</span>
                          <span className="text-[10px] text-gray-400">{active} از {total} نفر فعال</span>
                        </div>
                      </div>
                      <ThreeStateToggle
                        state={state}
                        size="sm"
                        onChange={(val) => toggleRoleSwitch('supervisor', val)}
                      />
                    </div>
                  );
                })()}

                {/* Normal Users */}
                {(() => {
                  const state = getRoleSwitchState('user');
                  const total = usersByRole.user.length;
                  const active = usersByRole.user.filter(u => selectedUserIds.has(u.id)).length;
                  return (
                    <div className="bg-white px-3 py-2 rounded-xl border border-gray-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="text-base">👤</span>
                        <div>
                          <span className="text-xs font-bold text-gray-800 block">همه کاربران عادی</span>
                          <span className="text-[10px] text-gray-400">{active} از {total} نفر فعال</span>
                        </div>
                      </div>
                      <ThreeStateToggle
                        state={state}
                        size="sm"
                        onChange={(val) => toggleRoleSwitch('user', val)}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="flex-1 w-full">
                <input
                  type="text"
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  placeholder="جستجوی واحد سازمانی..."
                  className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-primary-400 transition-colors"
                />
              </div>

              {/* Role filter pills */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setRoleFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    roleFilter === 'all' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  همه سمت‌ها
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('manager')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    roleFilter === 'manager' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  👑 مدیران
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('supervisor')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    roleFilter === 'supervisor' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  👔 سرپرستان
                </button>
                <button
                  type="button"
                  onClick={() => setRoleFilter('user')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    roleFilter === 'user' ? 'bg-white text-gray-800 shadow-xs font-bold' : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  👤 عادی
                </button>
              </div>
            </div>

            {selectedModule && (
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50 border border-gray-100 rounded-xl mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">انتخاب تمام کاربران سامانه</span>
                  <span className="text-[11px] text-gray-400">
                    ({selectedUserIds.size} از {allActiveUsers.length} نفر)
                  </span>
                </div>
                <ThreeStateToggle
                  state={selectAllState}
                  onChange={toggleSelectAll}
                />
              </div>
            )}

            {/* Department list */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {filteredDepartments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  هیچ واحد یا کاربری با این شرایط یافت نشد.
                </div>
              ) : (
                filteredDepartments.map(dept => {
                  let deptUsersList = matrix.deptUsers?.[dept.id] || [];
                  if (roleFilter !== 'all') {
                    deptUsersList = deptUsersList.filter(u => u.role === roleFilter);
                  }
                  if (deptUsersList.length === 0) return null;
                  const isExpanded = expandedDepts.has(dept.id);
                  const deptSwitchState = getDeptSwitchState(dept.id);
                  const selectedInDept = deptUsersList.filter(u => selectedUserIds.has(u.id)).length;

                  return (
                    <div key={dept.id} className="border rounded-2xl overflow-hidden bg-gray-50/30">
                      <div
                        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 transition-colors"
                        onClick={() => toggleDeptExpand(dept.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-bold text-xs">
                            {dept.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-800">{dept.name}</h4>
                            <span className="text-[10px] text-gray-400">
                              {selectedInDept} از {deptUsersList.length} نفر انتخاب شده
                            </span>
                          </div>
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <ThreeStateToggle
                            state={deptSwitchState}
                            onChange={(val) => toggleDeptSwitch(dept.id, val)}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t bg-white divide-y">
                          {deptUsersList.map(user => {
                            const userState = getUserPermState(user.id);
                            const roleInfo = ROLE_DEFINITIONS[user.role] || ROLE_DEFINITIONS.user;

                            return (
                              <div key={user.id} className="px-6 py-2.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold">
                                    {user.full_name?.charAt(0) || user.username?.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-gray-800">{user.full_name || user.username}</span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium border flex items-center gap-1 ${roleInfo.badge}`}>
                                        <span>{roleInfo.icon}</span>
                                        <span>{roleInfo.label}</span>
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-mono">کد پرسنلی: {user.id}</span>
                                  </div>
                                </div>
                                <ThreeStateToggle
                                  state={userState}
                                  size="sm"
                                  onChange={(val) => toggleUserPerm(user.id, val)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
