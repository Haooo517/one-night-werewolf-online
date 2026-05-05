import { updateDoc } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, RotateCcw, LogOut } from 'lucide-react';

import { roomDoc } from '../firebase.js';
import ResultCard from './ResultCard.jsx';

export default function ResultPhase({ gameState, isHost, roomId, onLeaveRoom }) {
  const winnerLabel =
    gameState.gameResult?.winner === 'villager'
      ? '村 民 陣 營 獲 勝'
      : gameState.gameResult?.winner === 'wolf'
      ? '狼 人 陣 營 獲 勝'
      : '皮 匠 單 獨 獲 勝';

  const playAgain = () => updateDoc(roomDoc(roomId), { status: 'lobby' });

  return (
    <div className="animate-in slide-in-from-bottom-10 duration-700">
      <div className="bg-slate-800/50 border-4 border-yellow-500/50 rounded-3xl sm:rounded-[3rem] p-6 sm:p-10 text-center mb-10 sm:mb-12 shadow-[0_0_50px_rgba(234,179,8,0.2)]">
        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-yellow-500 mb-3 sm:mb-4 tracking-tighter">
          {winnerLabel}
        </h2>
        <p className="text-base sm:text-xl lg:text-2xl font-bold text-white mb-4 sm:mb-6">
          {gameState.gameResult?.message}
        </p>

        <div className="flex justify-center gap-2 items-center text-red-400 bg-red-400/10 py-2 px-4 sm:px-6 rounded-full w-fit mx-auto">
          <AlertTriangle size={18} />
          <span className="font-black text-sm sm:text-base">
            {gameState.gameResult?.dead.length > 0
              ? `出局玩家：${gameState.gameResult.dead
                  .map((uid) => gameState.players.find((p) => p.uid === uid)?.name)
                  .join(', ')}`
              : '沒有玩家出局'}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-8 sm:gap-12">
        <div className="w-full">
          <h4 className="text-center text-slate-500 font-black uppercase tracking-[0.3em] mb-4 sm:mb-6 text-sm sm:text-base">
            玩家最終身分
          </h4>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 px-2">
            {gameState.currentCards
              .filter((c) => c.ownerUid)
              .map((c, i) => {
                const finalVoteCount = Object.values(gameState.votes || {}).filter(
                  (vuid) => vuid === c.ownerUid,
                ).length;
                return (
                  <div key={i} className="flex flex-col items-center">
                    <ResultCard
                      card={c}
                      originalCards={gameState.originalCards}
                      doppelgangerRole={gameState.doppelgangerRole}
                    />
                    <div className="mt-2 flex items-center gap-1 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                      <CheckCircle2 size={14} className="text-yellow-500" />
                      <span className="text-sm font-black text-yellow-500">
                        {finalVoteCount} 票
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="w-full max-w-2xl p-5 sm:p-8 bg-slate-800/30 rounded-2xl sm:rounded-[2rem] border border-slate-700/50">
          <h4 className="text-center text-blue-400 font-black uppercase tracking-[0.2em] mb-3 sm:mb-4 text-sm sm:text-base">
            昨晚發生的事
          </h4>
          <div className="space-y-2 text-sm sm:text-base text-slate-300">
            {gameState.logs?.length === 0 && (
              <div className="text-center text-slate-500 italic">沒有動作紀錄</div>
            )}
            {gameState.logs?.map((log, i) => (
              <div
                key={i}
                className="flex gap-2 items-start border-b border-slate-700/30 pb-2"
              >
                <span className="text-blue-500 mt-1.5">●</span>
                <span className="flex-1">{log}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-4xl bg-slate-900/50 p-5 sm:p-8 rounded-2xl sm:rounded-[3rem] border border-slate-800">
          <h4 className="text-center text-slate-500 font-black uppercase tracking-[0.3em] mb-4 sm:mb-6 text-sm sm:text-base">
            中央剩餘牌
          </h4>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 pb-4">
            {gameState.currentCards
              .filter((c) => !c.ownerUid)
              .map((c, i) => (
                <div
                  key={i}
                  className="opacity-70 grayscale-[0.5] hover:grayscale-0 transition-all scale-95"
                >
                  <ResultCard
                    card={c}
                    originalCards={gameState.originalCards}
                    doppelgangerRole={gameState.doppelgangerRole}
                  />
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center">
        {isHost ? (
          <button
            onClick={playAgain}
            className="px-10 sm:px-16 py-4 sm:py-6 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg sm:text-2xl rounded-3xl sm:rounded-[2.5rem] shadow-[0_0_30px_rgba(37,99,235,0.3)] transition-all flex items-center gap-3 active:scale-95"
          >
            <RotateCcw size={24} /> 再來一局
          </button>
        ) : (
          <p className="text-slate-500 text-sm sm:text-base">等待房主決定是否再來一局...</p>
        )}
        <button
          onClick={onLeaveRoom}
          className="px-6 sm:px-8 py-3 sm:py-4 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 font-black text-sm sm:text-base rounded-3xl shadow-xl transition-all flex items-center gap-2 border border-slate-700"
        >
          <LogOut size={16} /> 離開房間
        </button>
      </div>
    </div>
  );
}
