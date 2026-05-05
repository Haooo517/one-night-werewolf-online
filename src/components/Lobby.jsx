import { useState } from 'react';
import { Users, UserCircle, ArrowRight } from 'lucide-react';
import { updateDoc } from 'firebase/firestore';

import { ALL_ROLES } from '../constants.js';
import { roomDoc } from '../firebase.js';
import { buildInitialDeck } from '../gameLogic.js';
import RoleCounter from './RoleCounter.jsx';

export default function Lobby({ gameState, user, isHost, roomId, showToast }) {
  const [activeTab, setActiveTab] = useState('roles');

  const startGame = async () => {
    if (!isHost) return;
    const { players, selectedRoles } = gameState;
    if (selectedRoles.length !== players.length + 3) {
      return showToast(`角色數量不正確！需要 ${players.length + 3} 張角色牌。`);
    }

    const { cards, nightOrder } = buildInitialDeck(players, selectedRoles);
    const startTime = Date.now();
    const ref = roomDoc(roomId);
    await updateDoc(ref, {
      status: 'night',
      originalCards: cards,
      currentCards: cards,
      nightOrder,
      activeRolePriority: 0,
      logs: [],
      doppelgangerRole: null,
      phaseEndTime:
        startTime +
        (gameState.settings?.nightDuration || 20) *
          (nightOrder[0] === 'doppelganger' ? 2000 : 1000),
    });
  };

  const setSetting = (key, value) => {
    if (!isHost) return;
    return updateDoc(roomDoc(roomId), { [`settings.${key}`]: value });
  };

  const onClickRoomCode = () => {
    navigator.clipboard.writeText(gameState.id);
    showToast('房號已複製！');
  };

  return (
    <>
      <div className="text-center mb-12">
        <p className="text-slate-500 text-sm font-black uppercase tracking-[0.3em] mb-2">
          Room Code
        </p>
        <h2
          onClick={onClickRoomCode}
          className="text-xl sm:text-5xl font-black text-blue-500 tracking-[0.1em] drop-shadow-[0_0_20px_rgba(59,130,246,0.2)] cursor-pointer"
        >
          {gameState.id}
        </h2>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="bg-slate-800/40 p-5 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-sm">
          <h3 className="text-lg font-black mb-4 flex items-center gap-2">
            <Users className="text-blue-400" size={18} />
            玩家名單 ({gameState.players.length})
          </h3>
          <div className="space-y-2">
            {gameState.players.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-700 shadow-inner group transition-all"
              >
                <div className="w-8 h-8 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400 font-black text-xs">
                  {p.name[0]}
                </div>
                <span className="font-bold text-base text-slate-200">
                  {p.name}{' '}
                  {p.uid === user?.uid && (
                    <span className="text-blue-500/80 text-[14px] ml-1">(你)</span>
                  )}
                </span>
                {p.uid === gameState.hostId && (
                  <span className="ml-auto text-[12px] bg-yellow-500/10 text-yellow-500/80 px-2 py-0.5 rounded-md border border-yellow-500/20 font-black uppercase tracking-tighter">
                    Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-800/40 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl flex flex-col backdrop-blur-sm">
          <div className="flex gap-4 mb-4 bg-slate-900/50 p-2 rounded-2xl">
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex-1 py-3 rounded-xl font-black text-base transition-all ${
                activeTab === 'roles' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'
              }`}
            >
              角色配置
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-3 rounded-xl font-black text-base transition-all ${
                activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500'
              }`}
            >
              遊戲設定
            </button>
          </div>

          {activeTab === 'roles' ? (
            <>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <UserCircle className="text-blue-400" /> 選擇角色
                </h3>
                <div
                  className={`px-4 py-1 rounded-full text-[14px] font-black ${
                    gameState.selectedRoles.length === gameState.players.length + 3
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {gameState.selectedRoles.length} / {gameState.players.length + 3}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 mb-8 max-h-[400px] overflow-y-auto overflow-x-hidden custom-scrollbar px-2 py-2">
                {ALL_ROLES.map((role) => (
                  <RoleCounter
                    key={role.id}
                    role={role}
                    gameState={gameState}
                    isHost={isHost}
                    roomId={roomId}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col gap-3">
              <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700 shadow-inner">
                <label className="font-black text-lg mb-3 block text-blue-400 uppercase tracking-wider">
                  平票判定規則
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['killAll', 'pk'].map((rule) => (
                    <button
                      key={rule}
                      onClick={() => setSetting('tieRule', rule)}
                      className={`py-2 rounded-xl font-bold text-base transition-all border-2 ${
                        gameState.settings?.tieRule === rule
                          ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                          : 'border-slate-800 text-slate-500 hover:border-slate-700'
                      }`}
                    >
                      {rule === 'killAll' ? '最高票皆出局' : '平票進行 PK'}
                    </button>
                  ))}
                </div>
                <p className="text-[14px] text-slate-600 mt-3 leading-tight">
                  {gameState.settings?.tieRule === 'pk'
                    ? '第一輪平票將進入二次 PK 投票。'
                    : '所有最高票者將同時被處死。'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700 flex flex-col gap-2 shadow-inner">
                  <div className="flex justify-between items-center w-full">
                    <label className="font-black text-lg text-blue-400 block uppercase tracking-wider">
                      開啟棄權投票
                    </label>
                    <button
                      onClick={() => setSetting('allowSkip', !gameState.settings?.allowSkip)}
                      className={`w-10 h-6 rounded-full transition-all relative ${
                        gameState.settings?.allowSkip ? 'bg-green-600' : 'bg-slate-700'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                          gameState.settings?.allowSkip ? 'left-5' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-[14px] text-slate-600 leading-tight">
                    開啟後玩家可在投票環節選擇棄票，且無狼局勝利條件變成全員棄權。
                  </p>
                </div>

                <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-black text-lg text-blue-400 uppercase tracking-wider">
                      夜晚行動時長
                    </label>
                    <span className="text-blue-500 font-black text-base">
                      {gameState.settings?.nightDuration || 20}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={gameState.settings?.nightDuration || 20}
                    onChange={(e) => setSetting('nightDuration', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {isHost && (
            <button
              disabled={gameState.selectedRoles.length !== gameState.players.length + 3}
              onClick={startGame}
              className="w-full mt-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-20 text-white font-black text-xl py-5 rounded-2xl shadow-[0_20px_50px_rgba(37,99,235,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              開始遊戲 <ArrowRight size={32} />
            </button>
          )}
        </section>
      </div>
    </>
  );
}
