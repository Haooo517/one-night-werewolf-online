import { ALL_ROLES, findRole } from './constants.js';

export function calculateWinner(gameState) {
  const { players, currentCards, votes, settings } = gameState;
  const numPlayers = players.length;
  const isSkipEnabled = !!settings?.allowSkip;

  const voteCounts = {};
  Object.values(votes || {}).forEach((vuid) => {
    if (vuid == null) return;
    voteCounts[vuid] = (voteCounts[vuid] || 0) + 1;
  });

  const playerVoteCounts = { ...voteCounts };
  delete playerVoteCounts['skip'];
  const maxPlayerVotes = Math.max(...Object.values(playerVoteCounts), 0);
  const skipVotes = voteCounts['skip'] || 0;

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

  // 化身幽靈視為複製到的角色
  const playerRoles = currentCards
    .filter((c) => c.ownerUid)
    .map((card) => {
      if (card.role.id === 'doppelganger' && gameState.doppelgangerRole) {
        const copiedRole = findRole(gameState.doppelgangerRole);
        if (copiedRole) return { ...card, role: { ...copiedRole } };
      }
      return card;
    });

  // 獵人開槍：若獵人出局，被他投票的對象一起帶走
  const deadHunters = playerRoles.filter(
    (c) => losers.includes(c.ownerUid) && c.role.id === 'hunter',
  );
  deadHunters.forEach((hunter) => {
    const targetUid = votes[hunter.ownerUid];
    if (targetUid && targetUid !== 'skip' && !losers.includes(targetUid)) {
      losers.push(targetUid);
    }
  });

  const realWolfInGame = playerRoles.some((c) => c.role.id === 'werewolf');
  const deadRoles = playerRoles
    .filter((c) => losers.includes(c.ownerUid))
    .map((c) => c.role.id);
  const realWolfDied = playerRoles.some(
    (c) => losers.includes(c.ownerUid) && c.role.id === 'werewolf',
  );
  const minionInGame = playerRoles.some((c) => c.role.id === 'minion');
  const minionDied = playerRoles.some(
    (c) => losers.includes(c.ownerUid) && c.role.id === 'minion',
  );

  // 皮匠優先
  if (deadRoles.includes('tanner')) {
    return {
      winner: 'tanner',
      message: '皮匠被放逐了！皮匠單獨獲勝！',
      dead: losers,
      isTie,
    };
  }

  // 無狼局
  if (!realWolfInGame) {
    if (isSkipEnabled) {
      if (skipVotes === numPlayers) {
        return {
          winner: 'villager',
          message: '場上沒有狼人，大家平安無事！村民獲勝！',
          dead: [],
          isTie,
        };
      } else if (minionDied) {
        return {
          winner: 'villager',
          message: '成功抓到了爪牙！村民獲勝！',
          dead: losers,
          isTie,
        };
      } else {
        const msg = minionInGame
          ? '冤枉啊！雖然沒狼人但處死了村民！狼人獲勝！'
          : '冤枉啊！場上沒狼人卻處死了村民！無人獲勝！';
        return { winner: 'wolf', message: msg, dead: losers, isTie };
      }
    } else {
      if (losers.length === 0) {
        return {
          winner: 'villager',
          message: '場上沒有狼人，大家平安無事！村民獲勝！',
          dead: [],
          isTie,
        };
      } else if (minionDied) {
        return {
          winner: 'villager',
          message: '成功抓到了爪牙！村民獲勝！',
          dead: losers,
          isTie,
        };
      } else {
        const msg = minionInGame
          ? '冤枉啊！雖然沒狼人但處死了村民！狼人獲勝！'
          : '冤枉啊！場上沒狼人卻處死了村民！無人獲勝！';
        return { winner: 'wolf', message: msg, dead: losers, isTie };
      }
    }
  }

  // 有狼局
  if (realWolfDied) {
    return {
      winner: 'villager',
      message: '成功抓到狼人了！村民獲勝！',
      dead: losers,
      isTie,
    };
  }
  const msg = minionDied ? '爪牙替狼人頂罪了！狼人獲勝！' : '狼人成功逃脫！狼人獲勝！';
  return { winner: 'wolf', message: msg, dead: losers, isTie };
}

// 開新局時：根據選用角色與玩家數產生牌堆 + 夜晚行動順序
export function buildInitialDeck(players, selectedRoles) {
  const shuffled = [...selectedRoles].sort(() => Math.random() - 0.5);
  const cards = shuffled.map((roleId, index) => {
    const role = findRole(roleId);
    return {
      id: index,
      role: { id: role.id, name: role.name, team: role.team, priority: role.priority },
      ownerUid: index < players.length ? players[index].uid : null,
      ownerName:
        index < players.length
          ? players[index].name
          : `中央 ${index - players.length + 1}`,
    };
  });

  const allSelectedRoleIds = [...new Set(selectedRoles)];
  const nightOrder = ALL_ROLES.filter(
    (r) => allSelectedRoleIds.includes(r.id) && r.priority < 90,
  )
    .sort((a, b) => a.priority - b.priority)
    .map((r) => r.id);

  return { cards, nightOrder };
}
