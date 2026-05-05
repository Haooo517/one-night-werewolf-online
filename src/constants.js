// 夜晚行動順序（priority 由小到大）：
//
//  5  守衛
// 10  化身幽靈
// 20  狼人 + 睡狼（睡狼不睜眼，但其他狼會看到他）
// 25  狼老大
// 30  狼先知
// 35  爪牙
// 40  守夜人
// 50  先知
// 55  先知學徒
// 60  調查員
// 65  強盜
// 70  女巫
// 75  搗蛋鬼
// 80  白癡
// 85  酒鬼
// 90  失眠者
// 91  化身-失眠者（虛擬 slot，僅在 doppel 化身為失眠者時插入）
// 95  告密者
// 96  化身-告密者（虛擬 slot）
// 99  獵人 / 村民 / 皮匠 / 保鑣（不會夜晚醒來）

export const ALL_ROLES = [
  // ── Basic
  { id: 'doppelganger',  name: '化身幽靈', team: 'villager', priority: 10, wakesAtNight: true,  multi: false, expansion: 'basic',
    description: '夜晚最先行動之一：查看一名玩家的牌並化身為該角色。當所複製的角色該行動時，你也跟著行動。' },
  { id: 'werewolf',      name: '狼人',     team: 'wolf',     priority: 20, wakesAtNight: true,  multi: true,  expansion: 'basic',
    description: '與其他狼人確認身分。若你是孤狼，可看一張中央牌。' },
  { id: 'minion',        name: '爪牙',     team: 'wolf',     priority: 35, wakesAtNight: true,  multi: false, expansion: 'basic',
    description: '得知所有狼人的身分；若你死了狼人陣營仍可獲勝。' },
  { id: 'mason',         name: '守夜人',   team: 'villager', priority: 40, wakesAtNight: true,  multi: false, fixedCount: 2, expansion: 'basic',
    description: '與另一名守夜人確認身分。' },
  { id: 'seer',          name: '先知',     team: 'villager', priority: 50, wakesAtNight: true,  multi: false, expansion: 'basic',
    description: '查看一名玩家的牌，或查看兩張中央牌。' },
  { id: 'robber',        name: '強盜',     team: 'villager', priority: 65, wakesAtNight: true,  multi: false, expansion: 'basic',
    description: '與一名玩家交換牌，並查看自己的新身分（可不換）。' },
  { id: 'troublemaker',  name: '搗蛋鬼',   team: 'villager', priority: 75, wakesAtNight: true,  multi: false, expansion: 'basic',
    description: '交換另外兩名玩家的牌（可不換）。' },
  { id: 'drunk',         name: '酒鬼',     team: 'villager', priority: 85, wakesAtNight: true,  multi: false, expansion: 'basic',
    description: '將自己的牌與一張中央牌交換（不可查看）。' },
  { id: 'insomniac',     name: '失眠者',   team: 'villager', priority: 90, wakesAtNight: true,  multi: false, expansion: 'basic',
    description: '夜晚最後查看自己最終的身分。' },
  { id: 'hunter',        name: '獵人',     team: 'villager', priority: 99, wakesAtNight: false, multi: false, expansion: 'basic',
    description: '若你出局，被你投票的玩家會一起被帶走。' },
  { id: 'villager',      name: '村民',     team: 'villager', priority: 99, wakesAtNight: false, multi: true,  expansion: 'basic',
    description: '沒有特殊能力。' },
  { id: 'tanner',        name: '皮匠',     team: 'tanner',   priority: 99, wakesAtNight: false, multi: false, expansion: 'basic',
    description: '若你出局，皮匠單獨獲勝。' },

  // ── Daybreak
  { id: 'sentinel',                name: '守衛',     team: 'villager', priority: 5,  wakesAtNight: true,  multi: false, expansion: 'daybreak',
    description: '夜晚最開始：在一名其他玩家的牌上放守衛標記，那張牌整晚不能被查看或交換。' },
  { id: 'alphaWolf',               name: '狼老大',   team: 'wolf',     priority: 25, wakesAtNight: true,  multi: false, expansion: 'daybreak',
    description: '把一名玩家的牌與「中央區的額外狼人牌」交換（可不換），把那名玩家變成狼人。' },
  { id: 'mysticWolf',              name: '狼先知',   team: 'wolf',     priority: 30, wakesAtNight: true,  multi: false, expansion: 'daybreak',
    description: '與其他狼人確認身分後，可查看一名玩家的牌。' },
  { id: 'dreamWolf',               name: '睡狼',     team: 'wolf',     priority: 20, wakesAtNight: true,  multi: false, expansion: 'daybreak',
    description: '屬於狼陣營，但夜晚不睜眼；其他狼人會知道他是狼。' },
  { id: 'apprenticeSeer',          name: '先知學徒', team: 'villager', priority: 55, wakesAtNight: true,  multi: false, expansion: 'daybreak',
    description: '可以查看一張中央牌。' },
  { id: 'paranormalInvestigator',  name: '調查員',   team: 'villager', priority: 60, wakesAtNight: true,  multi: false, expansion: 'daybreak',
    description: '最多查看兩名玩家的牌；若看到狼人或皮匠就立刻變成那個角色並停止調查。' },
  { id: 'witch',                   name: '女巫',     team: 'villager', priority: 70, wakesAtNight: true,  multi: false, expansion: 'daybreak',
    description: '可選擇查看一張中央牌；若有看就必須把那張牌交換給任一玩家（含自己）。' },
  { id: 'villageIdiot',            name: '白癡',     team: 'villager', priority: 80, wakesAtNight: true,  multi: false, expansion: 'daybreak',
    description: '可以把所有非自己玩家的牌依順時針或逆時針整圈輪轉一格（可不換）。' },
  { id: 'revealer',                name: '告密者',   team: 'villager', priority: 95, wakesAtNight: true,  multi: false, expansion: 'daybreak',
    description: '翻開一名玩家的牌；若是狼人或皮匠就蓋回去，否則公開展示給所有人看。' },
  { id: 'bodyguard',               name: '保鑣',     team: 'villager', priority: 99, wakesAtNight: false, multi: false, expansion: 'daybreak',
    description: '不會夜晚行動。投票時被你投票的玩家受到保護，無法被處死。' },
];

export const findRole = (id) => ALL_ROLES.find((r) => r.id === id);

// 化身專屬的「插隊 slot」（不在 ALL_ROLES 裡）
export const VIRTUAL_NIGHT_SLOTS = {
  doppel_insomniac: { priority: 91, derivesFrom: 'insomniac', label: '化身-失眠者' },
  doppel_revealer:  { priority: 96, derivesFrom: 'revealer',  label: '化身-告密者' },
};

// 取得 nightOrder 排序用的 priority
export function getNightOrderPriority(orderId) {
  if (VIRTUAL_NIGHT_SLOTS[orderId]) return VIRTUAL_NIGHT_SLOTS[orderId].priority;
  return findRole(orderId)?.priority ?? 999;
}

// 取得 nightOrder 顯示用的名稱
export function getNightOrderLabel(orderId) {
  if (VIRTUAL_NIGHT_SLOTS[orderId]) return VIRTUAL_NIGHT_SLOTS[orderId].label;
  return findRole(orderId)?.name ?? orderId;
}

// 給 isMyTurn / 行動邏輯：解析 nightOrder slot id → 實際要執行的 role
// 例如 doppel_insomniac → insomniac
export function resolveSlotToRoleId(orderId) {
  if (VIRTUAL_NIGHT_SLOTS[orderId]) return VIRTUAL_NIGHT_SLOTS[orderId].derivesFrom;
  return orderId;
}

// 狼陣營角色（其他狼會看到他、爪牙會看到他）
export const WOLF_ROLE_IDS = ['werewolf', 'alphaWolf', 'mysticWolf', 'dreamWolf'];
export const isWolfRoleId = (id) => WOLF_ROLE_IDS.includes(id);
