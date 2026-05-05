# 一夜終極狼人 Online

一夜終極狼人（One Night Ultimate Werewolf）的網頁線上版，使用 React + Vite + Firebase Firestore 即時同步多人狀態。

## 特色

- 完整的角色配置：化身幽靈、狼人、爪牙、守夜人、預言家、強盜、搗蛋鬼、酒鬼、失眠者、獵人、村民、皮匠
- 房主可調整夜晚行動時長、平票判定（最高票皆出局 / 平票 PK）、是否開放棄票
- 房主作為「主機」推進階段：夜晚倒數→討論→投票→（PK→）結算
- 即時聊天面板（夜晚禁言）
- 房號代碼建房 / 加房，支援匿名登入

## 開發

```bash
npm install
cp .env.example .env   # 填入你自己的 Firebase config
npm run dev
```

dev server 預設跑在 [http://localhost:5173](http://localhost:5173)。

## 建置

```bash
npm run build
npm run preview
```

產出在 `dist/`。

## 部署 Firestore 安全規則

```bash
# 第一次需要先安裝 firebase-tools 並登入
npm i -g firebase-tools
firebase login
firebase use one-night-werewolves   # 你的 project id

firebase deploy --only firestore:rules
```

規則檔在 [firestore.rules](firestore.rules)。預設規則允許已登入使用者讀寫自己有參與的房間，房主可刪除房間。

## 專案結構

```
src/
├── App.jsx                    # 頂層狀態 + 階段路由
├── main.jsx                   # Vite 入口
├── firebase.js                # Firebase 初始化 / roomDoc 工具
├── constants.js               # ALL_ROLES 定義
├── gameLogic.js               # 勝負判定 / 夜晚牌堆生成
├── index.css                  # Tailwind 載入點 + 自訂樣式
└── components/
    ├── Toast.jsx
    ├── Header.jsx / Footer.jsx
    ├── Home.jsx               # 進房前畫面（暱稱 / 建房 / 加房）
    ├── Lobby.jsx              # 房間大廳（玩家清單 / 角色 / 設定）
    ├── RoleCounter.jsx        # 大廳裡的角色 +/- 按鈕
    ├── RoleListSidebar.jsx    # 進入遊戲後左側角色清單
    ├── NightPhase.jsx         # 夜晚階段外殼
    ├── NightActionScreen.jsx  # 夜晚當前角色的行動 UI
    ├── DiscussionPhase.jsx    # 討論 + 投票
    ├── PkVotingPhase.jsx      # 平票 PK 二次投票
    ├── ResultPhase.jsx        # 結算
    ├── ResultCard.jsx
    ├── ChatPanel.jsx          # 底部聊天區
    └── LocalViewedToast.jsx   # 右下角「昨晚行動結果」浮層
```

## v1.1 變更（從原始單檔版重構）

- 從 1542 行的單一 `index.html` + Babel standalone 改為 Vite + 模組化 React
- 拆成 ~15 個元件 / 純函式檔案
- Firebase config 移到 `.env`（透過 `import.meta.env.VITE_*`）
- 修了幾個 bug：
  - 移除沙盒模板殘留的 `signInWithCustomToken` / `__initial_auth_token` 死碼，讓匿名登入流程不再 ReferenceError
  - 修正提交夜晚行動時 `myRoleObj` 未定義（應為 `myOriginalRole`）
  - 修正獵人開槍 log 寫成 `${hunter.name}`（卡片上是 `ownerName`）導致顯示 undefined
  - 把 `NightActionScreen` 內部條件式的 `useEffect` 提到頂層，符合 React Hooks 規則
- 加入 `firestore.rules` 基本規則範本

## 安全性備註

- Firebase Web SDK 的 API key 設計上是公開的（會編進前端 bundle），真正的安全靠 [Firestore Security Rules](firestore.rules)
- 目前規則允許任何已登入玩家讀寫房間文件 — 已足夠防止外部寫入，但同房間玩家仍可能透過 client 改寫對方資料；要徹底防作弊需要把關鍵邏輯搬到 Cloud Functions

## License

MIT
