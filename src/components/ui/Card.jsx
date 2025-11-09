export default function Card({ children, className = '' }) {
  return (
    <div className={`bg-white/10 backdrop-blur-md rounded-2xl shadow-lg p-4 sm:p-6 border border-white/20 ${className}`}>
      {children}
    </div>
  );
}