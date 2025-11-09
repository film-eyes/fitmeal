export default function Button({ children, onClick, className = '', type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-lg font-semibold transition-all duration-200 shadow-md flex items-center justify-center gap-2 ${className}`}
    >
      {children}
    </button>
  );
}