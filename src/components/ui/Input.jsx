export default function Input(props) {
  return (
    <input
      {...props}
      className={`w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition ${props.className || ''}`}
    />
  );
}