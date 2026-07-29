import { useState, useMemo } from 'react';
import ThreeStateToggle from './ThreeStateToggle';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function EntityCentricView({ matrix, onRefresh }) {
  const [selectedType, setSelectedType] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedDepts, setExpandedDepts] = useState(new Set());
  const [loadingMap, setLoadingMap] = useState({});
  const [bulkLoading, setBulkLoading] = useState({});
  const [entitySearch, setEntitySearch] = useState('');
  const [permSearch, setPermSearch] = useState('');

  const groups = useMemo(() => {
    const g = {};
    (matrix.modules || []).forEach(m => {
      if (!g[m.group]) g[m.group] = [];
      g[m.group].push(m);
    });
    return g;
  }, [matrix]);

  const filteredModules = useMemo(() => {
    if (!permSearch) return null;
    const q = permSearch.toLowerCase();
    return (matrix.modules || []).filter(m =>
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
    if (!entitySearch) return null;
    const q = entitySearch.toLowerCase();
    return (matrix.departments || []).filter(d =>
      d.name.toLowerCase().includes(q)
    );
  }, [matrix, entitySearch]);

  const getUserPermState = (userId, moduleKey) => {
    const userPerms = matrix.userPermMap?.[userId] || {};
    if (moduleKey in userPerms) return userPerms[moduleKey] ? 'on' : 'off';
    const dept = (matrix.departments || []).find(d =>
      (matrix.deptUsers?.[d.id] || []).some(u => u.id === userId)
    );
    if (!dept) return 'off';
    const deptPerm = matrix.deptPermMap?.[dept.id]?.[moduleKey];
    return deptPerm ? 'on' : 'off';
  };

  const getDeptPermState = (deptId, moduleKey) => {
    const users = matrix.deptUsers?.[deptId] || [];
    if (users.length === 0) return 'off';
    const states = users.map(u => getUserPermState(u.id, moduleKey));
    const onCount = states.filter(s => s === 'on').length;
    if (onCount === users.length) return 'on';
    if (onCount === 0) return 'off';
    return 'indeterminate';
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

  const toggleDeptPermBulk = async (deptId, moduleKey, newState) => {
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
      toast.error(err.response?.data?.error || 'خطا');
    } finally {
      setBulkLoading(prev => ({ ...prev, [deptKey]: false }));
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

  const selectEntity = (type, id) => {
    setSelectedType(type);
    setSelectedId(id);
  };

  const isUserSelected = selectedType === 'user';
  const isDeptSelected = selectedType === 'dept';

  let selectedEntityName = '';
  if (isUserSelected) {
    for (const dept of (matrix.departments || [])) {
      const user = (matrix.deptUsers?.[dept.id] || []).find(u => u.id === selectedId);
      if (user) { selectedEntityName = user.full_name; break; }
    }
  } else if (isDeptSelected) {
    const dept = (matrix.departments || []).find(d => d.id === selectedId);
    if (dept) selectedEntityName = dept.name;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Right sidebar: Departments & users tree */}
      <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm p-4 max-h-[75vh] overflow-y-auto flex flex-col gap-3">
        <div>
          <input
            type="text"
            value={entitySearch}
            onChange={(e) => setEntitySearch(e.target.value)}
            placeholder="جستجوی واحد..."
            className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-primary-400 transition-colors"
          />
        </div>
        <h4 className="font-bold text-sm text-gray-700 border-b pb-2">واحدها و اعضا</h4>
        <div className="space-y-2 overflow-y-auto flex-1">
          {(filteredDepartments || matrix.departments || []).map(dept => {
            const users = matrix.deptUsers?.[dept.id] || [];
            const isExpanded = expandedDepts.has(dept.id);
            const isDeptActive = isDeptSelected && selectedId === dept.id;

            return (
              <div key={dept.id}>
                <div
                  className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                    isDeptActive
                      ? 'bg-primary-500 text-white shadow-md'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                  onClick={() => selectEntity('dept', dept.id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggleDeptExpand(dept.id); }}
                    >
                      ▶
                    </span>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isDeptActive ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-700'
                    }`}>
                      {dept.name.charAt(0)}
                    </div>
                    <span className="text-xs font-bold">{dept.name}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isDeptActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {users.length}
                  </span>
                </div>

                {isExpanded && (
                  <div className="mr-4 mt-0.5 space-y-0.5">
                    {users.map(user => {
                      const isUserActive = isUserSelected && selectedId === user.id;
                      return (
                        <div
                          key={user.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-xs transition-all ${
                            isUserActive
                              ? 'bg-primary-500 text-white'
                              : 'hover:bg-gray-50 text-gray-600'
                          }`}
                          onClick={() => selectEntity('user', user.id)}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isUserActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {user.full_name?.charAt(0)}
                          </div>
                          <span className="truncate">{user.full_name}</span>
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

      {/* Left body: Permissions with toggles */}
      <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm p-6">
        {!selectedType ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            یک واحد یا شخص را از سایدبار انتخاب کنید
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-b pb-4">
              <h3 className="font-bold text-base text-gray-800">
                {isUserSelected ? 'کاربر:' : 'واحد:'} {selectedEntityName}
              </h3>
              <p className="text-[11px] text-gray-400 mt-1">
                {isUserSelected
                  ? 'دسترسی‌های مستقیم این کاربر'
                  : 'تغییر سوئیچ دسترسی، برای تمام اعضای واحد اعمال می‌شود'}
              </p>
            </div>

            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              <div className="mb-1">
                <input
                  type="text"
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  placeholder="جستجوی دسترسی..."
                  className="w-full px-3 py-2 border rounded-xl text-xs outline-none focus:border-primary-400 transition-colors"
                />
              </div>
              {Object.entries(filteredGroups || groups).map(([group, mods]) => (
                <div key={group} className="border rounded-2xl overflow-hidden bg-gray-50/30">
                  <div className="bg-gray-100/60 px-4 py-2 border-b">
                    <span className="font-bold text-xs text-gray-600">{group}</span>
                  </div>
                  <div className="divide-y bg-white">
                    {mods.map(m => {
                      let state, loading;
                      if (isUserSelected) {
                        state = getUserPermState(selectedId, m.key);
                        loading = loadingMap[`${selectedId}-${m.key}`];
                        return (
                          <div key={m.key} className="flex justify-between items-center px-4 py-3 hover:bg-gray-50/50 transition-colors">
                            <span className="text-xs text-gray-700">{m.label}</span>
                            <ThreeStateToggle
                              state={state}
                              loading={loading}
                              size="sm"
                              onChange={(val) => toggleUserPerm(selectedId, m.key, val)}
                            />
                          </div>
                        );
                      } else {
                        state = getDeptPermState(selectedId, m.key);
                        loading = bulkLoading[`${selectedId}-${m.key}`];
                        return (
                          <div key={m.key} className="flex justify-between items-center px-4 py-3 hover:bg-gray-50/50 transition-colors">
                            <span className="text-xs text-gray-700">{m.label}</span>
                            <ThreeStateToggle
                              state={state}
                              loading={loading}
                              size="sm"
                              onChange={(val) => toggleDeptPermBulk(selectedId, m.key, val)}
                            />
                          </div>
                        );
                      }
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
