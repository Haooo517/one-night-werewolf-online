import { useState } from 'react';
import { setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { roomDoc } from '../firebase.js';

export default function Home({ user, playerName, setPlayerName, setRoomId, showToast }) {
  const [inputRoomId, setInputRoomId] = useState('');

  const createRoom = async () => {
    if (!user) return;
    if (!playerName) return showToast('請輸入你的名字');
    const newId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ref = roomDoc(newId);
    await setDoc(ref, {
      id: newId,
      hostId: user.uid,
      status: 'lobby',
      players: [{ uid: user.uid, name: playerName, isHost: true }],
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
  };

  const joinRoom = async () => {
    if (!user) return;
    if (!playerName || !inputRoomId) return showToast('請輸入名字與代碼');
    const id = inputRoomId.toUpperCase();
    const ref = roomDoc(id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return showToast('房間不存在');
    const data = snap.data();
    if (data.status !== 'lobby') return showToast('遊戲已在進行中');
    if (!data.players.some((p) => p.uid === user.uid)) {
      await updateDoc(ref, {
        players: arrayUnion({ uid: user.uid, name: playerName, isHost: false }),
      });
    }
    setRoomId(id);
  };

  return (
    <div className="max-w-md mx-auto py-12 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="text-center">
        <h2 className="text-4xl font-black mb-4 tracking-tighter uppercase font-bold">
          一 夜 終 極 狼 人
        </h2>
        <p className="text-slate-400 font-medium text-base">輸入暱稱並建立或加入房間來開始遊戲</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-500 uppercase tracking-widest ml-2">
            你的暱稱
          </label>
          <input
            className="w-full bg-slate-800 border-2 border-slate-700 rounded-3xl px-6 py-4 focus:border-blue-500 outline-none transition-all text-white font-bold"
            placeholder="輸入你的名字..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={createRoom}
            className="p-5 bg-blue-600 hover:bg-blue-500 rounded-3xl font-black text-lg shadow-xl shadow-blue-900/30 transition-all active:scale-95"
          >
            建立房間
          </button>
          <div className="flex flex-col gap-2">
            <input
              className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-2xl px-4 py-2 text-center font-black uppercase text-base text-blue-400 outline-none"
              placeholder="代碼"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
              maxLength={4}
            />
            <button
              onClick={joinRoom}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-sm uppercase tracking-widest"
            >
              加入房間
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
