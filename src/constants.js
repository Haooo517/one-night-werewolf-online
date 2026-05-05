export const ALL_ROLES = [
  { id: 'doppelganger', name: '化身幽靈', team: 'villager', description: '查看一名玩家的牌。並化身成為該角色。', priority: 1, multi: false },
  { id: 'werewolf',     name: '狼人',     team: 'wolf',     description: '與其他狼人確認身分。若你是孤狼，可看一張中央牌。', priority: 2, multi: true },
  { id: 'minion',       name: '爪牙',     team: 'wolf',     description: '得知誰是狼人，並且若是你死掉狼人陣營仍能獲勝。', priority: 3, multi: false },
  { id: 'mason',        name: '守夜人',   team: 'villager', description: '與另一名守夜人確認身分。', priority: 4, multi: false, fixedCount: 2 },
  { id: 'seer',         name: '預言家',   team: 'villager', description: '查看一名玩家的牌，或查看兩張中央牌。', priority: 5, multi: false },
  { id: 'robber',       name: '強盜',     team: 'villager', description: '與一名玩家交換牌，並查看自己的新身分（也可以不換）。', priority: 6, multi: false },
  { id: 'troublemaker', name: '搗蛋鬼',   team: 'villager', description: '交換另外兩名玩家的牌（也可以不換）。', priority: 7, multi: false },
  { id: 'drunk',        name: '酒鬼',     team: 'villager', description: '將自己的牌與一張中央牌交換（不可查看）。', priority: 8, multi: false },
  { id: 'insomniac',    name: '失眠者',   team: 'villager', description: '可在夜晚最後查看自己最終的身分。', priority: 9, multi: false },
  { id: 'hunter',       name: '獵人',     team: 'villager', description: '如果你死掉，被你投票的玩家會一起被帶走。', priority: 99, multi: false },
  { id: 'villager',     name: '村民',     team: 'villager', description: '沒有特殊能力。', priority: 99, multi: true },
  { id: 'tanner',       name: '皮匠',     team: 'tanner',   description: '如果你死掉，你就贏了。', priority: 99, multi: false },
];

export const findRole = (id) => ALL_ROLES.find((r) => r.id === id);
