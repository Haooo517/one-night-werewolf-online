import { useState, useEffect } from 'react';
import {
  onSnapshot,
  updateDoc,
  arrayRemove,
  arrayUnion,
  deleteDoc,
  runTransaction,
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

import { auth, db, roomDoc } from './firebase.js';
import Toast from './components/Toast.jsx';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import NightPhase from './components/NightPhase.jsx';
import DiscussionPhase from './components/DiscussionPhase.jsx';
import PkVotingPhase from './components/PkVotingPhase.jsx';
import ResultPhase from './components/ResultPhase.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import RoleListSidebar from './components/RoleListSidebar.jsx';
import LocalViewedToast from './components/LocalViewedToast.jsx';

const LS_ROOM = 'werewolf:roomId';
const LS_NAME = 'werewolf:playerName';

export default function App() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem(LS_ROOM)) || '',
  );
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerName, setPlayerName] = useState(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem(LS_NAME)) || '',
  );

  const [localViewed, setLocalViewed] = useState(null);
  const [selection, setSelection] = useState([]);
  const [hasActed, setHasActed] = useState(false);
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(20);

  const showToast = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  // localStorage 同步
  useEffect(() => {
    if (roomId) localStorage.setItem(LS_ROOM, roomId);
    else localStorage.removeItem(LS_ROOM);
  }, [roomId]);
  useEffect(() => {
    if (playerName) localStorage.setItem(LS_NAME, playerName);
  }, [playerName]);

  // 1. 匿名登入
  useEffect(() => {
    signInAnonymously(auth).catch((err) => console.error('Auth error:', err));
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  // 2. 訂閱房間
  useEffect(() => {
    if (!user || !roomId) return;
    const ref = roomDoc(roomId);
    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          setGameState(null);
          setRoomId('');
          return;
        }
        const data = snap.data();
        const stillIn = data.players?.some((p) => p.uid === user.uid);
        if (!stillIn) {
          // Lobby 階段且還有名字可用就自動重新加入；其他階段直接踢回首頁
          if (data.status === 'lobby' && playerName) {
            try {
              await updateDoc(ref, {
                players: arrayUnion({
                  uid: user.uid,
                  name: playerName,
                  isHost: false,
                }),
              });
            } catch (e) {
              console.error('Auto-rejoin failed:', e);
              setGameState(null);
              setRoomId('');
              showToast('自動重新加入失敗');
            }
            return;
          }
          setGameState(null);
          setRoomId('');
          showToast('你已不在這個房間中');
          return;
        }
        if (data.status === 'lobby') {
          setLocalViewed(null);
          setHasActed(false);
          setSelection([]);
        }
        setGameState(data);
        setIsHost(data.hostId === user.uid);
      },
      (err) => console.error('Snapshot error:', err),
    );
    return () => unsub();
  }, [user, roomId, playerName]);

  // 重連復原：從 server 上的 nightActions 還原最後看到的訊息
  useEffect(() => {
    if (!user || !gameState?.nightActions) return;
    if (gameState.status === 'lobby') return;
    const myActions = gameState.nightActions[user.uid];
    if (!myActions) return;
    const latest = Object.values(myActions).reduce(
      (acc, a) => (a.timestamp > (acc?.timestamp || 0) ? a : acc),
      null,
    );
    if (latest?.viewedInfo) {
      setLocalViewed((prev) => prev ?? latest.viewedInfo);
    }
  }, [user, gameState?.nightActions, gameState?.status]);

  // 3. 離線清理：關閉視窗時把自己從 lobby 玩家列表移掉（遊戲已開始就保留位子）
  useEffect(() => {
    const handleUnload = () => {
      if (!roomId || !user || !gameState) return;
      if (gameState.status !== 'lobby') return; // 遊戲中不主動移除，避免破壞牌局
      if (isHost) return; // 房主由刪房邏輯處理
      const me = gameState.players?.find((p) => p.uid === user.uid);
      if (!me) return;
      updateDoc(roomDoc(roomId), { players: arrayRemove(me) });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [roomId, user, isHost, gameState]);

  // 4. 倒數 + 由房主推進階段
  useEffect(() => {
    if (!gameState?.phaseEndTime) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((gameState.phaseEndTime - Date.now()) / 1000));
      setTimer(remaining);
      return remaining;
    };
    tick();

    const interval = setInterval(async () => {
      const remaining = tick();
      if (!isHost || remaining > 0) return;
      if (gameState.status !== 'night') return;

      const ref = roomDoc(roomId);
      const nextIdx = gameState.activeRolePriority + 1;
      if (nextIdx < gameState.nightOrder.length) {
        await updateDoc(ref, {
          activeRolePriority: nextIdx,
          phaseEndTime: Date.now() + (gameState.settings?.nightDuration || 20) * 1000,
        });
      } else {
        await updateDoc(ref, {
          status: 'discussion',
          votes: {},
          phaseEndTime: null,
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    gameState?.phaseEndTime,
    gameState?.activeRolePriority,
    gameState?.status,
    gameState?.nightOrder,
    gameState?.settings?.nightDuration,
    isHost,
    roomId,
  ]);

  const leaveRoom = async () => {
    if (!user || !roomId) return;
    const ref = roomDoc(roomId);
    try {
      if (isHost && gameState?.status === 'lobby') {
        // 大廳階段：房主退出 = 解散房間
        await deleteDoc(ref);
      } else if (isHost) {
        // 遊戲中房主退出 = 把房主轉給下一位玩家（用 transaction 避免覆蓋並行寫入）
        await runTransaction(db, async (txn) => {
          const snap = await txn.get(ref);
          if (!snap.exists()) return;
          const data = snap.data();
          const others = data.players.filter((p) => p.uid !== user.uid);
          if (others.length === 0) {
            txn.delete(ref);
          } else {
            txn.update(ref, {
              hostId: others[0].uid,
              players: others.map((p, i) =>
                i === 0 ? { ...p, isHost: true } : { ...p, isHost: false },
              ),
            });
          }
        });
        setGameState(null);
        setRoomId('');
      } else if (gameState?.players) {
        const me = gameState.players.find((p) => p.uid === user.uid);
        if (me) await updateDoc(ref, { players: arrayRemove(me) });
        setGameState(null);
        setRoomId('');
      }
    } catch (e) {
      console.error('Leave failed:', e);
      showToast('離開房間失敗，請再試一次');
    }
  };

  const inGame =
    gameState &&
    ['night', 'discussion', 'voting', 'pk_voting'].includes(gameState.status);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30 overflow-x-hidden pb-32">
      <Toast message={message} />
      <LocalViewedToast text={localViewed} gameState={gameState} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <Header gameState={gameState} onLeaveRoom={leaveRoom} />

        <div className="flex gap-6 mt-6">
          {inGame && (
            <aside className="hidden lg:block w-56 shrink-0">
              <div className="sticky top-6">
                <RoleListSidebar gameState={gameState} />
              </div>
            </aside>
          )}

          <main className="flex-1 min-w-0">
            {!gameState ? (
              <Home
                user={user}
                playerName={playerName}
                setPlayerName={setPlayerName}
                setRoomId={setRoomId}
                showToast={showToast}
              />
            ) : (
              <div className="animate-in fade-in duration-500">
                {gameState.status === 'lobby' && (
                  <Lobby
                    gameState={gameState}
                    user={user}
                    isHost={isHost}
                    roomId={roomId}
                    showToast={showToast}
                  />
                )}
                {gameState.status === 'night' && (
                  <NightPhase
                    gameState={gameState}
                    user={user}
                    roomId={roomId}
                    timer={timer}
                    selection={selection}
                    setSelection={setSelection}
                    hasActed={hasActed}
                    setHasActed={setHasActed}
                    localViewed={localViewed}
                    setLocalViewed={setLocalViewed}
                    showToast={showToast}
                  />
                )}
                {gameState.status === 'discussion' && (
                  <DiscussionPhase
                    gameState={gameState}
                    user={user}
                    isHost={isHost}
                    roomId={roomId}
                  />
                )}
                {gameState.status === 'pk_voting' && (
                  <PkVotingPhase
                    gameState={gameState}
                    user={user}
                    isHost={isHost}
                    roomId={roomId}
                  />
                )}
                {gameState.status === 'result' && (
                  <ResultPhase
                    gameState={gameState}
                    isHost={isHost}
                    roomId={roomId}
                    onLeaveRoom={leaveRoom}
                  />
                )}
              </div>
            )}
          </main>
        </div>

        <Footer />
      </div>

      {gameState && (
        <ChatPanel
          gameState={gameState}
          user={user}
          playerName={playerName}
          roomId={roomId}
        />
      )}
    </div>
  );
}
