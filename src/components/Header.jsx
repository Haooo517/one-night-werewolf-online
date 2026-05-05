import { Moon, LogOut } from 'lucide-react';

export default function Header({ gameState, onLeaveRoom }) {
  return (
    <header className="max-w-4xl mx-auto flex justify-between items-center mb-10 border-b border-slate-800 pb-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-blue-600 rounded-lg">
          <Moon size={20} className="text-white" />
        </div>
        <h1 className="text-xl font-black tracking-tight uppercase">
          ONE NIGHT <span className="text-blue-500">WEREWOLF</span>
        </h1>
      </div>
      {gameState?.status === 'lobby' && (
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-full text-xs font-bold transition-all border border-slate-700"
        >
          <LogOut size={14} /> 退出遊戲
        </button>
      )}
    </header>
  );
}
