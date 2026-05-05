import { Moon } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="max-w-4xl mx-auto mt-20 pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-slate-600 text-[10px] uppercase font-black tracking-[0.2em]">
      <div className="flex items-center gap-2">
        <Moon size={14} className="text-blue-500" />
        <span>One Night Werewolf Online</span>
      </div>
      <div className="opacity-50">v1.1 — Vite Edition</div>
    </footer>
  );
}
