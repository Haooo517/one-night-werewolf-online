import { useState } from 'react';
import { Users, UserCircle, ArrowRight, Pencil, Check, X } from 'lucide-react';
import { updateDoc } from 'firebase/firestore';

import { ALL_ROLES } from '../constants.js';
import { roomDoc } from '../firebase.js';
import { buildInitialDeck } from '../gameLogic.js';
import RoleCounter from './RoleCounter.jsx';

const MIN_PLAYERS = 3;

export default function Lobby({ gameState, user, isHost, roomId, showToast }) {
  const [activeTab, setActiveTab] = useState('roles');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const playerCount = gameState.players.length;
  const requiredCardCount = playerCount + 3;
  const cardCountOk = gameState.selectedRoles.length === requiredCardCount;
  const enoughPlayers = playerCount >= MIN_PLAYERS;

  const startGame = async () => {
    if (!isHost) return;
    if (!enoughPlayers) return showToast(`至少需要 ${MIN_PLAYERS} 位玩家才能開始`);
    if (!cardCountOk) {
      return showToast(`角色數量不正確！需要 ${requiredCardCount} 張角色牌。`);
    }

    const { cards, nightOrder } = buildInitialDeck(gameState.players, gameState.selectedRoles);
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

  const startEditName = () => {
    const me = gameState.players.find((p) => p.uid === user?.uid);
    setDraftName(me?.name || '');
    setEditingName(true);
  };

  const saveName = async () => {
    const trimmed = draftName.trim();
    if (!trimmed) return showToast('名字不能空白');
    if (trimmed.length > 20) return showToast('名字最多 20 個字');
    const next = gameState.players.map((p) =>
      p.uid === user.uid ? { ...p, name: trimmed } : p,
    );
    await updateDoc(roomDoc(roomId), { players: next });
    setEditingName(false);
  };

  const kickPlayer = async (targetUid) => {
    if (!isHost || targetUid === user.uid) return;
    const next = gameState.players.filter((p) => p.uid !== targetUid);
    await updateDoc(roomDoc(roomId), { players: next });
  };

  const startDisabledReason = !enoughPlayers
    ? `等待玩家加入（至少 ${MIN_PLAYERS} 人）`
    : !cardCountOk
    ? `調整角色至 ${requiredCardCount} 張`
    : null;

  return (
    <>
      <div className="text-center mb-10">
        <p className="text-slate-500 text-xs sm:text-sm font-black uppercase tracking-[0.3em] mb-2">
          Room Code · 點擊複製
        </p>
        <h2
          onClick={onClickRoomCode}
          className="text-5xl sm:text-6xl font-black text-blue-500 tracking-[0.2em] drop-shadow-[0_0_20px_rgba(59,130,246,0.3)] cursor-pointer select-all"
        >
          {gameState.id}
        </h2>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
        <section className="bg-slate-800/40 p-6 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-sm">
          <h3 className="text-lg sm:text-xl font-black mb-4 flex items-center gap-2">
            <Users className="text-blue-400" size={20} />
            玩家名單 ({playerCount}
            <span className={enoughPlayers ? 'text-green-400' : 'text-amber-400'}>
              /{MIN_PLAYERS}+
            </span>
            )
          </h3>
          <div className="space-y-2">
            {gameState.players.map((p) => {
              const isMe = p.uid === user?.uid;
              const isThisHost = p.uid === gameState.hostId;
              return (
                <div
                  key={p.uid}
                  className="flex items-center gap-3 p-3 bg-slate-900/80 rounded-xl border border-slate-700 shadow-inner group transition-all"
                >
                  <div className="w-9 h-9 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-400 font-black shrink-0">
                    {p.name[0]}
                  </div>

                  {isMe && editingName ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveName();
                          if (e.key === 'Escape') setEditingName(false);
                        }}
                        maxLength={20}
                        className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-base outline-none focus:border-blue-500"
                      />
                      <button onClick={saveName} className="p-2 bg-green-600/30 hover:bg-green-600/50 rounded-lg text-green-300">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingName(false)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="font-bold text-base sm:text-lg text-slate-100 truncate">
                        {p.name}
                        {isMe && (
                          <span className="text-blue-400 text-sm ml-2">(你)</span>
                        )}
                      </span>

                      {isThisHost && (
                        <span className="text-[11px] sm:text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-md border border-yellow-500/20 font-black uppercase tracking-tighter">
                          Host
                        </span>
                      )}

                      <div className="ml-auto flex items-center gap-1">
                        {isMe && (
                          <button
                            onClick={startEditName}
                            title="改名"
                            className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {isHost && !isMe && (
                          <button
                            onClick={() => kickPlayer(p.uid)}
                            title="踢出"
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-800/40 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-800 shadow-2xl flex flex-col backdrop-blur-sm">
          <div className="flex gap-3 mb-4 bg-slate-900/50 p-2 rounded-2xl">
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex-1 py-3 rounded-xl font-black text-base transition-all ${
                activeTab === 'roles' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'
              }`}
            >
              角色配置
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 py-3 rounded-xl font-black text-base transition-all ${
                activeTab === 'settings' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'
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
                  className={`px-3 py-1 rounded-full text-sm font-black ${
                    cardCountOk ? 'text-green-400 bg-green-400/10' : 'text-amber-400 bg-amber-400/10'
                  }`}
                >
                  {gameState.selectedRoles.length} / {requiredCardCount}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 mb-6 max-h-[420px] overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
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
                <label className="font-black text-base sm:text-lg mb-3 block text-blue-400 uppercase tracking-wider">
                  平票判定規則
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['killAll', 'pk'].map((rule) => (
                    <button
                      key={rule}
                      onClick={() => setSetting('tieRule', rule)}
                      className={`py-2 rounded-xl font-bold text-sm sm:text-base transition-all border-2 ${
                        gameState.settings?.tieRule === rule
                          ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                          : 'border-slate-800 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {rule === 'killAll' ? '最高票皆出局' : '平票進行 PK'}
                    </button>
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-3 leading-snug">
                  {gameState.settings?.tieRule === 'pk'
                    ? '第一輪平票將進入二次 PK 投票。'
                    : '所有最高票者將同時被處死。'}
                </p>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700 flex flex-col gap-2 shadow-inner">
                <div className="flex justify-between items-center w-full">
                  <label className="font-black text-base sm:text-lg text-blue-400 block uppercase tracking-wider">
                    開啟棄權投票
                  </label>
                  <button
                    onClick={() => setSetting('allowSkip', !gameState.settings?.allowSkip)}
                    className={`w-11 h-6 rounded-full transition-all relative ${
                      gameState.settings?.allowSkip ? 'bg-green-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                        gameState.settings?.allowSkip ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 leading-snug">
                  開啟後玩家可在投票環節選擇棄票，且無狼局勝利條件變成全員棄權。
                </p>
              </div>

              <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <label className="font-black text-base sm:text-lg text-blue-400 uppercase tracking-wider">
                    夜晚行動時長
                  </label>
                  <span className="text-blue-400 font-black text-base">
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
          )}

          {isHost && (
            <button
              disabled={!enoughPlayers || !cardCountOk}
              onClick={startGame}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-lg sm:text-xl py-4 sm:py-5 rounded-2xl shadow-[0_20px_50px_rgba(37,99,235,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {startDisabledReason || (
                <>
                  開始遊戲 <ArrowRight size={28} />
                </>
              )}
            </button>
          )}
        </section>
      </div>
    </>
  );
}
