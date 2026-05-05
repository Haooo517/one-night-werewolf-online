import { updateDoc } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

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
      await updateDoc(ref, { status: 'result', gameResult: result });
    } catch (e) {
      console.error('結算失敗:', e);
    }
  };

  // PK 階段只有非候選人能投票，所以「投票完成」的計算改成 = 非候選人數
  const nonCandidateCount = gameState.players.filter(
    (p) => !gameState.pkCandidates.includes(p.uid),
  ).length;
  const validVotes = Object.values(gameState.votes || {}).filter((v) => v !== null && v !== undefined);
  const allVoted = validVotes.length >= nonCandidateCount;
  const myVote = gameState.votes?.[user.uid];

  return (
    <div className="text-center py-6 sm:py-10 animate-in fade-in duration-500">
      <div className="flex flex-col items-center mb-8 sm:mb-10">
        <AlertTriangle className="text-red-500 mb-3 sm:mb-4 animate-pulse" size={64} />
        <h2 className="text-3xl sm:text-5xl font-black uppercase text-red-500 tracking-tighter">
          P K 二 次 投 票
        </h2>
        <p className="text-slate-400 mt-2 text-sm sm:text-base lg:text-lg max-w-md">
          出現平票！請由<span className="text-yellow-400">非候選人</span>對候選人進行最終投票
        </p>
        <div className="flex gap-2 mt-4 flex-wrap justify-center">
          {gameState.pkCandidates.map((uid) => (
            <span
              key={uid}
              className="bg-red-500/20 text-red-400 px-3 sm:px-4 py-1 rounded-full font-black text-sm sm:text-base"
            >
              {gameState.players.find((p) => p.uid === uid)?.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-3xl mx-auto mb-10 sm:mb-12">
        {gameState.players.map((p) => {
          const isCandidate = gameState.pkCandidates.includes(p.uid);
          const canVote = !gameState.pkCandidates.includes(user.uid);
          const voteCount = Object.values(gameState.votes || {}).filter((v) => v === p.uid).length;
          const hasVoted = gameState.votes?.[p.uid] !== null && gameState.votes?.[p.uid] !== undefined;

          return (
            <button
              key={p.uid}
              disabled={!isCandidate || !canVote}
              onClick={() => submitVote(p.uid)}
              className={`relative p-4 sm:p-6 lg:p-8 rounded-3xl sm:rounded-[2rem] border-4 transition-all
                ${!isCandidate ? 'opacity-30 grayscale' : 'border-slate-800 bg-slate-800/40'}
                ${
                  myVote === p.uid
                    ? 'border-red-500 bg-red-500/20 scale-105 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                    : ''
                }
                ${!canVote && isCandidate ? 'cursor-not-allowed' : 'hover:border-red-400'}`}
            >
              <div className="font-black text-lg sm:text-xl lg:text-2xl mb-2">{p.name}</div>
              <div className="inline-flex items-center justify-center bg-red-500 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full font-black text-xl sm:text-2xl">
                {voteCount}
              </div>
              {!isCandidate && hasVoted && (
                <div className="absolute -top-2 -right-2">
                  <CheckCircle2 size={20} className="text-green-400" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        disabled={!isHost || !allVoted}
        onClick={reveal}
        className={`px-10 sm:px-16 py-4 sm:py-6 font-black text-lg sm:text-2xl rounded-3xl sm:rounded-[2.5rem] transition-all shadow-xl
          ${
            isHost && allVoted
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)] cursor-pointer animate-pulse'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-80'
          }`}
      >
        {!allVoted
          ? `等待投票 (${validVotes.length}/${nonCandidateCount})`
          : isHost
          ? '揭曉 PK 結果'
          : '等待房主公佈...'}
      </button>
    </div>
  );
}
