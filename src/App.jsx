import { useState, useEffect } from 'react';
import {
  onSnapshot,
  updateDoc,
  arrayRemove,
  deleteDoc,
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

import { auth, roomDoc } from './firebase.js';
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

export default function App() {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [playerName, setPlayerName] = useState('');

  const [localViewed, setLocalViewed] = useState(null);
  const [selection, setSelection] = useState([]);
  const [hasActed, setHasActed] = useState(false);
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(20);

  const showToast = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

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
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'lobby') {
            setLocalViewed(null);
            setHasActed(false);
            setSelection([]);
          }
          setGameState(data);
          setIsHost(data.hostId === user.uid);
        } else {
          setGameState(null);
          setRoomId('');
        }
      },
      (err) => console.error('Snapshot error:', err),
    );
    return () => unsub();
  }, [user, roomId]);

  // 3. 離線清理：非房主關閉視窗時把自己從玩家列表移掉
  useEffect(() => {
    const handleUnload = () => {
      if (!roomId || !user || isHost || !gameState?.players) return;
      const me = gameState.players.find((p) => p.uid === user.uid);
      if (!me) return;
      updateDoc(roomDoc(roomId), { players: arrayRemove(me) });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [roomId, user, isHost, gameState?.players]);

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
    if (isHost) {
      await deleteDoc(ref);
    } else if (gameState?.players) {
      const me = gameState.players.find((p) => p.uid === user.uid);
      if (me) await updateDoc(ref, { players: arrayRemove(me) });
      setGameState(null);
      setRoomId('');
    }
  };

  const inGame =
    gameState &&
    ['night', 'discussion', 'voting', 'pk_voting'].includes(gameState.status);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      <Toast message={message} />
      <Header gameState={gameState} onLeaveRoom={leaveRoom} />

      <main className="max-w-4xl mx-auto">
        <LocalViewedToast text={localViewed} gameState={gameState} />
        {inGame && <RoleListSidebar gameState={gameState} />}

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
              <ResultPhase gameState={gameState} isHost={isHost} roomId={roomId} />
            )}
          </div>
        )}
      </main>

      {gameState && (
        <ChatPanel
          gameState={gameState}
          user={user}
          playerName={playerName}
          roomId={roomId}
        />
      )}

      <Footer />
    </div>
  );
}
