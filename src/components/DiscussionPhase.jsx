import { updateDoc } from 'firebase/firestore';
import { Sun } from 'lucide-react';

import { roomDoc } from '../firebase.js';
import { calculateWinner } from '../gameLogic.js';

export default function DiscussionPhase({ gameState, user, isHost, roomId }) {
  const submitVote = async (targetUid) => {
    const ref = roomDoc(roomId);
    const currentVote = gameState.votes?.[user.uid];
    const newVote = currentVote === targetUid ? null : targetUid;
    await updateDoc(ref, { [`votes.${user.uid}`]: newVote });
  };

  const reveal = async () => {
    try {
      const result = calculateWinner(gameState);
      const ref = roomDoc(roomId);

      // 收集獵人開槍的 log
      const finalLogs = [...(gameState.logs || [])];
      const playerRoles = gameState.currentCards.filter((c) => c.ownerUid);
      const deadHunters = playerRoles.filter(
        (c) => result.dead.includes(c.ownerUid) && c.role.id === 'hunter',
      );
      deadHunters.forEach((hunter) => {
        const targetUid = gameState.votes[hunter.ownerUid];
        const targetPlayer = gameState.players.find((p) => p.uid === targetUid);
        if (targetUid && targetUid !== 'skip') {
          finalLogs.push(
            `【獵人開槍】${hunter.ownerName} 在出局前扣動扳機，帶走了 ${targetPlayer?.name}！`,
          );
        }
      });

      if (result.isTie) {
        await updateDoc(ref, {
          status: 'pk_voting',
          votes: {},
          pkCandidates: result.dead,
          logs: finalLogs,
        });
      } else {
        await updateDoc(ref, {
          status: 'result',
          gameResult: result,
          logs: finalLogs,
        });
      }
    } catch (e) {
      console.error('結算失敗:', e);
    }
  };

  const validVotes = Object.values(gameState.votes || {}).filter((v) => v !== null);
  const allVoted = validVotes.length >= gameState.players.length;

  return (
    <div className="text-center py-10">
      <div className="flex flex-col items-center mb-10">
        <Sun className="text-yellow-500 mb-4" size={56} />
        <h2 className="text-6xl font-black uppercase tracking-tighter">自 由 討 論 與 投 票</h2>
        <p className="text-slate-400 mt-2">你可以一邊討論，一邊點擊下方頭像進行投票</p>
      </div>

      {gameState.settings?.allowSkip && (
        <div className="w-full flex justify-center mb-8">
          <button
            onClick={() => submitVote('skip')}
            className={`px-10 py-4 rounded-3xl border-2 transition-all ${
              gameState.votes?.[user.uid] === 'skip'
                ? 'border-green-500 bg-green-500/20'
                : 'border-slate-800 bg-slate-800/40'
            }`}
          >
            <div className="font-black text-lg text-green-400">棄票</div>
          </button>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto mb-12">
        {gameState.players.map((p) => (
          <button
            key={p.uid}
            onClick={() => submitVote(p.uid)}
            className={`relative p-8 rounded-[2.5rem] border-4 transition-all ${
              gameState.votes?.[user.uid] === p.uid
                ? 'border-yellow-500 bg-yellow-500/20 scale-105'
                : 'border-slate-800 bg-slate-800/40 hover:border-slate-600'
            }`}
          >
            <div className="font-black text-2xl mb-2">{p.name}</div>
          </button>
        ))}
      </div>

      <button
        disabled={!isHost || !allVoted}
        onClick={reveal}
        className={`px-16 py-6 font-black text-2xl rounded-[2.5rem] transition-all shadow-xl
          ${
            isHost
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)] cursor-pointer animate-pulse'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-80'
          }`}
      >
        {!allVoted
          ? `等待投票 (${validVotes.length}/${gameState.players.length})`
          : isHost
          ? '揭曉最終結果'
          : '等待房主公佈...'}
      </button>
    </div>
  );
}
