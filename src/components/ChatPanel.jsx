import { useState, useEffect, useRef } from 'react';
import { updateDoc } from 'firebase/firestore';
import { Plus, Minus, Moon } from 'lucide-react';

import { roomDoc } from '../firebase.js';

const MAX_MESSAGES = 100;

export default function ChatPanel({ gameState, user, playerName, roomId }) {
  const [chatInput, setChatInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [lastReadCount, setLastReadCount] = useState(0);
  const endRef = useRef(null);

  useEffect(() => {
    if (isOpen && gameState?.messages) {
      setLastReadCount(gameState.messages.length);
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [gameState?.messages, isOpen]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !roomId) return;
    const ref = roomDoc(roomId);
    let next = gameState.messages || [];
    if (next.length >= MAX_MESSAGES) next = next.slice(1);
    const myName =
      playerName || gameState.players.find((p) => p.uid === user.uid)?.name || '匿名';
    next = [...next, { uid: user.uid, name: myName, text: chatInput, time: Date.now() }];
    await updateDoc(ref, { messages: next });
    setChatInput('');
  };

  const hasUnread = gameState.messages?.length > lastReadCount && !isOpen;

  return (
    <div
      className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl z-[100] transition-all duration-500 ease-in-out ${
        isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'
      }`}
    >
      <div className="bg-slate-900 border-x border-t border-slate-700 rounded-t-[2rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col h-[400px]">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="p-3 border-b border-slate-800 flex items-center justify-between cursor-pointer bg-slate-900 hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2 ml-4">
            <div
              className={`w-2 h-2 rounded-full ${
                gameState.status === 'night' ? 'bg-red-500' : 'bg-green-500 animate-pulse'
              }`}
            ></div>
            <span className="font-black text-sm text-slate-400 uppercase tracking-widest">
              {gameState.status === 'night' ? '夜晚禁言中' : '即時討論區'}
            </span>
            {hasUnread && (
              <span className="bg-blue-600 text-white text-[12px] px-2 py-0.5 rounded-full font-black animate-bounce shadow-[0_0_10px_rgba(37,99,235,0.5)]">
                New
              </span>
            )}
          </div>
          <button className="p-1 mr-2 text-slate-500 hover:text-white">
            {isOpen ? <Minus size={20} /> : <Plus size={20} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-900/50">
          {gameState.messages?.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-700 font-bold text-sm">
              尚無訊息
            </div>
          ) : (
            gameState.messages?.map((msg, i) => (
              <div
                key={i}
                className={`flex flex-col ${msg.uid === user.uid ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] font-black text-slate-500 mb-1 px-2">{msg.name}</span>
                <div
                  className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm font-medium shadow-sm ${
                    msg.uid === user.uid
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <div className="p-4 bg-slate-900 border-t border-slate-800">
          {gameState.status !== 'night' ? (
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="輸入訊息參與討論..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500/50 transition-all text-white"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-xl font-black text-sm transition-all shadow-lg shadow-blue-600/20"
              >
                傳送
              </button>
            </form>
          ) : (
            <div className="py-2 text-center text-red-500/70 text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2">
              <Moon size={14} /> 夜晚請保持安靜，嚴禁交流
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
