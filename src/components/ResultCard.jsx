import { findRole } from '../constants.js';

export default function ResultCard({ card, originalCards, doppelgangerRole }) {
  const original = originalCards.find((oc) => oc.id === card.id);
  let displayName = original?.role.name;
  if (original?.role.id === 'doppelganger' && doppelgangerRole) {
    const copied = findRole(doppelgangerRole);
    if (copied) displayName = `化身-${copied.name}`;
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="p-4 bg-white text-slate-900 rounded-2xl font-black w-full text-center shadow-lg text-lg">
        {card.role.name}
      </div>
      <div className="text-[16px] text-slate-500 font-bold uppercase tracking-widest">
        {card.ownerName}
      </div>
      <div className="text-[14px] text-slate-500">原: {displayName}</div>
    </div>
  );
}
