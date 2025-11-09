import { AlertTriangle } from 'lucide-react';

export default function FirebaseConfigErrorScreen() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FF00D9] to-[#0099FF] font-sans text-white p-4 sm:p-8 flex items-center justify-center">
      <div className="bg-white/20 backdrop-blur-md rounded-2xl p-8 text-center max-w-2xl shadow-2xl border border-white/30">
        <div className="flex justify-center items-center gap-4 mb-4">
          <AlertTriangle size={48} className="text-yellow-300" />
          <h1 className="text-3xl font-bold">Ошибка конфигурации Firebase</h1>
        </div>
        <p className="text-lg mb-6">
          Похоже, ты не добавил свои ключи для подключения к Firebase. Приложение не может работать без них.
        </p>
        <div className="text-left bg-black/20 p-4 rounded-lg text-sm">
          <p className="font-bold mb-2">Что нужно сделать:</p>
          <ol className="list-decimal list-inside mt-2 space-y-2">
            <li>Открой файл <code>.env.local</code> и пропиши переменные VITE_…</li>
            <li>Перезапусти dev-сервер (`npm run dev`).</li>
          </ol>
        </div>
      </div>
    </div>
  );
}