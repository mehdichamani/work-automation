import { useState, useMemo } from 'react';
import ThreeStateToggle from './ThreeStateToggle';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function PermissionCentricView({ matrix, onRefresh }) {
  const [selectedModule, setSelectedModule] = useState(null);
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  const [loadingMap, setLoadingMap] = useState({});
  const [bulkLoading, setBulkLoading] = useState({});
  const [permSearch, setPermSearch] = useState('');
  const [deptSearch, setDeptSearch] = useState('');

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
    if (!deptSearch) return null;
    const q = deptSearch.toLowerCase();
    return (matrix?.departments || []).filter(d =>
      d.name.toLowerCase().includes(q)
    );
  }, [matrix, deptSearch]);

  const getUserPermState = (userId, moduleKey) => {
    const userPerms = matrix?.userPermMap?.[userId] || {};
    if (moduleKey in userPerms) return userPerms[moduleKey] ? 'on' : 'off';
    const dept = (matrix?.departments || []).find(d =>
      (matrix?.deptUsers?.[d.id] || []).some(u => u.id === userId)
    );
    if (!dept) return 'off';
    const deptPerm = matrix?.deptPermMap?.[dept.id]?.[moduleKey];
    return deptPerm ? 'on' : 'off';
  };

  const getDeptPermState = (deptId, moduleKey) => {
    const deptPerm = matrix.deptPermMap?.[deptId]?.[moduleKey];
    return deptPerm ? 'on' : 'off';
  };

  const getDeptSwitchState = (deptId, moduleKey) => {
    const users = matrix.deptUsers?.[deptId] || [];
    if (users.length === 0) return 'off';
    const states = users.map(u => getUserPermState(u.id, moduleKey));
    const onCount = states.filter(s => s === 'on').length;
    if (onCount === users.length) return 'on';
    if (onCount === 0) return 'off';
    return 'indeterminate';
  };

  const toggleDeptSwitch = async (deptId, moduleKey, newState) => {
    const deptKey = `${deptId}-${moduleKey}`;
    setBulkLoading(prev => ({ ...prev, [deptKey]: true }));
    try {
      await api.put('/permissions/bulk-toggle-dept', {
        department_id: deptId,
        module_key: moduleKey,
        is_enabled: newState,
      });
      toast.success(newState ? 'دسترسی برای همه اعضا فعال شد' : 'دسترسی برای همه اعضا غیرفعال شد');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا در تغییر دسترسی');
    } finally {
      setBulkLoading(prev => ({ ...prev, [deptKey]: false }));
    }
  };

  const toggleAllUsers = async (newState) => {
    const deptKeys = [];
    (matrix.departments || []).forEach(dept => {
      const deptUsersList = matrix.deptUsers?.[dept.id] || [];
      if (deptUsersList.length > 0) {
        deptKeys.push(`${dept.id}-${selectedModule}`);
      }
    });
    const results = await Promise.allSettled(
      deptKeys.map(key => {
        const [deptId] = key.split('-');
        return toggleDeptSwitch(deptId, selectedModule, newState);
      })
    );
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0 && failed.length === results.length) {
      toast.error('خطا در تغییر دسترسی برای همه کاربران');
    } else {
      toast.success(newState ? 'دسترسی فعال شد برای همه کاربران' : 'دسترسی غیرفعال شد برای همه کاربران');
      onRefresh();
    }
  };

  const allUserPermStates = useMemo(() => {
    if (!selectedModule) return [];
    const states = [];
    (matrix.departments || []).forEach(dept => {
      (matrix.deptUsers?.[dept.id] || []).forEach(user => {
        states.push(getUserPermState(user.id, selectedModule));
      });
    });
    return states;
  }, [matrix, selectedModule]);

  const selectAllState = useMemo(() => {
    const states = allUserPermStates;
    if (states.length === 0) return 'off';
    const onCount = states.filter(s => s === 'on').length;
    if (onCount === states.length) return 'on';
    if (onCount === 0) return 'off';
    return 'indeterminate';
  }, [allUserPermStates]);

  const toggleSelectAll = (newState) => {
    toggleAllUsers(newState);
  };

  const toggleUserPerm = async (userId, moduleKey, newState) => {
    const userKey = `${userId}-${moduleKey}`;
    setLoadingMap(prev => ({ ...prev, [userKey]: true }));
    try {
      await api.put('/permissions/toggle-user', {
        user_id: userId,
        module_key: moduleKey,
        is_enabled: newState,
      });
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطا');
    } finally {
      setLoadingMap(prev => ({ ...prev, [userKey]: false }));
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
            <div className="border-b pb-4">
              <h3 className="font-bold text-base text-gray-800">
                {selectedModuleObj?.label || selectedModule}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                واحدها و اعضای دارای این دسترسی
              </p>
            </div>

            <div className="mb-1">
              <input
                type="text"
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                placeholder="جستجوی واحد..."
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-primary-400 transition-colors"
              />
            </div>

            {selectedModule && (
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl mb-3">
                <span className="text-xs font-medium text-gray-700">انتخاب همه کاربران</span>
                <ThreeStateToggle
                  state={selectAllState}
                  loading={bulkLoading['select-all']}
                  onChange={toggleSelectAll}
                />
              </div>
            )}

            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {(filteredDepartments || matrix.departments || []).map(dept => {
                const deptUsersList = matrix.deptUsers?.[dept.id] || [];
                if (deptUsersList.length === 0) return null;
                const isExpanded = expandedDepts.has(dept.id);
                const deptSwitchState = getDeptSwitchState(dept.id, selectedModule);
                const deptKey = `${dept.id}-${selectedModule}`;

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
                          <span className="text-[10px] text-gray-400">{deptUsersList.length} نفر</span>
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <ThreeStateToggle
                          state={deptSwitchState}
                          loading={bulkLoading[deptKey]}
                          onChange={(val) => toggleDeptSwitch(dept.id, selectedModule, val)}
                        />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-white divide-y">
                        {deptUsersList.map(user => {
                          const userState = getUserPermState(user.id, selectedModule);
                          const userKey = `${user.id}-${selectedModule}`;
                          return (
                            <div key={user.id} className="px-6 py-2.5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xs font-bold">
                                  {user.full_name?.charAt(0)}
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-gray-800">{user.full_name}</span>
                                  <span className="text-[10px] text-gray-400 mr-2 font-mono">({user.id})</span>
                                </div>
                              </div>
                              <ThreeStateToggle
                                state={userState}
                                loading={loadingMap[userKey]}
                                size="sm"
                                onChange={(val) => toggleUserPerm(user.id, selectedModule, val)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
