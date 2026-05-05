export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-8 py-4 rounded-full font-black shadow-2xl animate-in slide-in-from-top-10">
      {message}
    </div>
  );
}
