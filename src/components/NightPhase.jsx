import { useMemo } from 'react';
import { Moon } from 'lucide-react';
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

  const totalDuration = gameState.settings?.nightDuration || 20;
  const initialDuration =
    gameState.activeRolePriority === 0 && gameState.nightOrder[0] === 'doppelganger'
      ? totalDuration * 2
      : totalDuration;
  const progress = Math.max(0, Math.min(1, (timer || 0) / initialDuration));

  return (
    <div className="flex flex-col items-center py-4 sm:py-6 animate-in zoom-in-95 duration-500">
      <div className="mb-3 sm:mb-4 bg-blue-500/20 px-4 py-1 rounded-full text-blue-400 text-xs font-black inline-flex items-center gap-2">
        <Moon size={12} />
        第 {gameState.activeRolePriority + 1} / {gameState.nightOrder.length} 位角色行動中
      </div>

      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white mb-3 text-center px-2">
        現在是 【{findRole(currentActiveRoleId)?.name}】 時間
      </h2>

      {/* Timer with progress ring-ish bar */}
      <div className="w-full max-w-xs mb-6 sm:mb-8">
        <div className="text-center text-5xl sm:text-6xl font-black text-red-500 mb-2 animate-pulse tabular-nums">
          {timer || initialDuration}s
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-8 sm:mb-12 p-5 sm:p-8 bg-slate-800/80 rounded-2xl sm:rounded-[2.5rem] border border-slate-700 flex flex-col items-center shadow-2xl w-full max-w-md">
        <p className="text-xs sm:text-sm font-black text-slate-500 mb-2 sm:mb-4 uppercase tracking-[0.3em]">
          你的初始身分
        </p>
        <div className="text-2xl sm:text-3xl font-black text-blue-400 mb-2 sm:mb-4 tracking-tighter">
          {myOriginalRole?.name}
        </div>
        <p className="text-center text-xs sm:text-sm text-slate-400 italic leading-relaxed px-2 opacity-80">
          {myOriginalRole?.description}
        </p>
      </div>

      {isMyTurn ? (
        <NightActionScreen {...props} myOriginalRole={myOriginalRole} />
      ) : (
        <div className="p-8 sm:p-10 border-2 border-slate-800 rounded-2xl sm:rounded-3xl bg-slate-900/50 text-slate-500 text-center max-w-md">
          請閉上眼，靜待指令...
        </div>
      )}
    </div>
  );
}
