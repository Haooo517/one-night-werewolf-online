import { Info, Plus, Minus } from 'lucide-react';
import { updateDoc } from 'firebase/firestore';
import { roomDoc } from '../firebase.js';

export default function RoleCounter({ role, gameState, isHost, roomId }) {
  const count = gameState.selectedRoles.filter((r) => r === role.id).length;

  const updateRoles = async (delta) => {
    if (!isHost) return;
    let next = [...gameState.selectedRoles];
    if (delta > 0) {
      if (role.fixedCount) for (let i = 0; i < role.fixedCount; i++) next.push(role.id);
      else next.push(role.id);
    } else {
      if (role.fixedCount) next = next.filter((r) => r !== role.id);
      else {
        const idx = next.indexOf(role.id);
        if (idx > -1) next.splice(idx, 1);
      }
    }
    await updateDoc(roomDoc(roomId), { selectedRoles: next });
  };

  return (
    <div
      className={`p-3 rounded-2xl border flex justify-between items-center transition-all
        ${count > 0 ? 'border-blue-500 bg-blue-600/10' : 'border-slate-800 brightness-50 grayscale-[0.5]'}
        relative hover:z-[150] hover:brightness-100 hover:grayscale-0 group/card`}
    >
      <div className="flex flex-col group relative">
        <div className="flex items-center gap-1.5 cursor-help">
          <span className="font-bold text-base">{role.name}</span>
          {count > 0 && (
            <span className="text-sm text-blue-400 font-black">x{count}</span>
          )}
          <Info size={14} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
        </div>
        <div className="absolute left-0 top-full mt-1 w-56 p-3 bg-slate-900 border border-blue-500/50 rounded-2xl text-[14px] text-slate-300 leading-snug shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-[200] backdrop-blur-xl">
          <p className="font-black text-blue-400 mb-0.5 flex items-center gap-1">
            <Info size={14} /> 角色能力
          </p>
          {role.description}
          <div className="absolute left-6 bottom-full w-2 h-2 bg-slate-900 border-l border-t border-blue-500/50 rotate-45 translate-y-1"></div>
        </div>
      </div>

      {isHost && (
        <div className="flex gap-2 items-center">
          {count > 0 && (
            <button
              onClick={() => updateRoles(-1)}
              className="p-1.5 bg-slate-800 rounded-lg hover:text-red-400 transition-colors shadow-md"
            >
              <Minus size={12} />
            </button>
          )}
          {(role.multi || count === 0) && (
            <button
              onClick={() => updateRoles(1)}
              className="p-1.5 bg-slate-800 rounded-lg hover:text-green-400 transition-colors shadow-md"
            >
              <Plus size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
