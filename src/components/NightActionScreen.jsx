import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  User,
  Eye,
  CheckCircle2,
  Shield,
  Moon,
  Wand2,
  RotateCw,
  RotateCcw,
  Search,
  Flag,
} from 'lucide-react';
import { runTransaction } from 'firebase/firestore';

import { ALL_ROLES, findRole, isWolfRoleId } from '../constants.js';
import { db, roomDoc } from '../firebase.js';

function computeRoleForSlot({ currentActiveRoleId, myOriginalRole, doppelgangerRole }) {
  if (!myOriginalRole) return null;
  // 虛擬 slot：化身-失眠者 / 化身-告密者
  if (currentActiveRoleId === 'doppel_insomniac') return findRole('insomniac');
  if (currentActiveRoleId === 'doppel_revealer') return findRole('revealer');
  // 化身自己的 slot：選完後直接以複製到的角色行動（失眠/告密除外，會在虛擬 slot 行動）
  if (currentActiveRoleId === 'doppelganger' && myOriginalRole.id === 'doppelganger') {
    if (!doppelgangerRole) return findRole('doppelganger');
    if (['insomniac', 'revealer'].includes(doppelgangerRole)) return findRole('doppelganger');
    return findRole(doppelgangerRole) ?? myOriginalRole;
  }
  return myOriginalRole;
}

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
  currentActiveRoleId,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [witchCenterIdx, setWitchCenterIdx] = useState(null);
  const [piRevealed, setPiRevealed] = useState([]);
  const [piShouldEnd, setPiShouldEnd] = useState(false);

  const role = useMemo(
    () =>
      computeRoleForSlot({
        currentActiveRoleId,
        myOriginalRole,
        doppelgangerRole: gameState.doppelgangerRole,
      }),
    [currentActiveRoleId, myOriginalRole, gameState.doppelgangerRole],
  );

  const myUid = user?.uid;
  const numPlayers = gameState.players.length;
  const sentinelCardId = gameState.sentinelCardId ?? null;

  // 狼陣營（含化身-狼陣營）— 在「狼人時段」互相看到對方
  const werewolves = gameState.currentCards.filter((c) => {
    const original = gameState.originalCards.find((oc) => oc.id === c.id);
    const isOriginalWolf = isWolfRoleId(original?.role.id);
    const isDoppelWolf =
      original?.role.id === 'doppelganger' && isWolfRoleId(gameState.doppelgangerRole);
    return (isOriginalWolf || isDoppelWolf) && c.ownerUid;
  });
  const wolfNames = werewolves.map((w) => w.ownerName);
  const teammates = werewolves
    .filter((w) => w.ownerUid !== myUid)
    .map((w) => w.ownerName);
  // 孤狼判定：只有「基本狼人」單獨在場時才有觀察中央牌的權利
  const isLoneWolf =
    myOriginalRole?.id === 'werewolf' &&
    werewolves.length === 1 &&
    werewolves[0].ownerUid === myUid;

  // 守夜人（含化身-守夜人）
  const masons = gameState.currentCards.filter((c) => {
    const original = gameState.originalCards.find((oc) => oc.id === c.id);
    const isOriginalMason = original?.role.id === 'mason';
    const isDoppelMason =
      original?.role.id === 'doppelganger' && gameState.doppelgangerRole === 'mason';
    return (isOriginalMason || isDoppelMason) && c.ownerUid;
  });
  const otherMason = masons
    .filter((m) => m.ownerUid !== myUid)
    .map((m) => m.ownerName);

  const myFinalCard = gameState.currentCards.find((c) => c.ownerUid === myUid);

  // 重連復原：依當前 role.id 從 server 取回上次行動結果
  const myActionForThisRole = role?.id
    ? gameState.nightActions?.[myUid]?.[role.id]
    : null;

  // 自動資訊 + 重連復原
  useEffect(() => {
    if (!role) return;
    if (myActionForThisRole?.viewedInfo) {
      setLocalViewed(myActionForThisRole.viewedInfo);
      setHasActed(true);
      return;
    }
    // 不同情境的自動資訊
    if (currentActiveRoleId === 'werewolf') {
      if (myOriginalRole?.id === 'dreamWolf') return; // 睡狼不睜眼
      if (isLoneWolf) return; // 孤狼要操作，不自動資訊
      setLocalViewed(
        teammates.length > 0 ? `狼人同伴：${teammates.join('、 ')}` : '沒有其他狼人',
      );
      return;
    }
    if (role.id === 'minion') {
      setLocalViewed(
        wolfNames.length > 0 ? `狼人成員：${wolfNames.join('、 ')}` : '場上沒有狼人',
      );
      return;
    }
    if (role.id === 'mason') {
      setLocalViewed(
        otherMason.length > 0
          ? `守夜人同伴：${otherMason.join('、 ')}`
          : '場上沒有守夜人同伴',
      );
      return;
    }
    if (role.id === 'insomniac' && myFinalCard) {
      setLocalViewed(`你最終的身分是：【${myFinalCard.role.name}】`);
      setHasActed(true);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role?.id, currentActiveRoleId, myActionForThisRole?.viewedInfo]);

  // ----- 工具 -----
  const isProtected = (cardIdx) => {
    const c = gameState.currentCards[cardIdx];
    return sentinelCardId != null && c?.id === sentinelCardId;
  };
  const myIdxInCards = gameState.currentCards.findIndex((c) => c.ownerUid === myUid);
  const protectedTargetCardIdx = sentinelCardId
    ? gameState.currentCards.findIndex((c) => c.id === sentinelCardId)
    : -1;

  // ----- 提交：化身選人 -----
  // 化身選完直接在同一個 slot 行動（失眠者 / 告密者除外，要等獨立 slot）。
  // doppel_insomniac / doppel_revealer 的 slot 在 buildInitialDeck 就已經放進 nightOrder，
  // 所以這裡只需要寫 doppelgangerRole 跟 log。
  const submitDoppelgangerView = async () => {
    if (submitting) return;
    setSubmitting(true);
    const ref = roomDoc(roomId);
    const targetIdx = selection[0];
    let displayName = '';
    try {
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(ref);
        if (!snap.exists()) throw new Error('房間不存在');
        const data = snap.data();
        if (data.doppelgangerRole) return;
        const targetCard = data.currentCards[targetIdx];
        if (!targetCard) throw new Error('目標牌不存在');
        if (sentinelCardId != null && targetCard.id === sentinelCardId) {
          throw new Error('該玩家被守衛保護，無法選為化身對象');
        }
        displayName = targetCard.role.name;

        const myName = data.players.find((p) => p.uid === myUid)?.name;
        const viewLog = `${myName} (化身幽靈) 查看了 ${targetCard.ownerName}，化身為：【${targetCard.role.name}】`;

        txn.update(ref, {
          doppelgangerRole: targetCard.role.id,
          logs: [...(data.logs || []), viewLog],
        });
      });
      // 清掉先前選的 idx，讓下一個 UI（複製角色的行動 UI）從乾淨狀態開始
      setSelection([]);
    } catch (e) {
      console.error('Doppelganger pick failed:', e);
      showToast?.(e?.message || '行動失敗，請再試一次');
    } finally {
      setSubmitting(false);
    }
  };

  // ----- 提交：一般夜晚行動 -----
  const submitNightAction = async (overrides = {}) => {
    if (submitting || hasActed) return;
    setSubmitting(true);
    const ref = roomDoc(roomId);
    const currentRoleId = role.id;
    const selectionLocal = overrides.selection ?? [...selection];
    const direction = overrides.direction; // 白癡：'left' | 'right' | undefined
    const witchCenter = overrides.witchCenterIdx ?? witchCenterIdx;
    let viewedInfo = '';
    try {
      await runTransaction(db, async (txn) => {
        const snap = await txn.get(ref);
        if (!snap.exists()) throw new Error('房間不存在');
        const data = snap.data();
        // 重複行動防護：本回合已行動過
        const existing = data.nightActions?.[myUid]?.[currentRoleId];
        if (existing) {
          viewedInfo = existing.viewedInfo;
          return;
        }

        const newCards = data.currentCards.map((c) => ({ ...c, role: { ...c.role } }));
        const liveSentinelId = data.sentinelCardId ?? null;
        const isLiveProtected = (idx) => liveSentinelId != null && newCards[idx]?.id === liveSentinelId;
        const myIdx = newCards.findIndex((c) => c.ownerUid === myUid);
        let modified = false;
        const otherUpdates = {};

        if (currentRoleId === 'sentinel') {
          if (selectionLocal.length === 1) {
            const idx = selectionLocal[0];
            if (idx === myIdx) throw new Error('守衛不能保護自己');
            if (newCards[idx].ownerUid == null) throw new Error('守衛只能保護玩家');
            otherUpdates.sentinelCardId = newCards[idx].id;
            viewedInfo = `你已將守衛標記放在 ${newCards[idx].ownerName} 的牌上。`;
          } else {
            viewedInfo = '你選擇不放守衛標記。';
          }
        } else if (currentRoleId === 'seer') {
          if (selectionLocal.length > 0) {
            const blocked = selectionLocal.find((idx) => isLiveProtected(idx));
            if (blocked != null) throw new Error('該牌被守衛保護，無法查看');
            const viewed = selectionLocal.map((idx) => newCards[idx]);
            viewedInfo = viewed.map((v) => `${v.ownerName}: 【${v.role.name}】`).join('、 ');
          } else viewedInfo = '你沒有查看任何牌。';
        } else if (currentRoleId === 'apprenticeSeer') {
          if (selectionLocal.length === 1) {
            const idx = selectionLocal[0];
            const card = newCards[idx];
            viewedInfo = `${card.ownerName}: 【${card.role.name}】`;
          } else viewedInfo = '你沒有查看中央牌。';
        } else if (currentRoleId === 'mysticWolf') {
          if (selectionLocal.length === 1) {
            const idx = selectionLocal[0];
            if (isLiveProtected(idx)) throw new Error('該牌被守衛保護，無法查看');
            const card = newCards[idx];
            viewedInfo = `${card.ownerName}: 【${card.role.name}】`;
          } else viewedInfo = '你沒有查看任何玩家。';
        } else if (currentRoleId === 'paranormalInvestigator') {
          // 從本機 piRevealed 拿到看到的順序
          const sequence = overrides.piRevealed ?? piRevealed;
          if (sequence.length === 0) {
            viewedInfo = '你沒有調查任何人。';
          } else {
            const labels = [];
            let transformedTo = null;
            for (const item of sequence) {
              const card = newCards[item.idx];
              if (isLiveProtected(item.idx)) throw new Error('該牌被守衛保護，無法調查');
              labels.push(`${card.ownerName}: 【${card.role.name}】`);
              if (isWolfRoleId(card.role.id) || card.role.id === 'tanner') {
                transformedTo = card.role.id;
                break;
              }
            }
            if (transformedTo) {
              const transformedRole = findRole(transformedTo);
              newCards[myIdx].role = {
                id: transformedRole.id,
                name: transformedRole.name,
                team: transformedRole.team,
                priority: transformedRole.priority,
              };
              modified = true;
              viewedInfo = `${labels.join('、 ')} → 你立刻變成【${transformedRole.name}】！`;
            } else {
              viewedInfo = `${labels.join('、 ')}（沒有狼人或皮匠）。`;
            }
          }
        } else if (currentRoleId === 'robber') {
          if (selectionLocal.length > 0) {
            const idx = selectionLocal[0];
            if (isLiveProtected(idx)) throw new Error('該牌被守衛保護，無法偷取');
            const targetName = newCards[idx].ownerName;
            const targetRoleName = newCards[idx].role.name;
            const tmp = newCards[myIdx].role;
            newCards[myIdx].role = newCards[idx].role;
            newCards[idx].role = tmp;
            viewedInfo = `你偷取了 ${targetName} 的身分，你現在是 【${targetRoleName}】。`;
            modified = true;
          } else viewedInfo = '你選擇不換牌。';
        } else if (currentRoleId === 'witch') {
          if (witchCenter != null && selectionLocal.length === 1) {
            const playerIdx = selectionLocal[0];
            if (isLiveProtected(playerIdx)) throw new Error('該玩家被守衛保護，無法被女巫變更');
            const centerName = newCards[witchCenter].ownerName;
            const centerRoleName = newCards[witchCenter].role.name;
            const playerName = newCards[playerIdx].ownerName;
            const tmp = newCards[witchCenter].role;
            newCards[witchCenter].role = newCards[playerIdx].role;
            newCards[playerIdx].role = tmp;
            viewedInfo = `你看到 ${centerName} 是【${centerRoleName}】，把它放到了 ${playerName} 的位置。`;
            modified = true;
          } else {
            viewedInfo = '你沒有查看中央牌。';
          }
        } else if (currentRoleId === 'troublemaker') {
          if (selectionLocal.length === 2) {
            const [idx1, idx2] = selectionLocal;
            if (isLiveProtected(idx1) || isLiveProtected(idx2)) {
              throw new Error('其中一張牌被守衛保護，無法交換');
            }
            const name1 = newCards[idx1].ownerName;
            const name2 = newCards[idx2].ownerName;
            const tmp = newCards[idx1].role;
            newCards[idx1].role = newCards[idx2].role;
            newCards[idx2].role = tmp;
            viewedInfo = `你交換了 ${name1} 與 ${name2} 的角色。`;
            modified = true;
          } else viewedInfo = '你選擇不換牌。';
        } else if (currentRoleId === 'villageIdiot') {
          if (direction) {
            // 找出所有非自己的玩家牌索引
            const otherIdxs = [];
            newCards.forEach((c, i) => {
              if (c.ownerUid && c.ownerUid !== myUid) otherIdxs.push(i);
            });
            if (otherIdxs.some((i) => isLiveProtected(i))) {
              throw new Error('有玩家被守衛保護，無法整圈輪轉');
            }
            const oldRoles = otherIdxs.map((i) => newCards[i].role);
            const newRoles =
              direction === 'left'
                ? [oldRoles[oldRoles.length - 1], ...oldRoles.slice(0, -1)]
                : [...oldRoles.slice(1), oldRoles[0]];
            otherIdxs.forEach((i, k) => {
              newCards[i].role = newRoles[k];
            });
            viewedInfo = `你把所有非自己的牌${direction === 'left' ? '逆時針' : '順時針'}輪轉了一格。`;
            modified = true;
          } else {
            viewedInfo = '你選擇不輪轉。';
          }
        } else if (currentRoleId === 'drunk') {
          if (selectionLocal.length === 1) {
            const idx = selectionLocal[0];
            const targetName = newCards[idx].ownerName;
            const tmp = newCards[myIdx].role;
            newCards[myIdx].role = newCards[idx].role;
            newCards[idx].role = tmp;
            viewedInfo = `你已將自己的牌與 【${targetName}】 交換（不可查看）。`;
            modified = true;
          } else throw new Error('酒鬼必須選一張中央牌');
        } else if (currentRoleId === 'insomniac') {
          const myCard = newCards[myIdx];
          viewedInfo = `你查看了自己的牌，你最終的身分是：【${myCard.role.name}】`;
        } else if (currentRoleId === 'werewolf') {
          // 多狼自動顯示已透過 useEffect 處理；這裡只處理孤狼或主動 submit 的情況
          if (selectionLocal.length > 0) {
            const blocked = selectionLocal.find((idx) => isLiveProtected(idx));
            if (blocked != null) throw new Error('該牌被守衛保護，無法查看');
            const viewed = selectionLocal.map((idx) => newCards[idx]);
            viewedInfo = viewed.map((v) => `${v.ownerName}: 【${v.role.name}】`).join('、 ');
          } else {
            viewedInfo = '已確認身分。';
          }
        } else if (currentRoleId === 'alphaWolf') {
          if (selectionLocal.length === 1) {
            const idx = selectionLocal[0];
            if (isLiveProtected(idx)) throw new Error('該玩家被守衛保護，無法被狼老大轉換');
            // alpha-extra 是中央區最後一張牌
            const extraIdx = newCards.length - 1;
            const targetName = newCards[idx].ownerName;
            const tmp = newCards[idx].role;
            newCards[idx].role = newCards[extraIdx].role;
            newCards[extraIdx].role = tmp;
            viewedInfo = `你把 ${targetName} 變成了狼人。`;
            modified = true;
          } else {
            viewedInfo = '你選擇不變換。';
          }
        } else if (currentRoleId === 'revealer') {
          if (selectionLocal.length === 1) {
            const idx = selectionLocal[0];
            if (isLiveProtected(idx)) throw new Error('該玩家被守衛保護，無法翻開');
            const card = newCards[idx];
            const isWolfOrTanner = isWolfRoleId(card.role.id) || card.role.id === 'tanner';
            if (isWolfOrTanner) {
              viewedInfo = `你翻開了 ${card.ownerName}，但發現是【${card.role.name}】，蓋了回去。`;
            } else {
              viewedInfo = `你翻開了 ${card.ownerName}，公開為【${card.role.name}】！`;
              const newRevealed = { ...(data.revealedCards || {}) };
              newRevealed[card.ownerUid] = card.role.name;
              otherUpdates.revealedCards = newRevealed;
            }
          } else {
            viewedInfo = '你選擇不翻開任何人。';
          }
        } else {
          viewedInfo = '已完成行動。';
        }

        const myName = data.players.find((p) => p.uid === myUid)?.name;
        const displayRoleName =
          myOriginalRole.id === 'doppelganger' && data.doppelgangerRole
            ? `化身-${ALL_ROLES.find((r) => r.id === data.doppelgangerRole)?.name ?? data.doppelgangerRole}`
            : myOriginalRole.name;
        const logEntry = `${myName} (${displayRoleName}): ${viewedInfo}`;

        const newActions = { ...(data.nightActions || {}) };
        newActions[myUid] = {
          ...(newActions[myUid] || {}),
          [currentRoleId]: { viewedInfo, timestamp: Date.now() },
        };

        const updates = {
          logs: [...(data.logs || []), logEntry],
          nightActions: newActions,
          ...otherUpdates,
        };
        if (modified) updates.currentCards = newCards;
        txn.update(ref, updates);
      });
      setLocalViewed(viewedInfo);
      setHasActed(true);
    } catch (e) {
      console.error('Submit failed:', e);
      showToast?.(e?.message || '行動失敗，請再試一次');
    } finally {
      setSubmitting(false);
    }
  };

  // 共用：玩家/中央牌選擇格
  const renderCardGrid = ({ filter, onClick, selectableCheck, selectedIdxs }) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
      {gameState.currentCards.map((c, idx) => {
        if (filter && !filter(c, idx)) return null;
        const isSelected = (selectedIdxs ?? []).includes(idx);
        const isCenter = !c.ownerUid;
        const protectedHere = isProtected(idx);
        const canClick = (selectableCheck ? selectableCheck(c, idx) : true) && !protectedHere;
        return (
          <button
            key={idx}
            disabled={!canClick}
            onClick={() => canClick && onClick(idx)}
            className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 text-center transition-all relative ${
              isSelected
                ? 'border-yellow-400 bg-yellow-400/20 scale-105 shadow-[0_0_15px_rgba(250,204,21,0.3)]'
                : 'border-slate-700 bg-slate-800'
            } ${
              !canClick
                ? 'opacity-30 grayscale cursor-not-allowed'
                : 'hover:border-blue-400 active:scale-95'
            }`}
          >
            <div className="text-[12px] sm:text-sm text-slate-500 mb-1">
              {!isCenter ? '玩家' : '桌面'}
            </div>
            <div className="font-bold text-sm truncate">{c.ownerName}</div>
            {protectedHere && (
              <Shield
                size={14}
                className="absolute top-2 right-2 text-emerald-400"
                aria-label="受守衛保護"
              />
            )}
          </button>
        );
      })}
    </div>
  );

  // ============ 各種角色 UI ============

  // 化身-選人時段
  if (currentActiveRoleId === 'doppelganger' && myOriginalRole?.id === 'doppelganger') {
    if (!gameState.doppelgangerRole) {
      return (
        <div className="w-full bg-indigo-900/20 border border-indigo-500/50 p-5 sm:p-8 rounded-2xl sm:rounded-[3rem] animate-in zoom-in-95">
          <h3 className="text-xl sm:text-2xl font-black text-indigo-400 mb-5 sm:mb-6 text-center">
            化身幽靈：請選擇一名玩家
          </h3>
          {renderCardGrid({
            filter: (c, idx) => !!c.ownerUid && c.ownerUid !== myUid,
            onClick: (idx) => setSelection([idx]),
            selectedIdxs: selection,
          })}
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
    // 化身已完成。失眠者 / 告密者要等到自己的獨立 slot 才行動，這裡顯示等待。
    if (['insomniac', 'revealer'].includes(gameState.doppelgangerRole)) {
      const copied = findRole(gameState.doppelgangerRole);
      return (
        <div className="w-full bg-indigo-900/20 border border-indigo-500/50 p-6 sm:p-10 rounded-2xl sm:rounded-[3rem] text-center animate-in zoom-in-95">
          <Eye size={40} className="text-indigo-400 mx-auto mb-3" />
          <h3 className="text-xl sm:text-2xl font-black text-indigo-400 mb-4">已化身完成</h3>
          <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-indigo-500/20 mb-4">
            <p className="text-slate-500 text-sm mb-1">你現在是</p>
            <div className="text-white text-2xl sm:text-3xl font-black">【{copied?.name}】</div>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
            請等待 【化身-{copied?.name}】 的獨立行動時段
          </p>
        </div>
      );
    }
    // 其它角色：直接接後面的 role-specific UI（role 已經是複製到的角色）
  }

  // 沒有夜晚行動的角色（化身-村民 / 化身-獵人 / 化身-皮匠 / 化身-保鑣）
  if (role && role.wakesAtNight === false) {
    return (
      <RolePanel color="amber" title={`你現在是【${role.name}】`} icon={CheckCircle2}>
        <p className="text-center text-slate-400 text-sm leading-relaxed">
          這個角色沒有夜晚行動，請等待夜晚結束。
        </p>
      </RolePanel>
    );
  }

  // 守衛 sentinel
  if (role?.id === 'sentinel' && currentActiveRoleId === 'sentinel') {
    return (
      <div className="w-full bg-emerald-900/20 border border-emerald-500/50 p-5 sm:p-8 rounded-2xl sm:rounded-[3rem] animate-in zoom-in-95">
        <div className="flex items-center justify-center gap-2 mb-5">
          <Shield size={28} className="text-emerald-400" />
          <h3 className="text-xl sm:text-2xl font-black text-emerald-400 text-center">
            守衛：選一名玩家保護
          </h3>
        </div>
        {hasActed ? (
          <CompletedPanel localViewed={localViewed} />
        ) : (
          <>
            {renderCardGrid({
              filter: (c, idx) => !!c.ownerUid && c.ownerUid !== myUid,
              onClick: (idx) => setSelection([idx]),
              selectedIdxs: selection,
            })}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                disabled={selection.length !== 1 || submitting}
                onClick={() => submitNightAction()}
                className="flex-1 py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 rounded-2xl font-black text-base sm:text-lg"
              >
                {submitting ? '處理中...' : '放上守衛標記'}
              </button>
              <button
                disabled={submitting}
                onClick={() => submitNightAction({ selection: [] })}
                className="flex-1 py-3.5 sm:py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold text-base"
              >
                不放
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // 狼人時段
  if (currentActiveRoleId === 'werewolf') {
    if (myOriginalRole?.id === 'dreamWolf') {
      return (
        <RolePanel color="red" title="睡狼" icon={Moon}>
          <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-red-500/20 mb-4 text-center">
            <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
              你是狼陣營的<span className="text-red-400 font-black">睡狼</span>。
              <br />
              其他狼人會知道你是狼，但你不會看到他們。
            </p>
          </div>
          <p className="text-slate-500 text-xs sm:text-sm text-center">無需行動，請靜待夜晚結束...</p>
        </RolePanel>
      );
    }
    // 孤狼：可選一張中央牌
    if (isLoneWolf) {
      return (
        <RolePanel color="red" title="孤狼" icon={Users}>
          {hasActed ? (
            <CompletedPanel localViewed={localViewed} />
          ) : (
            <>
              <p className="text-center text-slate-400 mb-4 text-sm sm:text-base">
                場上沒有其他狼人，你可以查看一張中央牌
              </p>
              {renderCardGrid({
                filter: (c) => !c.ownerUid,
                onClick: (idx) => setSelection([idx]),
                selectedIdxs: selection,
              })}
              <SubmitOrSkip
                canSubmit={selection.length === 1}
                submitting={submitting}
                onSubmit={() => submitNightAction()}
                onSkip={() => submitNightAction({ selection: [] })}
                submitLabel="查看"
                skipLabel="不查看"
              />
            </>
          )}
        </RolePanel>
      );
    }
    // 多狼（含 alpha / mystic / 化身-狼）：顯示同伴
    return (
      <RolePanel color="red" title="狼人同伴" icon={Users}>
        <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-red-500/20 mb-4">
          <div className="text-white text-xl sm:text-2xl font-black text-center">
            {teammates.length > 0 ? teammates.join(' 、 ') : '沒有其他狼人'}
          </div>
        </div>
        <p className="text-slate-500 text-xs sm:text-sm text-center">無需行動，請等待夜晚結束...</p>
      </RolePanel>
    );
  }

  // 狼老大
  if (role?.id === 'alphaWolf') {
    return (
      <RolePanel color="red" title="狼老大" icon={Users}>
        {hasActed ? (
          <CompletedPanel localViewed={localViewed} />
        ) : (
          <>
            <p className="text-center text-slate-400 mb-4 text-sm">
              選一名玩家把他的牌與「中央區的額外狼人牌」交換
            </p>
            {renderCardGrid({
              filter: (c) => !!c.ownerUid && c.ownerUid !== myUid,
              onClick: (idx) => setSelection([idx]),
              selectedIdxs: selection,
            })}
            <SubmitOrSkip
              canSubmit={selection.length === 1}
              submitting={submitting}
              onSubmit={() => submitNightAction()}
              onSkip={() => submitNightAction({ selection: [] })}
              submitLabel="變成狼人"
              skipLabel="不變換"
            />
          </>
        )}
      </RolePanel>
    );
  }

  // 狼先知
  if (role?.id === 'mysticWolf') {
    return (
      <RolePanel color="red" title="狼先知" icon={Eye}>
        {hasActed ? (
          <CompletedPanel localViewed={localViewed} />
        ) : (
          <>
            <p className="text-center text-slate-400 mb-4 text-sm">看一張玩家的牌</p>
            {renderCardGrid({
              filter: (c) => !!c.ownerUid && c.ownerUid !== myUid,
              onClick: (idx) => setSelection([idx]),
              selectedIdxs: selection,
            })}
            <SubmitOrSkip
              canSubmit={selection.length === 1}
              submitting={submitting}
              onSubmit={() => submitNightAction()}
              onSkip={() => submitNightAction({ selection: [] })}
              submitLabel="查看"
              skipLabel="不查看"
            />
          </>
        )}
      </RolePanel>
    );
  }

  // 爪牙
  if (role?.id === 'minion') {
    return (
      <RolePanel color="orange" title="爪牙確認" icon={User}>
        <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-orange-500/20 mb-4">
          <p className="text-slate-500 text-sm mb-2 text-center">你得知了狼人的身分...</p>
          <div className="text-white text-xl sm:text-2xl font-black text-center">
            {wolfNames.length > 0 ? wolfNames.join(' 、 ') : '場上沒有狼人，你是唯一的大哥！'}
          </div>
        </div>
        <p className="text-slate-500 text-xs text-center">無需行動，請等待夜晚結束...</p>
      </RolePanel>
    );
  }

  // 守夜人
  if (role?.id === 'mason') {
    return (
      <RolePanel color="blue" title="守夜人同伴" icon={Users}>
        <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-blue-500/20 mb-4">
          <div className="text-white text-xl sm:text-2xl font-black text-center">
            {otherMason.length > 0
              ? otherMason.join(' 、 ')
              : '場上沒有守夜人同伴，你要自己加油啊！'}
          </div>
        </div>
        <p className="text-slate-500 text-xs text-center">無需行動，請等待夜晚結束...</p>
      </RolePanel>
    );
  }

  // 失眠者（含化身-失眠者）
  if (role?.id === 'insomniac' && myFinalCard) {
    return (
      <RolePanel color="purple" title="身分確認" icon={Eye}>
        <div className="bg-slate-900/50 p-4 sm:p-6 rounded-2xl border border-purple-500/20 mb-4 text-center">
          <p className="text-slate-500 text-sm mb-2">天亮前你偷偷看了一眼...</p>
          <div className="text-white text-2xl sm:text-3xl font-black">【{myFinalCard.role.name}】</div>
        </div>
        <p className="text-slate-500 text-sm text-center">無需操作，請等待夜晚結束...</p>
      </RolePanel>
    );
  }

  // 先知 / 先知學徒 / 強盜 / 搗蛋鬼 / 酒鬼 / 告密者：用通用 picker
  if (role?.id === 'seer') {
    return (
      <SeerPanel
        gameState={gameState}
        myUid={myUid}
        selection={selection}
        setSelection={setSelection}
        hasActed={hasActed}
        localViewed={localViewed}
        submitting={submitting}
        submit={submitNightAction}
        showToast={showToast}
        renderCardGrid={renderCardGrid}
      />
    );
  }
  if (role?.id === 'apprenticeSeer') {
    return (
      <RolePanel color="cyan" title="先知學徒" icon={Eye}>
        {hasActed ? (
          <CompletedPanel localViewed={localViewed} />
        ) : (
          <>
            <p className="text-center text-slate-400 mb-4 text-sm">查看一張中央牌</p>
            {renderCardGrid({
              filter: (c) => !c.ownerUid,
              onClick: (idx) => setSelection([idx]),
              selectedIdxs: selection,
            })}
            <SubmitOrSkip
              canSubmit={selection.length === 1}
              submitting={submitting}
              onSubmit={() => submitNightAction()}
              onSkip={() => submitNightAction({ selection: [] })}
              submitLabel="查看"
              skipLabel="不查看"
            />
          </>
        )}
      </RolePanel>
    );
  }
  if (role?.id === 'paranormalInvestigator') {
    return (
      <ParanormalPanel
        gameState={gameState}
        myUid={myUid}
        piRevealed={piRevealed}
        setPiRevealed={setPiRevealed}
        piShouldEnd={piShouldEnd}
        setPiShouldEnd={setPiShouldEnd}
        hasActed={hasActed}
        localViewed={localViewed}
        submitting={submitting}
        submit={submitNightAction}
        isProtected={isProtected}
      />
    );
  }
  if (role?.id === 'robber') {
    return (
      <RolePanel color="amber" title="強盜" icon={User}>
        {hasActed ? (
          <CompletedPanel localViewed={localViewed} />
        ) : (
          <>
            <p className="text-center text-slate-400 mb-4 text-sm">與一名玩家交換牌（可不換）</p>
            {renderCardGrid({
              filter: (c) => !!c.ownerUid && c.ownerUid !== myUid,
              onClick: (idx) => setSelection([idx]),
              selectedIdxs: selection,
            })}
            <SubmitOrSkip
              canSubmit={selection.length === 1}
              submitting={submitting}
              onSubmit={() => submitNightAction()}
              onSkip={() => submitNightAction({ selection: [] })}
              submitLabel="偷牌"
              skipLabel="不換"
            />
          </>
        )}
      </RolePanel>
    );
  }
  if (role?.id === 'witch') {
    return (
      <WitchPanel
        gameState={gameState}
        myUid={myUid}
        selection={selection}
        setSelection={setSelection}
        witchCenterIdx={witchCenterIdx}
        setWitchCenterIdx={setWitchCenterIdx}
        hasActed={hasActed}
        localViewed={localViewed}
        submitting={submitting}
        submit={submitNightAction}
        renderCardGrid={renderCardGrid}
      />
    );
  }
  if (role?.id === 'troublemaker') {
    return (
      <RolePanel color="orange" title="搗蛋鬼" icon={Wand2}>
        {hasActed ? (
          <CompletedPanel localViewed={localViewed} />
        ) : (
          <>
            <p className="text-center text-slate-400 mb-4 text-sm">交換另外兩名玩家的牌（可不換）</p>
            {renderCardGrid({
              filter: (c) => !!c.ownerUid && c.ownerUid !== myUid,
              onClick: (idx) => {
                if (selection.includes(idx)) {
                  setSelection(selection.filter((i) => i !== idx));
                } else if (selection.length < 2) {
                  setSelection([...selection, idx]);
                }
              },
              selectedIdxs: selection,
            })}
            <SubmitOrSkip
              canSubmit={selection.length === 2}
              submitting={submitting}
              onSubmit={() => submitNightAction()}
              onSkip={() => submitNightAction({ selection: [] })}
              submitLabel="交換"
              skipLabel="不換"
            />
          </>
        )}
      </RolePanel>
    );
  }
  if (role?.id === 'villageIdiot') {
    return (
      <RolePanel color="pink" title="白癡" icon={RotateCw}>
        {hasActed ? (
          <CompletedPanel localViewed={localViewed} />
        ) : (
          <>
            <p className="text-center text-slate-400 mb-4 text-sm">
              把所有非自己玩家的牌整圈輪轉一格（可不換）
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                disabled={submitting}
                onClick={() => submitNightAction({ direction: 'left' })}
                className="py-3.5 bg-pink-600 hover:bg-pink-500 rounded-2xl font-black flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} /> 逆時針
              </button>
              <button
                disabled={submitting}
                onClick={() => submitNightAction({ direction: 'right' })}
                className="py-3.5 bg-pink-600 hover:bg-pink-500 rounded-2xl font-black flex items-center justify-center gap-2"
              >
                <RotateCw size={18} /> 順時針
              </button>
              <button
                disabled={submitting}
                onClick={() => submitNightAction({ direction: undefined })}
                className="py-3.5 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold"
              >
                不輪轉
              </button>
            </div>
          </>
        )}
      </RolePanel>
    );
  }
  if (role?.id === 'drunk') {
    return (
      <RolePanel color="blue" title="酒鬼" icon={User}>
        {hasActed ? (
          <CompletedPanel localViewed={localViewed} />
        ) : (
          <>
            <p className="text-center text-slate-400 mb-4 text-sm">
              將自己的牌與一張中央牌交換（不可查看）
            </p>
            {renderCardGrid({
              filter: (c) => !c.ownerUid,
              onClick: (idx) => setSelection([idx]),
              selectedIdxs: selection,
            })}
            <button
              disabled={selection.length !== 1 || submitting}
              onClick={() => submitNightAction()}
              className="w-full py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 rounded-2xl font-black text-base sm:text-lg"
            >
              {submitting ? '處理中...' : '確認交換'}
            </button>
          </>
        )}
      </RolePanel>
    );
  }
  if (role?.id === 'revealer') {
    return (
      <RolePanel color="rose" title="告密者" icon={Flag}>
        {hasActed ? (
          <CompletedPanel localViewed={localViewed} />
        ) : (
          <>
            <p className="text-center text-slate-400 mb-4 text-sm">
              翻一名玩家的牌；若是狼人或皮匠就蓋回去，否則公開展示
            </p>
            {renderCardGrid({
              filter: (c) => !!c.ownerUid && c.ownerUid !== myUid,
              onClick: (idx) => setSelection([idx]),
              selectedIdxs: selection,
            })}
            <SubmitOrSkip
              canSubmit={selection.length === 1}
              submitting={submitting}
              onSubmit={() => submitNightAction()}
              onSkip={() => submitNightAction({ selection: [] })}
              submitLabel="翻牌"
              skipLabel="不翻"
            />
          </>
        )}
      </RolePanel>
    );
  }

  // 後備：未知角色
  return (
    <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-700 text-center text-slate-400 max-w-md mx-auto">
      暫未實作的角色行動 ({role?.id ?? currentActiveRoleId})
    </div>
  );
}

// ===== 通用面板 =====

const COLOR_MAP = {
  red:    { bg: 'bg-red-900/20',     border: 'border-red-500/50',    text: 'text-red-400' },
  orange: { bg: 'bg-orange-900/20',  border: 'border-orange-500/50', text: 'text-orange-400' },
  blue:   { bg: 'bg-blue-900/20',    border: 'border-blue-500/50',   text: 'text-blue-400' },
  purple: { bg: 'bg-purple-900/20',  border: 'border-purple-500/50', text: 'text-purple-400' },
  cyan:   { bg: 'bg-cyan-900/20',    border: 'border-cyan-500/50',   text: 'text-cyan-400' },
  amber:  { bg: 'bg-amber-900/20',   border: 'border-amber-500/50',  text: 'text-amber-400' },
  pink:   { bg: 'bg-pink-900/20',    border: 'border-pink-500/50',   text: 'text-pink-400' },
  rose:   { bg: 'bg-rose-900/20',    border: 'border-rose-500/50',   text: 'text-rose-400' },
  emerald:{ bg: 'bg-emerald-900/20', border: 'border-emerald-500/50',text: 'text-emerald-400' },
};

function RolePanel({ color = 'blue', title, icon: Icon, children }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
  return (
    <div className={`w-full ${c.bg} border ${c.border} p-5 sm:p-8 rounded-2xl sm:rounded-[3rem] animate-in zoom-in-95`}>
      <div className="flex items-center justify-center gap-2 mb-5 sm:mb-6">
        {Icon && <Icon size={28} className={c.text} />}
        <h3 className={`text-xl sm:text-2xl font-black ${c.text} tracking-tighter`}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function CompletedPanel({ localViewed }) {
  return (
    <div className="flex flex-col items-center py-6 sm:py-8">
      <CheckCircle2 size={40} className="text-green-500 mb-3 animate-bounce" />
      <h3 className="text-lg sm:text-xl font-black text-green-400 mb-3">行動已完成</h3>
      {localViewed && (
        <div className="mt-2 p-4 sm:p-5 bg-slate-800 rounded-2xl border-2 border-yellow-500/50 max-w-md">
          <p className="text-yellow-500 font-black mb-1 text-xs uppercase tracking-widest">
            昨晚看到的資訊
          </p>
          <div className="text-white text-base sm:text-lg font-black break-words">{localViewed}</div>
        </div>
      )}
    </div>
  );
}

function SubmitOrSkip({ canSubmit, submitting, onSubmit, onSkip, submitLabel, skipLabel }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <button
        disabled={!canSubmit || submitting}
        onClick={onSubmit}
        className="flex-1 py-3.5 sm:py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-2xl font-black text-base sm:text-lg"
      >
        {submitting ? '處理中...' : submitLabel}
      </button>
      <button
        disabled={submitting}
        onClick={onSkip}
        className="flex-1 py-3.5 sm:py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold text-base"
      >
        {skipLabel}
      </button>
    </div>
  );
}

// ===== 先知（混合：1 玩家 OR 2 中央） =====
function SeerPanel({ gameState, myUid, selection, setSelection, hasActed, localViewed, submitting, submit, showToast, renderCardGrid }) {
  const handleClick = (idx) => {
    const c = gameState.currentCards[idx];
    const isCenter = !c.ownerUid;
    if (selection.includes(idx)) {
      setSelection(selection.filter((i) => i !== idx));
      return;
    }
    if (isCenter) {
      // 已選玩家就改成只選這張中央
      const hasPlayer = selection.some(
        (i) => gameState.currentCards[i].ownerUid != null,
      );
      if (hasPlayer) setSelection([idx]);
      else if (selection.length < 2) setSelection([...selection, idx]);
    } else {
      setSelection([idx]);
    }
  };

  const numPlayers = gameState.players.length;
  const allCenter = selection.every((i) => i >= numPlayers);
  const allPlayer = selection.every((i) => i < numPlayers);
  const canSubmit =
    (selection.length === 1 && allPlayer) || (selection.length === 2 && allCenter);

  return (
    <RolePanel color="blue" title="先知" icon={Eye}>
      {hasActed ? (
        <CompletedPanel localViewed={localViewed} />
      ) : (
        <>
          <p className="text-center text-slate-400 mb-4 text-sm">
            查看 1 名玩家 或 2 張中央牌
          </p>
          {renderCardGrid({
            onClick: handleClick,
            selectedIdxs: selection,
            filter: (c, idx) => idx !== gameState.currentCards.findIndex(c => c.ownerUid === myUid),
          })}
          <SubmitOrSkip
            canSubmit={canSubmit}
            submitting={submitting}
            onSubmit={() => submit()}
            onSkip={() => submit({ selection: [] })}
            submitLabel="查看"
            skipLabel="不查看"
          />
        </>
      )}
    </RolePanel>
  );
}

// ===== 女巫（2 步驟） =====
function WitchPanel({ gameState, myUid, selection, setSelection, witchCenterIdx, setWitchCenterIdx, hasActed, localViewed, submitting, submit, renderCardGrid }) {
  if (hasActed) {
    return (
      <RolePanel color="purple" title="女巫" icon={Wand2}>
        <CompletedPanel localViewed={localViewed} />
      </RolePanel>
    );
  }

  if (witchCenterIdx == null) {
    return (
      <RolePanel color="purple" title="女巫" icon={Wand2}>
        <p className="text-center text-slate-400 mb-4 text-sm">查看一張中央牌（看了就要換）</p>
        {renderCardGrid({
          filter: (c) => !c.ownerUid,
          onClick: (idx) => setWitchCenterIdx(idx),
          selectedIdxs: [],
        })}
        <button
          disabled={submitting}
          onClick={() => submit({ selection: [] })}
          className="w-full py-3.5 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold text-base"
        >
          不行動
        </button>
      </RolePanel>
    );
  }

  const centerCard = gameState.currentCards[witchCenterIdx];
  return (
    <RolePanel color="purple" title="女巫" icon={Wand2}>
      <div className="bg-slate-900/50 p-4 rounded-2xl border border-purple-500/30 mb-4 text-center">
        <p className="text-slate-500 text-sm mb-1">{centerCard.ownerName} 是</p>
        <div className="text-white text-2xl font-black">【{centerCard.role.name}】</div>
        <p className="text-purple-400 text-xs mt-2 font-black uppercase tracking-widest">
          請選擇要把這張牌給誰（包含自己）
        </p>
      </div>
      {renderCardGrid({
        filter: (c) => !!c.ownerUid,
        onClick: (idx) => setSelection([idx]),
        selectedIdxs: selection,
      })}
      <button
        disabled={selection.length !== 1 || submitting}
        onClick={() => submit({ witchCenterIdx })}
        className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-30 rounded-2xl font-black text-base"
      >
        {submitting ? '處理中...' : '把牌交給選定玩家'}
      </button>
    </RolePanel>
  );
}

// ===== 調查員（2 步驟、條件式） =====
function ParanormalPanel({ gameState, myUid, piRevealed, setPiRevealed, piShouldEnd, setPiShouldEnd, hasActed, localViewed, submitting, submit, isProtected }) {
  if (hasActed) {
    return (
      <RolePanel color="cyan" title="調查員" icon={Search}>
        <CompletedPanel localViewed={localViewed} />
      </RolePanel>
    );
  }

  const handlePick = (idx) => {
    const card = gameState.currentCards[idx];
    const next = [...piRevealed, { idx, role: card.role }];
    setPiRevealed(next);
    const isWolfOrTanner =
      isWolfRoleId(card.role.id) || card.role.id === 'tanner';
    if (isWolfOrTanner || next.length >= 2) {
      // 立刻提交
      submit({ piRevealed: next });
    }
  };

  return (
    <RolePanel color="cyan" title="調查員" icon={Search}>
      <p className="text-center text-slate-400 mb-4 text-sm">
        最多看 2 個玩家的牌；看到狼人或皮匠就立刻變成那個角色
      </p>

      {piRevealed.length > 0 && (
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-cyan-500/30 mb-4">
          <p className="text-cyan-400 text-xs font-black mb-2 uppercase tracking-widest">已查看</p>
          {piRevealed.map((r, i) => (
            <div key={i} className="text-white">
              {gameState.currentCards[r.idx].ownerName}: 【{r.role.name}】
            </div>
          ))}
        </div>
      )}

      {piRevealed.length < 2 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {gameState.currentCards.map((c, idx) => {
            if (!c.ownerUid || c.ownerUid === myUid) return null;
            if (piRevealed.some((r) => r.idx === idx)) return null;
            const protectedHere = isProtected(idx);
            return (
              <button
                key={idx}
                disabled={protectedHere}
                onClick={() => handlePick(idx)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${
                  protectedHere
                    ? 'opacity-30 grayscale cursor-not-allowed'
                    : 'border-slate-700 bg-slate-800 hover:border-cyan-400 active:scale-95'
                }`}
              >
                <div className="text-xs text-slate-500 mb-1">玩家</div>
                <div className="font-bold text-sm truncate">{c.ownerName}</div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-3">
        {piRevealed.length === 0 && (
          <button
            disabled={submitting}
            onClick={() => submit({ piRevealed: [] })}
            className="flex-1 py-3.5 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold"
          >
            不調查
          </button>
        )}
        {piRevealed.length === 1 && (
          <>
            <button
              disabled={submitting}
              onClick={() => submit({ piRevealed })}
              className="flex-1 py-3.5 bg-cyan-600 hover:bg-cyan-500 rounded-2xl font-black"
            >
              停止調查
            </button>
          </>
        )}
      </div>
    </RolePanel>
  );
}
