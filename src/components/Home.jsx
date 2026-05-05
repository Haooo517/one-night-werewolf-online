import { useState } from 'react';
import { setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { LogIn, Plus } from 'lucide-react';
import { roomDoc } from '../firebase.js';

export default function Home({ user, playerName, setPlayerName, setRoomId, showToast }) {
  const [inputRoomId, setInputRoomId] = useState('');
  const [busy, setBusy] = useState(false);

  const createRoom = async () => {
    if (!user) return;
    if (!playerName.trim()) return showToast('請輸入你的名字');
    setBusy(true);
    try {
      const newId = Math.random().toString(36).substring(2, 6).toUpperCase();
      const ref = roomDoc(newId);
      await setDoc(ref, {
        id: newId,
        hostId: user.uid,
        status: 'lobby',
        players: [{ uid: user.uid, name: playerName.trim(), isHost: true }],
        selectedRoles: ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'villager'],
        currentCards: [],
        originalCards: [],
        nightOrder: [],
        votes: {},
        activeRolePriority: 0,
        doppelgangerRole: null,
        settings: { nightDuration: 20, tieRule: 'killAll', allowSkip: false },
        messages: [],
        createdAt: Date.now(),
      });
      setRoomId(newId);
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    if (!user) return;
    if (!playerName.trim() || !inputRoomId) return showToast('請輸入名字與代碼');
    setBusy(true);
    try {
      const id = inputRoomId.toUpperCase().trim();
      if (id.length !== 4) return showToast('房號是 4 個字');
      const ref = roomDoc(id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return showToast('房間不存在');
      const data = snap.data();
      if (data.status !== 'lobby') return showToast('遊戲已在進行中');
      if (!data.players.some((p) => p.uid === user.uid)) {
        await updateDoc(ref, {
          players: arrayUnion({
            uid: user.uid,
            name: playerName.trim(),
            isHost: false,
          }),
        });
      }
      setRoomId(id);
    } finally {
      setBusy(false);
    }
  };

  const handleEnter = (e) => {
    if (e.key === 'Enter' && playerName.trim()) {
      if (inputRoomId.length === 4) joinRoom();
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 sm:py-16 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-3">
        <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase">
          一 夜 終 極 狼 人
        </h2>
        <p className="text-slate-400 text-sm sm:text-base">
          輸入暱稱並建立或加入房間來開始遊戲
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-black text-slate-500 uppercase tracking-widest ml-2">
            你的暱稱
          </label>
          <input
            className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl sm:rounded-3xl px-5 sm:px-6 py-3.5 sm:py-4 focus:border-blue-500 outline-none transition-all text-white font-bold text-base"
            placeholder="輸入你的名字..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={handleEnter}
            maxLength={20}
          />
        </div>

        <button
          onClick={createRoom}
          disabled={busy || !playerName.trim()}
          className="w-full p-4 sm:p-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl sm:rounded-3xl font-black text-base sm:text-lg shadow-xl shadow-blue-900/30 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <Plus size={20} /> 建立新房間
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-xs text-slate-600 font-black uppercase tracking-widest">
            或
          </span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-2xl px-4 py-3 text-center font-black uppercase text-lg tracking-[0.3em] text-blue-400 outline-none focus:border-blue-500 transition-all"
            placeholder="ABCD"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
            onKeyDown={handleEnter}
            maxLength={4}
          />
          <button
            onClick={joinRoom}
            disabled={busy || !playerName.trim() || inputRoomId.length !== 4}
            className="px-5 sm:px-6 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-bold text-sm uppercase tracking-widest flex items-center gap-2 shrink-0"
          >
            <LogIn size={16} /> 加入
          </button>
        </div>
      </div>
    </div>
  );
}
