import { Info } from 'lucide-react';
import { findRole } from '../constants.js';

export default function RoleListSidebar({ gameState }) {
  const uniqueRoleIds = [...new Set(gameState.selectedRoles)];

  return (
    <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 p-5 rounded-3xl shadow-2xl">
      <h4 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <Info size={14} className="text-blue-500" /> 本局角色名單
      </h4>
      <div className="space-y-2.5">
        {uniqueRoleIds.map((roleId) => {
          const role = findRole(roleId);
          const count = gameState.selectedRoles.filter((id) => id === roleId).length;
          return (
            <div key={roleId} className="flex justify-between items-center group">
              <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                {role?.name}
              </span>
              <span className="text-xs font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                x{count}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-500 font-bold">
        共 {gameState.selectedRoles.length} 張牌
      </div>
    </div>
  );
}
