import { ALL_ROLES, findRole, isWolfRoleId, getNightOrderPriority } from './constants.js';

// 結算：算出誰被處死 + 哪一方獲勝
export function calculateWinner(gameState) {
  const { players, currentCards, votes, settings } = gameState;
  const numPlayers = players.length;
  const isSkipEnabled = !!settings?.allowSkip;

  // 把化身玩家「視為」複製到的角色，方便後續判斷
  const playerRoles = currentCards
    .filter((c) => c.ownerUid)
    .map((card) => {
      if (card.role.id === 'doppelganger' && gameState.doppelgangerRole) {
        const copied = findRole(gameState.doppelgangerRole);
        if (copied) return { ...card, role: { ...copied } };
      }
      return card;
    });

  // 1. 統計票數
  const voteCounts = {};
  Object.values(votes || {}).forEach((vuid) => {
    if (vuid == null) return;
    voteCounts[vuid] = (voteCounts[vuid] || 0) + 1;
  });
  const playerVoteCounts = { ...voteCounts };
  delete playerVoteCounts['skip'];
  const maxPlayerVotes = Math.max(...Object.values(playerVoteCounts), 0);
  const skipVotes = voteCounts['skip'] || 0;

  // 2. 候選人 / 平票 / 出局者 初步計算
  let losers = [];
  let isTie = false;
  const candidates = Object.keys(playerVoteCounts).filter(
    (uid) => playerVoteCounts[uid] === maxPlayerVotes,
  );

  if (isSkipEnabled) {
    if (maxPlayerVotes > 0) {
      if (candidates.length > 1 && settings?.tieRule === 'pk') {
        isTie = true;
        losers = candidates;
      } else {
        losers = candidates;
      }
    }
  } else {
    if (maxPlayerVotes > 1) {
      if (candidates.length > 1 && settings?.tieRule === 'pk') {
        isTie = true;
        losers = candidates;
      } else {
        losers = candidates;
      }
    }
  }

  // 3. 獵人開槍：若獵人出局，把他投票的對象一併帶走
  const deadHunters = playerRoles.filter(
    (c) => losers.includes(c.ownerUid) && c.role.id === 'hunter',
  );
  deadHunters.forEach((hunter) => {
    const targetUid = votes[hunter.ownerUid];
    if (targetUid && targetUid !== 'skip' && !losers.includes(targetUid)) {
      losers.push(targetUid);
    }
  });

  // 4. 保鑣保護：被保鑣投票的玩家不會出局
  const bodyguards = playerRoles.filter((c) => c.role.id === 'bodyguard');
  const protectedUids = new Set();
  bodyguards.forEach((bg) => {
    const protectTarget = votes[bg.ownerUid];
    if (protectTarget && protectTarget !== 'skip') {
      protectedUids.add(protectTarget);
    }
  });
  const losersAfterBodyguard = losers.filter((uid) => !protectedUids.has(uid));
  const wasProtected = losers.some((uid) => protectedUids.has(uid));
  losers = losersAfterBodyguard;

  // 5. 陣營狀態
  const realWolfInGame = playerRoles.some((c) => isWolfRoleId(c.role.id));
  const deadRoles = playerRoles
    .filter((c) => losers.includes(c.ownerUid))
    .map((c) => c.role.id);
  const realWolfDied = playerRoles.some(
    (c) => losers.includes(c.ownerUid) && isWolfRoleId(c.role.id),
  );
  const minionInGame = playerRoles.some((c) => c.role.id === 'minion');
  const minionDied = playerRoles.some(
    (c) => losers.includes(c.ownerUid) && c.role.id === 'minion',
  );

  // 6. 勝負判定
  // A. 皮匠優先
  if (deadRoles.includes('tanner')) {
    return {
      winner: 'tanner',
      message: '皮匠被放逐了！皮匠單獨獲勝！',
      dead: losers,
      isTie,
      protected: wasProtected,
    };
  }

  // B. 無狼局
  if (!realWolfInGame) {
    if (isSkipEnabled) {
      if (skipVotes === numPlayers) {
        return {
          winner: 'villager',
          message: '場上沒有狼人，大家平安無事！村民獲勝！',
          dead: [],
          isTie,
          protected: wasProtected,
        };
      } else if (minionDied) {
        return {
          winner: 'villager',
          message: '成功抓到了爪牙！村民獲勝！',
          dead: losers,
          isTie,
          protected: wasProtected,
        };
      } else {
        const msg = minionInGame
          ? '冤枉啊！雖然沒狼人但處死了村民！狼人獲勝！'
          : '冤枉啊！場上沒狼人卻處死了村民！無人獲勝！';
        return { winner: 'wolf', message: msg, dead: losers, isTie, protected: wasProtected };
      }
    } else {
      if (losers.length === 0) {
        return {
          winner: 'villager',
          message: '場上沒有狼人，大家平安無事！村民獲勝！',
          dead: [],
          isTie,
          protected: wasProtected,
        };
      } else if (minionDied) {
        return {
          winner: 'villager',
          message: '成功抓到了爪牙！村民獲勝！',
          dead: losers,
          isTie,
          protected: wasProtected,
        };
      } else {
        const msg = minionInGame
          ? '冤枉啊！雖然沒狼人但處死了村民！狼人獲勝！'
          : '冤枉啊！場上沒狼人卻處死了村民！無人獲勝！';
        return { winner: 'wolf', message: msg, dead: losers, isTie, protected: wasProtected };
      }
    }
  }

  // C. 有狼局
  if (realWolfDied) {
    return {
      winner: 'villager',
      message: '成功抓到狼人了！村民獲勝！',
      dead: losers,
      isTie,
      protected: wasProtected,
    };
  }
  const msg = minionDied ? '爪牙替狼人頂罪了！狼人獲勝！' : '狼人成功逃脫！狼人獲勝！';
  return { winner: 'wolf', message: msg, dead: losers, isTie, protected: wasProtected };
}

// 開新局時：根據選用角色與玩家數產生牌堆 + 夜晚行動順序
//
// 狼老大：場上會多一張中央狼人牌，作為他的「交換目標」。
// 我們把這張額外的狼人牌固定放在中央區的最後一張，獨立於原本玩家+3 的牌堆。
export function buildInitialDeck(players, selectedRoles) {
  const numPlayers = players.length;
  const hasAlpha = selectedRoles.includes('alphaWolf');

  // 玩家 + 3 張中央牌（基本配置）
  const baseRoles = [...selectedRoles];
  if (baseRoles.length !== numPlayers + 3) {
    throw new Error(
      `角色數量不對：${baseRoles.length}（需要 ${numPlayers + 3}）`,
    );
  }

  // 洗牌（正常的玩家+3 部分）
  const shuffled = [...baseRoles].sort(() => Math.random() - 0.5);

  const cards = shuffled.map((roleId, index) => {
    const role = findRole(roleId);
    return {
      id: index,
      role: { id: role.id, name: role.name, team: role.team, priority: role.priority },
      ownerUid: index < numPlayers ? players[index].uid : null,
      ownerName:
        index < numPlayers
          ? players[index].name
          : `中央 ${index - numPlayers + 1}`,
    };
  });

  // 狼老大：再追加一張中央狼人牌（公開時顯示成普通的「中央 N」，不洩漏這張的身份）
  if (hasAlpha) {
    const wolfRole = findRole('werewolf');
    const idx = cards.length;
    const centerIdx = idx - numPlayers + 1;
    cards.push({
      id: idx,
      role: { id: wolfRole.id, name: wolfRole.name, team: wolfRole.team, priority: wolfRole.priority },
      ownerUid: null,
      ownerName: `中央 ${centerIdx}`,
    });
  }

  // 夜晚行動順序：依 priority 排序所有「會在夜晚醒來」的選用角色
  const allSelectedRoleIds = [...new Set(selectedRoles)];
  const nightOrder = ALL_ROLES.filter(
    (r) => allSelectedRoleIds.includes(r.id) && r.wakesAtNight,
  )
    .sort((a, b) => a.priority - b.priority)
    .map((r) => r.id);

  // 化身-失眠者 / 化身-告密者：只要這局有失眠者 / 告密者，就一定加上這個獨立 slot，
  // 不管有沒有人是化身。這樣就算沒人扮演也會「跑那 20 秒」做掩護。
  if (allSelectedRoleIds.includes('insomniac')) {
    nightOrder.push('doppel_insomniac');
  }
  if (allSelectedRoleIds.includes('revealer')) {
    nightOrder.push('doppel_revealer');
  }
  nightOrder.sort((a, b) => getNightOrderPriority(a) - getNightOrderPriority(b));

  return { cards, nightOrder };
}
