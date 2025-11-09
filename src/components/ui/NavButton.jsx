export default function NavButton({ icon, text, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 ${
        isActive ? 'bg-white text-blue-600 shadow-lg' : 'bg-transparent text-white hover:bg-white/20'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{text}</span>
    </button>
  );
}