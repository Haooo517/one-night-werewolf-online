import { Eye } from 'lucide-react';

export default function LocalViewedToast({ text, gameState }) {
  if (!text || !gameState || gameState.status === 'lobby') return null;
  return (
    <div className="fixed z-40 animate-in
                    top-20 left-1/2 -translate-x-1/2 w-[92%] max-w-md
                    sm:translate-x-0 sm:left-auto sm:bottom-10 sm:right-6 sm:top-auto sm:w-auto sm:max-w-sm
                    slide-in-from-top-4 sm:slide-in-from-right-10">
      <div className="bg-slate-800 border-2 border-yellow-500 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
        <div className="flex items-center gap-2 mb-1 sm:mb-2">
          <Eye size={14} className="text-yellow-500" />
          <span className="text-[11px] sm:text-xs font-black uppercase text-slate-500 tracking-widest">
            昨晚行動結果
          </span>
        </div>
        <div className="text-white font-black text-base sm:text-lg leading-snug">{text}</div>
      </div>
    </div>
  );
}
