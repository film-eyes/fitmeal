export default function Toast({ message }) {
  return (
    <div
      className={`fixed bottom-5 right-5 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-300 ${
        message ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
      }`}
    >
      {message}
    </div>
  );
}