import { useState, useMemo, useEffect } from 'react';
import ThreeStateToggle from './ThreeStateToggle';
import api from '../api/axios';
import toast from 'react-hot-toast';

const ROLES_CONFIG = [
  {
    key: 'manager',
    label: 'مدیران',
    singularLabel: 'مدیر',
    icon: '👑',
    color: 'indigo',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    textColor: 'text-indigo-700',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    activeTabClass: 'bg-indigo-600 text-white shadow-indigo-200 shadow-md',
    desc: 'مدیران دپارتمان‌ها و واحدهای سازمانی',
  },
  {
    key: 'supervisor',
    label: 'سرپرستان',
    singularLabel: 'سرپرست',
    icon: '👔',
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    activeTabClass: 'bg-amber-600 text-white shadow-amber-200 shadow-md',
    desc: 'سرپرستان و مسئولین شیفت و بخش‌ها',
  },
  {
    key: 'user',
    label: 'کاربران عادی',
    singularLabel: 'کاربر عادی',
    icon: '👤',
    color: 'gray',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-700',
    badgeColor: 'bg-gray-100 text-gray-800 border-gray-200',
    activeTabClass: 'bg-gray-700 text-white shadow-gray-200 shadow-md',
    desc: 'پرسنل و کارمندان عادی سازمان',
  },
  {
    key: 'admin',
    label: 'مدیران ارشد (ادمین)',
    singularLabel: 'ادمین',
    icon: '🛡️',
    color: 'rose',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    textColor: 'text-rose-700',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    activeTabClass: 'bg-rose-600 text-white shadow-rose-200 shadow-md',
    desc: 'مدیران ارشد با دسترسی کامل به کلیه بخش‌ها',
  },
];

export default function RoleCentricView({ matrix, onRefresh }) {
  const [selectedRole, setSelectedRole] = useState('manager');
  const [permSearch, setPermSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedModuleKeys, setSelectedModuleKeys] = useState(new Set());
  const [initialModuleKeys, setInitialModuleKeys] = useState(new Set());
  const [showUsersModal, setShowUsersModal] = useState(false);

  // Extract all users belonging to the currently selected role
  const roleUsers = useMemo(() => {
    const users = [];
    (matrix?.departments || []).forEach(dept => {
      (matrix?.deptUsers?.[dept.id] || []).forEach(user => {
        if (user.role === selectedRole) {
          users.push({ ...user, deptName: dept.name, deptId: dept.id });
        }
      });
    });
    return users;
  }, [matrix, selectedRole]);

  // Counts of users for each role
  const roleUserCounts = useMemo(() => {
    const counts = { manager: 0, supervisor: 0, user: 0, admin: 0 };
    (matrix?.departments || []).forEach(dept => {
      (matrix?.deptUsers?.[dept.id] || []).forEach(user => {
        if (counts[user.role] !== undefined) {
          counts[user.role]++;
        }
      });
    });
    return counts;
  }, [matrix]);

  // Calculate module permission states for role users
  const getRoleModuleState = (moduleKey) => {
    if (!roleUsers.length) return 'off';
    const enabledCount = roleUsers.filter(u => {
      const userPerms = matrix?.userPermMap?.[u.id] || {};
      if (moduleKey in userPerms) return !!userPerms[moduleKey];
      const deptPerm = matrix?.deptPermMap?.[u.deptId]?.[moduleKey];
      return !!deptPerm;
    }).length;

    if (enabledCount === roleUsers.length) return 'on';
    if (enabledCount === 0) return 'off';
    return 'indeterminate';
  };

  // Sync selectedModuleKeys when role or matrix changes
  useEffect(() => {
    const initial = new Set();
    (matrix?.modules || []).forEach(m => {
      const state = getRoleModuleState(m.key);
      if (state === 'on') {
        initial.add(m.key);
      }
    });
    setSelectedModuleKeys(new Set(initial));
    setInitialModuleKeys(new Set(initial));
  }, [selectedRole, matrix, roleUsers]);

  const hasChanges = useMemo(() => {
    if (selectedModuleKeys.size !== initialModuleKeys.size) return true;
    for (const key of selectedModuleKeys) {
      if (!initialModuleKeys.has(key)) return true;
    }
    return false;
  }, [selectedModuleKeys, initialModuleKeys]);

  const groups = useMemo(() => {
    const g = {};
    (matrix?.modules || []).forEach(m => {
      if (!g[m.group]) g[m.group] = [];
      g[m.group].push(m);
    });
    return g;
  }, [matrix]);

  const filteredGroups = useMemo(() => {
    if (!permSearch) return groups;
    const q = permSearch.toLowerCase();
    const result = {};
    (matrix?.modules || []).forEach(m => {
      if (
        m.label.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q) ||
        m.group.toLowerCase().includes(q)
      ) {
        if (!result[m.group]) result[m.group] = [];
        result[m.group].push(m);
      }
    });
    return result;
  }, [matrix, groups, permSearch]);

  const toggleModule = (moduleKey, newState) => {
    setSelectedModuleKeys(prev => {
      const next = new Set(prev);
      if (newState) {
        next.add(moduleKey);
      } else {
        next.delete(moduleKey);
      }
      return next;
    });
  };

  const toggleGroupModules = (groupMods, newState) => {
    setSelectedModuleKeys(prev => {
      const next = new Set(prev);
      groupMods.forEach(m => {
        if (newState) {
          next.add(m.key);
        } else {
          next.delete(m.key);
        }
      });
      return next;
    });
  };

  const getGroupState = (groupMods) => {
    if (!groupMods || groupMods.length === 0) return 'off';
    const onCount = groupMods.filter(m => selectedModuleKeys.has(m.key)).length;
    if (onCount === groupMods.length) return 'on';
    if (onCount === 0) return 'off';
    return 'indeterminate';
  };

  const selectAll = (state) => {
    setSelectedModuleKeys(prev => {
      const next = new Set(prev);
      (matrix?.modules || []).forEach(m => {
        if (state) next.add(m.key);
        else next.delete(m.key);
      });
      return next;
    });
  };

  const handleReset = () => {
    setSelectedModuleKeys(new Set(initialModuleKeys));
    toast('تغییرات به حالت قبلی بازگشت', { icon: '↩️' });
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    if (roleUsers.length === 0) {
      toast.error('هیچ کاربری با این سمت در سیستم ثبت نشده است');
      return;
    }

    setSaving(true);
    try {
      await api.put('/permissions/bulk-set-role-modules', {
        role: selectedRole,
        module_keys: Array.from(selectedModuleKeys),
      });
      toast.success(`دسترسی‌های سمت «${ROLES_CONFIG.find(r => r.key === selectedRole)?.label}» با موفقیت ذخیره شد`);
      if (typeof onRefresh === 'function') {
        try {
          await onRefresh();
        } catch (refreshErr) {
          console.error('Error refreshing permission matrix:', refreshErr);
        }
      }
    } catch (err) {
      toast.error(err.friendlyMessage || err.response?.data?.error || err.message || 'خطا در ذخیره دسترسی‌های سمت');
    } finally {
      setSaving(false);
    }
  };

  const activeRoleObj = ROLES_CONFIG.find(r => r.key === selectedRole);

  return (
    <div className="space-y-6">
      {/* Role Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {ROLES_CONFIG.map(r => {
          const isSelected = selectedRole === r.key;
          const count = roleUserCounts[r.key] || 0;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => setSelectedRole(r.key)}
              className={`p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between ${
                isSelected
                  ? `${r.bgColor} ${r.borderColor} ring-2 ring-primary-500/20 shadow-md`
                  : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/50'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-2xl">{r.icon}</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                    isSelected ? r.badgeColor : 'bg-gray-100 text-gray-600 border-gray-200'
                  }`}
                >
                  {count} نفر
                </span>
              </div>
              <div>
                <h4 className="font-bold text-sm text-gray-800 mb-0.5">{r.label}</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-1">{r.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Bar & Controls */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-xl shadow-inner">
              {activeRoleObj?.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-gray-800">
                  دسترسی‌های سمت: {activeRoleObj?.label}
                </h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${activeRoleObj?.badgeColor}`}>
                  {roleUsers.length} کاربر فعال
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                تغییرات زیر برای تمام اعضای این سمت در همه واحدها اعمال می‌شود.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUsersModal(true)}
              className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border rounded-xl transition-colors flex items-center gap-1.5"
            >
              <span>👥</span>
              مشاهده اعضا ({roleUsers.length})
            </button>

            {hasChanges && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                لغو تغییرات
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasChanges || roleUsers.length === 0}
              className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 ${
                hasChanges && roleUsers.length > 0
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
                  ذخیره دسترسی‌های سمت {hasChanges ? `(${selectedModuleKeys.size} ماژول)` : ''}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search & Quick Toggles */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <input
              type="text"
              value={permSearch}
              onChange={(e) => setPermSearch(e.target.value)}
              placeholder="جستجوی دسترسی یا ماژول..."
              className="w-full px-3.5 py-2 border rounded-xl text-xs outline-none focus:border-primary-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => selectAll(true)}
              className="px-3 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl font-medium transition-colors"
            >
              ✓ فعال‌سازی همه
            </button>
            <button
              type="button"
              onClick={() => selectAll(false)}
              className="px-3 py-1.5 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl font-medium transition-colors"
            >
              ✕ غیرفعال‌سازی همه
            </button>
          </div>
        </div>

        {/* Modules Grid / Categories */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {Object.entries(filteredGroups).length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              دسترسی‌ای با عبارت جستجو شده یافت نشد.
            </div>
          ) : (
            Object.entries(filteredGroups).map(([groupName, mods]) => {
              const groupState = getGroupState(mods);
              const activeCountInGroup = mods.filter(m => selectedModuleKeys.has(m.key)).length;

              return (
                <div key={groupName} className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/40">
                  <div className="px-4 py-3 bg-gray-100/70 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-gray-800">{groupName}</span>
                      <span className="text-[10px] text-gray-500 font-mono bg-white px-2 py-0.5 rounded-full border">
                        {activeCountInGroup} از {mods.length} فعال
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-500 hidden sm:inline">انتخاب گروهی:</span>
                      <ThreeStateToggle
                        state={groupState}
                        onChange={(val) => toggleGroupModules(mods, val)}
                      />
                    </div>
                  </div>

                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-white">
                    {mods.map(m => {
                      const isEnabled = selectedModuleKeys.has(m.key);
                      return (
                        <div
                          key={m.key}
                          onClick={() => toggleModule(m.key, !isEnabled)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isEnabled
                              ? 'bg-emerald-50/60 border-emerald-200 shadow-sm'
                              : 'bg-gray-50/40 border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                          }`}
                        >
                          <div className="flex-1 pr-1">
                            <span className={`text-xs font-medium block ${isEnabled ? 'text-emerald-950 font-bold' : 'text-gray-700'}`}>
                              {m.label}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono block mt-0.5">
                              {m.key}
                            </span>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <ThreeStateToggle
                              state={isEnabled ? 'on' : 'off'}
                              size="sm"
                              onChange={(val) => toggleModule(m.key, val)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Users Modal */}
      {showUsersModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeRoleObj?.icon}</span>
                <h4 className="font-bold text-sm text-gray-800">
                  کاربران با سمت «{activeRoleObj?.label}» ({roleUsers.length} نفر)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowUsersModal(false)}
                className="text-gray-400 hover:text-gray-600 text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {roleUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  هیچ کاربری با این سمت در سامانه وجود ندارد.
                </div>
              ) : (
                roleUsers.map(user => (
                  <div
                    key={user.id}
                    className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                        {user.full_name?.charAt(0) || user.username?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-800">{user.full_name || user.username}</div>
                        <div className="text-[10px] text-gray-400">نام کاربری: {user.username || user.id}</div>
                      </div>
                    </div>
                    <span className="text-xs bg-white px-2.5 py-1 rounded-lg border text-gray-600 font-medium">
                      🏢 {user.deptName || 'بدون واحد'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowUsersModal(false)}
                className="px-4 py-2 text-xs font-bold bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
