import { Moon } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-16 sm:mt-20 pt-6 sm:pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-600 text-[10px] sm:text-xs uppercase font-black tracking-[0.2em]">
      <div className="flex items-center gap-2">
        <Moon size={12} className="text-blue-500" />
        <span>One Night Werewolf Online</span>
      </div>
      <div className="opacity-50">v1.2 · Vite Edition</div>
    </footer>
  );
}
