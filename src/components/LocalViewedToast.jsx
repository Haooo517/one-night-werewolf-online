import { Eye } from 'lucide-react';

export default function LocalViewedToast({ text, gameState }) {
  if (!text || !gameState || gameState.status === 'lobby') return null;
  return (
    <div className="fixed bottom-10 right-10 z-40 animate-in slide-in-from-right-10">
      <div className="bg-slate-800 border-2 border-yellow-500 rounded-3xl p-5 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
        <div className="flex items-center gap-2 mb-2">
          <Eye size={16} className="text-yellow-500" />
          <span className="text-[12px] font-black uppercase text-slate-500 tracking-widest">
            昨晚行動結果
          </span>
        </div>
        <div className="text-white font-black text-lg">{text}</div>
      </div>
    </div>
  );
}
