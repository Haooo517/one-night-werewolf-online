import { Moon, LogOut } from 'lucide-react';

export default function Header({ gameState, onLeaveRoom }) {
  return (
    <header className="flex justify-between items-center pt-4 sm:pt-6 pb-4 border-b border-slate-800">
      <div className="flex items-center gap-3">
        <div className="p-2 sm:p-2.5 bg-blue-600 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)]">
          <Moon size={20} className="text-white" />
        </div>
        <h1 className="text-base sm:text-xl font-black tracking-tight uppercase">
          ONE NIGHT <span className="text-blue-500">WEREWOLF</span>
        </h1>
      </div>
      {gameState?.status === 'lobby' && (
        <button
          onClick={onLeaveRoom}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-full text-xs sm:text-sm font-bold transition-all border border-slate-700"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">退出遊戲</span>
        </button>
      )}
    </header>
  );
}
