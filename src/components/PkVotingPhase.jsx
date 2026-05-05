import { updateDoc } from 'firebase/firestore';
import { AlertTriangle } from 'lucide-react';

import { roomDoc } from '../firebase.js';
import { calculateWinner } from '../gameLogic.js';

export default function PkVotingPhase({ gameState, user, isHost, roomId }) {
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
      // PK 階段直接結算，不再進入下一輪 PK
      await updateDoc(ref, { status: 'result', gameResult: result });
    } catch (e) {
      console.error('結算失敗:', e);
    }
  };

  const validVotes = Object.values(gameState.votes || {}).filter((v) => v !== null);
  const allVoted = validVotes.length >= gameState.players.length;

  return (
    <div className="text-center py-10 animate-in fade-in duration-500">
      <div className="flex flex-col items-center mb-10">
        <AlertTriangle className="text-red-500 mb-4 animate-pulse" size={64} />
        <h2 className="text-5xl font-black uppercase text-red-500">P K 二 次 投 票</h2>
        <p className="text-slate-400 mt-2 text-lg">
          出現平票！現在請由【非候選人】對以下候選人進行最終投票：
        </p>
        <div className="flex gap-2 mt-4">
          {gameState.pkCandidates.map((uid) => (
            <span
              key={uid}
              className="bg-red-500/20 text-red-400 px-4 py-1 rounded-full font-black"
            >
              {gameState.players.find((p) => p.uid === uid)?.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto mb-12">
        {gameState.players.map((p) => {
          const isCandidate = gameState.pkCandidates.includes(p.uid);
          const canVote = !gameState.pkCandidates.includes(user.uid);
          const voteCount = Object.values(gameState.votes || {}).filter(
            (v) => v === p.uid,
          ).length;

          return (
            <button
              key={p.uid}
              disabled={!isCandidate || !canVote}
              onClick={() => submitVote(p.uid)}
              className={`relative p-8 rounded-[2.5rem] border-4 transition-all
                ${!isCandidate ? 'opacity-20 grayscale' : 'border-slate-800 bg-slate-800/40'}
                ${
                  gameState.votes?.[user.uid] === p.uid
                    ? 'border-red-500 bg-red-500/20 scale-105 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                    : ''
                }
                ${!canVote && isCandidate ? 'cursor-not-allowed' : 'hover:border-red-400'}`}
            >
              <div className="font-black text-2xl mb-2">{p.name}</div>
              <div className="inline-flex items-center justify-center bg-red-500 text-white w-12 h-12 rounded-full font-black text-2xl">
                {voteCount}
              </div>
            </button>
          );
        })}
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
          ? '揭曉 PK 結果'
          : '等待房主公佈...'}
      </button>
    </div>
  );
}
