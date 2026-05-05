import { useEffect, useMemo, useState } from 'react';
import { Users, User, Eye, CheckCircle2 } from 'lucide-react';
import { runTransaction } from 'firebase/firestore';

import { ALL_ROLES, findRole } from '../constants.js';
import { db, roomDoc } from '../firebase.js';

export default function NightActionScreen({
  gameState,
  user,
  roomId,
  selection,
  setSelection,
  hasActed,
  setHasActed,
  localViewed,
  setLocalViewed,
  showToast,
  myOriginalRole,
}) {
  const [submitting, setSubmitting] = useState(false);

  // 化身完成後就以複製到的角色為準
  const role =
    myOriginalRole?.id === 'doppelganger' && gameState.doppelgangerRole
      ? findRole(gameState.doppelgangerRole)
      : myOriginalRole;

  // 場上資訊
  const werewolves = gameState.currentCards.filter((c) => {
    const original = gameState.originalCards.find((oc) => oc.id === c.id);
    const isOriginalWolf = original?.role.id === 'werewolf';
    const isDoppelWolf =
      original?.role.id === 'doppelganger' && gameState.doppelgangerRole === 'werewolf';
    return (isOriginalWolf || isDoppelWolf) && c.ownerUid;
  });
  const wolfNames = werewolves.map((w) => w.ownerName);
  const isLoneWolf = role?.id === 'werewolf' && werewolves.length === 1;
  const teammates = werewolves
    .filter((w) => w.ownerUid !== user.uid)
    .map((w) => w.ownerName);
  // 守夜人（含化身-守夜人）— 雙向可見
  const masons = gameState.currentCards.filter((c) => {
    const original = gameState.originalCards.find((oc) => oc.id === c.id);
    const isOriginalMason = original?.role.id === 'mason';
    const isDoppelMason =
      original?.role.id === 'doppelganger' && gameState.doppelgangerRole === 'mason';
    return (isOriginalMason || isDoppelMason) && c.ownerUid;
  });
  const otherMason = masons
    .filter((m) => m.ownerUid !== user.uid)
    .map((m) => m.ownerName);
  const myFinalCard = gameState.currentCards.find((c) => c.ownerUid === user.uid);

  // 重連後從 server 恢復本回合行動結果（如果有）
  const myActionForThisRole = gameState.nightActions?.[user?.uid]?.[role?.id];

  // 自動顯示資訊（多狼/爪牙/守夜人/失眠者）+ 重連復原 — hooks 全部在最前面
  useEffect(() => {
    if (!role) return;

    // 1. 已經行動過（重連回到自己的行動結果）— 從 server 恢復
    if (myActionForThisRole?.viewedInfo) {
      setLocalViewed(myActionForThisRole.viewedInfo);
      setHasActed(true);
      return;
    }

    // 2. 自動顯示資訊
    if (role.id === 'werewolf' && !isLoneWolf) {
      setLocalViewed(
        teammates.length > 0 ? `狼人同伴：${teammates.join('、 ')}` : '沒有其他狼人',
      );
    } else if (role.id === 'minion') {
      setLocalViewed(
        wolfNames.length > 0 ? `狼人成員：${wolfNames.join('、 ')}` : '場上沒有狼人',
      );
    } else if (role.id === 'mason') {
      setLocalViewed(
        otherMason.length > 0
          ? `守夜人同伴：${otherMason.join('、 ')}`
          : '場上沒有守夜人同伴',
      );
    } else if (role.id === 'insomniac' && myFinalCard) {
      setLocalViewed(`你最終的身分是：【${myFinalCard.role.name}】`);
      setHasActed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role?.id, myActionForThisRole?.viewedInfo]);

  const canSubmit = useMemo(() => {
    if (!role || hasActed || submitting) return false;
    const numPlayers = gameState.players.length;
    const allCenter = selection.every((idx) => idx >= numPlayers);
    const allPlayer = selection.every((idx) => idx < numPlayers);

    if (role.id === 'seer') {
      if (selection.length === 1 && allPlayer) return true;
      if (selection.length === 2 && allCenter) return true;
      return false;
    }
    if (role.id === 'robber') {
      return selection.length === 0 || (selection.length === 1 && allPlayer);
    }
    if (role.id === 'troublemaker') {
      return selection.length === 0 || (selection.length === 2 && allPlayer);
    }
    if (role.id === 'werewolf' && isLoneWolf) {
      return selection.length === 1 && allCenter;
    }
    if (role.id === 'drunk') {
      return selection.length === 1 && allCenter;
    }
    return selection.length === 0;
  }, [role, selection, hasActed, submitting, gameState.players.length, isLoneWolf]);

  const submitDoppelgangerView = async () => {
    if (submitting) return;
    setSubmitting(true);
    const ref = roomDoc(roomId);
    const myUid = user.uid;
    const targetIdx = selection[0];
    let displayName = '';
    try {
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(ref);
        if (!snap.exists()) throw new Error('房間不存在');
        const data = snap.data();
        if (data.doppelgangerRole) return; // 已寫入過：避免重複動作

        const targetCard = data.currentCards[targetIdx];
        if (!targetCard) throw new Error('目標牌不存在');
        const copiedRoleId = targetCard.role.id;
        const copiedRole = findRole(copiedRoleId);
        displayName = targetCard.role.name;

        const myName = data.players.find((p) => p.uid === myUid)?.name;
        const viewLog = `${myName} (化身幽靈) 查看了 ${targetCard.ownerName}，化身為：【${targetCard.role.name}】`;

        const updates = {
          doppelgangerRole: copiedRoleId,
          logs: [...(data.logs || []), viewLog],
        };

        // 若複製到的角色有夜晚行動但原本不在 nightOrder 中，動態插入
        if (
          copiedRole &&
          copiedRole.priority < 90 &&
          !data.nightOrder.includes(copiedRoleId)
        ) {
          updates.nightOrder = [...data.nightOrder, copiedRoleId].sort(
            (a, b) => findRole(a).priority - findRole(b).priority,
          );
        }

        txn.update(ref, updates);
      });
      setSelection([]);
      if (displayName) setLocalViewed(`你現在是：【${displayName}】`);
    } catch (e) {
      console.error('Doppelganger pick failed:', e);
      showToast?.('行動失敗，請再試一次');
    } finally {
      setSubmitting(false);
    }
  };

  const submitNightAction = async () => {
    if (submitting || hasActed) return;
    setSubmitting(true);
    const ref = roomDoc(roomId);
    const myUid = user.uid;
    const currentRoleId = role.id;
    const selectionLocal = [...selection];
    let viewedInfo = '';
    try {
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(ref);
        if (!snap.exists()) throw new Error('房間不存在');
        const data = snap.data();

        // 重複行動防護（重連 / 雙擊）：同個角色已行動過就直接抓回原本的訊息
        const existing = data.nightActions?.[myUid]?.[currentRoleId];
        if (existing) {
          viewedInfo = existing.viewedInfo;
          return;
        }

        // 用 server 上最新的 currentCards 計算交換，避免覆蓋掉前面玩家的寫入
        const newCards = data.currentCards.map((c) => ({ ...c, role: { ...c.role } }));
        const myIdx = newCards.findIndex((c) => c.ownerUid === myUid);
        let modified = false;

        if (currentRoleId === 'seer') {
          if (selectionLocal.length > 0) {
            const viewed = selectionLocal.map((idx) => newCards[idx]);
            viewedInfo = viewed.map((v) => `${v.ownerName}: 【${v.role.name}】`).join('、 ');
          } else viewedInfo = '你沒有查看任何牌。';
        } else if (currentRoleId === 'robber') {
          if (selectionLocal.length > 0) {
            const targetIdx = selectionLocal[0];
            const targetName = newCards[targetIdx].ownerName;
            const targetRoleName = newCards[targetIdx].role.name;
            const tmp = newCards[myIdx].role;
            newCards[myIdx].role = newCards[targetIdx].role;
            newCards[targetIdx].role = tmp;
            viewedInfo = `你偷取了 ${targetName} 的身分，你現在是 【${targetRoleName}】。`;
            modified = true;
          } else viewedInfo = '你選擇不換牌。';
        } else if (currentRoleId === 'troublemaker') {
          if (selectionLocal.length === 2) {
            const [idx1, idx2] = selectionLocal;
            const name1 = newCards[idx1].ownerName;
            const name2 = newCards[idx2].ownerName;
            const tmp = newCards[idx1].role;
            newCards[idx1].role = newCards[idx2].role;
            newCards[idx2].role = tmp;
            viewedInfo = `你交換了 ${name1} 與 ${name2} 的角色。`;
            modified = true;
          } else viewedInfo = '你選擇不換牌。';
        } else if (currentRoleId === 'drunk') {
          const targetIdx = selectionLocal[0];
          const targetName = newCards[targetIdx].ownerName;
          const tmp = newCards[myIdx].role;
          newCards[myIdx].role = newCards[targetIdx].role;
          newCards[targetIdx].role = tmp;
          viewedInfo = `你已將自己的牌與 【${targetName}】 交換（不可查看）。`;
          modified = true;
        } else if (currentRoleId === 'insomniac') {
          const myCard = newCards[myIdx];
          viewedInfo = `你查看了自己的牌，你最終的身分是：【${myCard.role.name}】`;
        } else if (currentRoleId === 'werewolf') {
          if (selectionLocal.length > 0) {
            const viewed = selectionLocal.map((idx) => newCards[idx]);
            viewedInfo = viewed.map((v) => `${v.ownerName}: 【${v.role.name}】`).join('、 ');
          } else viewedInfo = '已確認身分。';
        } else {
          viewedInfo = '已完成行動。';
        }

        const myName = data.players.find((p) => p.uid === myUid)?.name;
        const displayRoleName =
          myOriginalRole.id === 'doppelganger' && data.doppelgangerRole
            ? `化身-${ALL_ROLES.find((r) => r.id === data.doppelgangerRole).name}`
            : myOriginalRole.name;
        const logEntry = `${myName} (${displayRoleName}): ${viewedInfo}`;

        // 紀錄本玩家在這個角色的行動結果，重連時可以復原
        const newActions = { ...(data.nightActions || {}) };
        newActions[myUid] = {
          ...(newActions[myUid] || {}),
          [currentRoleId]: { viewedInfo, timestamp: Date.now() },
        };

        const updates = {
          logs: [...(data.logs || []), logEntry],
          nightActions: newActions,
        };
        // 只有實際改變牌堆時才寫 currentCards，避免讀取型角色（預言家、孤狼、失眠者）
        // 把自己過時的快照覆蓋回去而踩掉前面玩家的交換結果
        if (modified) updates.currentCards = newCards;
        txn.update(ref, updates);
      });
      setLocalViewed(viewedInfo);
      setHasActed(true);
    } catch (e) {
      console.error('Submit failed:', e);
      showToast?.('行動失敗，請再試一次');
    } finally {
      setSubmitting(false);
    }
  };

  // === A. 化身幽靈：尚未選擇要化身的對象 ===
  if (myOriginalRole?.id === 'doppelganger' && !gameState.doppelgangerRole) {
    return (
      <div className="w-full bg-indigo-900/20 border border-indigo-500/50 p-5 sm:p-8 rounded-2xl sm:rounded-[3rem] animate-in zoom-in-95">
        <h3 className="text-xl sm:text-2xl font-black text-indigo-400 mb-5 sm:mb-6 text-center">
          化身幽靈：請選擇一名玩家
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {gameState.currentCards.map((c, idx) => {
            const isMe = c.ownerUid === user.uid;
            const isPlayer = !!c.ownerUid;
            if (!isPlayer || isMe) return null;
            return (
              <button
                key={idx}
                onClick={() => setSelection([idx])}
                className={`p-3 sm:p-4 rounded-2xl border-2 transition-all ${
                  selection.includes(idx)
                    ? 'border-indigo-400 bg-indigo-400/20 scale-105'
                    : 'border-slate-700 bg-slate-800 hover:border-indigo-400/50'
                }`}
              >
                <div className="font-bold text-sm">{c.ownerName}</div>
              </button>
            );
          })}
        </div>
        <button
          disabled={selection.length !== 1 || submitting}
          onClick={submitDoppelgangerView}
          className="w-full py-3.5 sm:py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-black text-base sm:text-lg"
        >
          {submitting ? '處理中...' : '查看並化身'}
        </button>
      </div>
    );
  }

  // === B. 多狼人：自動顯示同伴 ===
  if (role?.id === 'werewolf' && !isLoneWolf) {
    return (
      <div className="w-full bg-red-900/20 border border-red-500/50 p-6 sm:p-10 rounded-2xl sm:rounded-[3rem] text-center animate-in zoom-in-95">
        <Users size={48} className="text-red-500 mx-auto mb-3 sm:mb-4 sm:size-14" />
        <h3 className="text-2xl sm:text-3xl font-black text-red-400 mb-4 sm:mb-6 tracking-tighter">狼人同伴</h3>
        <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-red-500/20 mb-4 sm:mb-6">
          <div className="text-white text-xl sm:text-2xl font-black">
            {teammates.length > 0 ? teammates.join(' 、 ') : '沒有其他狼人'}
          </div>
        </div>
        <p className="text-slate-500 text-sm">無需行動，請等待夜晚結束...</p>
      </div>
    );
  }

  // === C. 爪牙 ===
  if (role?.id === 'minion') {
    return (
      <div className="w-full bg-orange-900/20 border border-orange-500/50 p-6 sm:p-10 rounded-2xl sm:rounded-[3rem] text-center animate-in zoom-in-95">
        <User size={48} className="text-orange-400 mx-auto mb-3 sm:mb-4 sm:size-14" />
        <h3 className="text-2xl sm:text-3xl font-black text-orange-400 mb-4 sm:mb-6 tracking-tighter">爪牙確認</h3>
        <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-orange-500/20 mb-4 sm:mb-6">
          <p className="text-slate-500 text-sm mb-2">你得知了狼人的身分...</p>
          <div className="text-white text-xl sm:text-2xl font-black">
            {wolfNames.length > 0 ? wolfNames.join(' 、 ') : '場上沒有狼人，你是唯一的大哥！'}
          </div>
        </div>
        <p className="text-slate-500 text-xs mt-2">無需行動，請等待夜晚結束...</p>
      </div>
    );
  }

  // === D. 守夜人 ===
  if (role?.id === 'mason') {
    return (
      <div className="w-full bg-blue-900/20 border border-blue-500/50 p-6 sm:p-10 rounded-2xl sm:rounded-[3rem] text-center animate-in zoom-in-95">
        <Users size={48} className="text-blue-400 mx-auto mb-3 sm:mb-4 sm:size-14" />
        <h3 className="text-2xl sm:text-3xl font-black text-blue-400 mb-4 sm:mb-6 tracking-tighter">守夜人同伴</h3>
        <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-blue-500/20 mb-4 sm:mb-6">
          <div className="text-white text-xl sm:text-2xl font-black">
            {otherMason.length > 0
              ? otherMason.join(' 、 ')
              : '場上沒有守夜人同伴，你要自己加油啊！'}
          </div>
        </div>
        <p className="text-slate-500 text-xs">無需行動，請等待夜晚結束...</p>
      </div>
    );
  }

  // === E. 失眠者 ===
  if (role?.id === 'insomniac' && myFinalCard) {
    return (
      <div className="w-full bg-purple-900/20 border border-purple-500/50 p-6 sm:p-10 rounded-2xl sm:rounded-[3rem] text-center animate-in zoom-in-95">
        <Eye size={48} className="text-purple-400 mx-auto mb-3 sm:mb-4 sm:size-14" />
        <h3 className="text-2xl sm:text-3xl font-black text-purple-400 mb-4 sm:mb-6 tracking-tighter">身分確認</h3>
        <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-purple-500/20 mb-4 sm:mb-6">
          <p className="text-slate-500 text-sm mb-2">天亮前你偷偷看了一眼...</p>
          <div className="text-white text-2xl sm:text-3xl font-black">【{myFinalCard.role.name}】</div>
        </div>
        <p className="text-slate-500 text-sm">無需操作，請等待夜晚結束...</p>
      </div>
    );
  }

  // === F. 互動式角色 (Seer / Robber / Troublemaker / Drunk / Lone Wolf) ===
  return (
    <div className="w-full bg-blue-900/20 border border-blue-500/50 p-5 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500">
      <h3 className="text-xl sm:text-2xl font-black text-blue-400 mb-5 sm:mb-6 text-center underline underline-offset-8 decoration-4">
        輪到你了：{role?.name}
      </h3>
      {myOriginalRole?.id === 'doppelganger' && gameState.doppelgangerRole && !hasActed && (
        <div className="bg-indigo-600/20 p-4 rounded-2xl border border-indigo-500/50 text-center animate-in slide-in-from-top-2 mb-4">
          <p className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">
            化身能力觸發
          </p>
          <p className="text-lg font-black text-white">
            你現在是【{role?.name}】，請立刻執行能力
          </p>
        </div>
      )}

      {hasActed ? (
        <div className="flex flex-col items-center py-6 sm:py-10">
          <CheckCircle2 size={44} className="text-green-500 mb-3 sm:mb-4 animate-bounce" />
          <h3 className="text-xl sm:text-2xl font-black text-green-400 mb-3 sm:mb-4">行動已完成</h3>
          {localViewed && (
            <div className="mt-3 sm:mt-4 p-4 sm:p-6 bg-slate-800 rounded-2xl sm:rounded-3xl border-2 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)] max-w-md">
              <p className="text-yellow-500 font-black mb-1 sm:mb-2 text-xs sm:text-sm uppercase tracking-widest">
                昨晚看到的資訊：
              </p>
              <div className="text-white text-base sm:text-xl font-black break-words">{localViewed}</div>
            </div>
          )}
          <p className="text-slate-500 text-xs sm:text-sm mt-6 sm:mt-8 text-center px-4">
            請閉上眼靜待倒數結束，不要讓別人看到你的螢幕...
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {gameState.currentCards.map((c, idx) => {
              const isMe = c.ownerUid === user.uid;
              const isSelected = selection.includes(idx);
              const isCenter = !c.ownerUid;

              let canClick = true;
              if (isMe) canClick = false;
              if (role?.id === 'robber' && isCenter) canClick = false;
              if (role?.id === 'troublemaker' && isCenter) canClick = false;
              if (role?.id === 'drunk' && !isCenter) canClick = false;
              if (role?.id === 'werewolf' && isLoneWolf && !isCenter) canClick = false;

              const handleClick = () => {
                if (selection.includes(idx)) {
                  setSelection(selection.filter((i) => i !== idx));
                  return;
                }
                if (role?.id === 'troublemaker') {
                  if (selection.length < 2) setSelection([...selection, idx]);
                } else if (role?.id === 'seer') {
                  if (isCenter) {
                    if (selection.some((i) => i < gameState.players.length)) setSelection([idx]);
                    else if (selection.length < 2) setSelection([...selection, idx]);
                  } else {
                    setSelection([idx]);
                  }
                } else if (role?.id === 'werewolf' && isLoneWolf) {
                  if (isCenter) {
                    setSelection([idx]);
                  } else {
                    showToast?.('孤狼只能查看中央牌');
                  }
                } else {
                  setSelection([idx]);
                }
              };

              return (
                <button
                  key={idx}
                  disabled={!canClick}
                  onClick={handleClick}
                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 text-center transition-all ${
                    isSelected
                      ? 'border-yellow-400 bg-yellow-400/20 scale-105 shadow-[0_0_15px_rgba(250,204,21,0.3)]'
                      : 'border-slate-700 bg-slate-800'
                  } ${
                    !canClick ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:border-blue-400 active:scale-95'
                  }`}
                >
                  <div className="text-[12px] sm:text-sm text-slate-500 mb-1">
                    {!isCenter ? '玩家' : '桌面'}
                  </div>
                  <div className="font-bold text-sm truncate">{c.ownerName}</div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-6">
            {localViewed && (
              <div className="p-6 bg-slate-900 rounded-3xl border border-yellow-500/30 text-yellow-400 font-black text-xl animate-bounce text-center">
                {localViewed}
              </div>
            )}
            <button
              disabled={!canSubmit}
              onClick={submitNightAction}
              className="w-full sm:w-auto px-10 sm:px-16 py-4 sm:py-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:opacity-50 text-white font-black text-lg sm:text-xl rounded-2xl sm:rounded-3xl shadow-xl transition-all active:scale-95"
            >
              {submitting ? '處理中...' : '確認行動'}
            </button>
            {(role?.id === 'robber' || role?.id === 'troublemaker') && selection.length === 0 && (
              <p className="text-sm text-slate-500">（可選擇不換牌直接點確認）</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
