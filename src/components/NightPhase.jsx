import { useMemo } from 'react';
import { findRole } from '../constants.js';
import NightActionScreen from './NightActionScreen.jsx';

export default function NightPhase(props) {
  const { gameState, user, timer } = props;
  const myOriginalRole = gameState.originalCards.find(
    (c) => c.ownerUid === user?.uid,
  )?.role;
  const currentActiveRoleId = gameState.nightOrder[gameState.activeRolePriority];

  const isMyTurn = useMemo(() => {
    if (gameState.status !== 'night' || !myOriginalRole) return false;
    if (myOriginalRole.id === 'doppelganger') {
      if (currentActiveRoleId === 'doppelganger') return true;
      if (gameState.doppelgangerRole === currentActiveRoleId) return true;
    }
    return myOriginalRole.id === currentActiveRoleId;
  }, [
    gameState.status,
    myOriginalRole,
    currentActiveRoleId,
    gameState.doppelgangerRole,
  ]);

  return (
    <div className="flex flex-col items-center py-6 animate-in zoom-in-95 duration-700">
      <div className="mb-4 bg-blue-500/20 px-4 py-1 rounded-full text-blue-400 text-xs font-black">
        第 {gameState.activeRolePriority + 1} / {gameState.nightOrder.length} 位角色行動中
      </div>

      <h2 className="text-3xl font-black text-white mb-2">
        現在是 【{findRole(currentActiveRoleId)?.name}】 時間
      </h2>

      <div className="text-5xl font-black text-red-500 mb-8 animate-pulse">
        {timer ? timer : gameState.settings?.nightDuration}s
      </div>

      <div className="mb-12 p-8 bg-slate-800/80 rounded-[2.5rem] border border-slate-700 flex flex-col items-center shadow-2xl">
        <p className="text-[14px] font-black text-slate-500 mb-4 uppercase tracking-[0.3em]">
          你的初始身分
        </p>
        <div className="text-3xl font-black text-blue-400 mb-4 tracking-tighter">
          {myOriginalRole?.name}
        </div>
        <p className="text-center text-xs text-slate-400 max-w-xs italic leading-relaxed px-4 opacity-80">
          {myOriginalRole?.description}
        </p>
      </div>

      {isMyTurn ? (
        <NightActionScreen {...props} myOriginalRole={myOriginalRole} />
      ) : (
        <div className="p-10 border-2 border-slate-800 rounded-3xl bg-slate-900/50 text-slate-500">
          請閉上眼，靜待指令...
        </div>
      )}
    </div>
  );
}
