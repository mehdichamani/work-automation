import { useState } from 'react';
import PermissionCentricView from './PermissionCentricView';
import RoleCentricView from './RoleCentricView';
import EntityCentricView from './EntityCentricView';

export default function PermMatrixMode({ matrix, loadMatrix }) {
  const [subTab, setSubTab] = useState('permission-centric');

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2 overflow-x-auto">
        <button
          onClick={() => setSubTab('permission-centric')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
            subTab === 'permission-centric'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span>🔐</span>
          مدیریت بر اساس دسترسی
        </button>
        <button
          onClick={() => setSubTab('role-centric')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
            subTab === 'role-centric'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span>👑</span>
          مدیریت بر اساس سمت (نقش)
        </button>
        <button
          onClick={() => setSubTab('entity-centric')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
            subTab === 'entity-centric'
              ? 'bg-primary-500 text-white shadow-sm'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <span>🏢</span>
          مدیریت بر اساس واحد و شخص
        </button>
      </div>

      {subTab === 'permission-centric' && (
        <PermissionCentricView matrix={matrix} onRefresh={loadMatrix} />
      )}

      {subTab === 'role-centric' && (
        <RoleCentricView matrix={matrix} onRefresh={loadMatrix} />
      )}

      {subTab === 'entity-centric' && (
        <EntityCentricView matrix={matrix} onRefresh={loadMatrix} />
      )}
    </div>
  );
}
