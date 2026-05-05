import { updateDoc } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { roomDoc } from '../firebase.js';
import ResultCard from './ResultCard.jsx';

export default function ResultPhase({ gameState, isHost, roomId }) {
  const winnerLabel =
    gameState.gameResult?.winner === 'villager'
      ? '村 民 陣 營 獲 勝'
      : gameState.gameResult?.winner === 'wolf'
      ? '狼 人 陣 營 獲 勝'
      : '皮 匠 單 獨 獲 勝';

  const playAgain = () =>
    updateDoc(roomDoc(roomId), { status: 'lobby' });

  return (
    <div className="animate-in slide-in-from-bottom-20 duration-1000">
      <div className="bg-slate-800/50 border-4 border-yellow-500/50 rounded-[3rem] p-10 text-center mb-12 shadow-[0_0_50px_rgba(234,179,8,0.2)]">
        <h2 className="text-6xl font-black text-yellow-500 mb-4 tracking-tighter">
          {winnerLabel}
        </h2>
        <p className="text-2xl font-bold text-white mb-6">{gameState.gameResult?.message}</p>

        <div className="flex justify-center gap-2 items-center text-red-400 bg-red-400/10 py-2 px-6 rounded-full w-fit mx-auto">
          <AlertTriangle size={20} />
          <span className="font-black">
            {gameState.gameResult?.dead.length > 0
              ? `出局玩家：${gameState.gameResult.dead
                  .map((uid) => gameState.players.find((p) => p.uid === uid)?.name)
                  .join(', ')}`
              : '沒有玩家出局'}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-12">
        <div className="w-full">
          <h4 className="text-center text-slate-500 font-black uppercase tracking-[0.3em] mb-6">
            玩家最終身分
          </h4>
          <div className="flex flex-wrap justify-center gap-8 px-4">
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

        <div className="w-full max-w-2xl p-8 bg-slate-800/30 rounded-[2rem] border border-slate-700/50">
          <h4 className="text-center text-blue-400 font-black uppercase tracking-[0.2em] mb-4">
            昨晚發生的事
          </h4>
          <div className="space-y-2 text-sm text-slate-400 font-medium">
            {gameState.logs?.map((log, i) => (
              <div
                key={i}
                className="flex gap-2 items-start border-b border-slate-700/30 pb-2 text-base"
              >
                <span className="text-blue-500">●</span> {log}
              </div>
            ))}
          </div>
        </div>

        <div className="w-full max-w-4xl bg-slate-900/50 p-8 rounded-[3rem] border border-slate-800">
          <h4 className="text-center text-slate-500 font-black uppercase tracking-[0.3em] mb-6">
            中央剩餘牌
          </h4>
          <div className="flex flex-wrap justify-center gap-8 pb-4">
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

      <div className="mt-20 flex flex-col sm:flex-row gap-6 justify-center">
        {isHost && (
          <button
            onClick={playAgain}
            className="px-16 py-6 bg-slate-800 hover:bg-slate-700 text-white font-black text-2xl rounded-[2.5rem] shadow-xl transition-all"
          >
            再來一局
          </button>
        )}
      </div>
    </div>
  );
}
