import { Utensils, BookOpen, Calendar } from 'lucide-react';

export default function SignInPrompt({ onSignIn }) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FF00D9] to-[#0099FF] text-white flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-extrabold tracking-tight">FitMeal</h1>
            <p className="text-white/80 mt-2">Спортивное меню без заеба.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 mb-8">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <Utensils size={18} /> <span className="text-sm">Ингредиенты</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <BookOpen size={18} /> <span className="text-sm">Блюда</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
              <Calendar size={18} /> <span className="text-sm">Меню на неделю</span>
            </div>
          </div>

          <button
            onClick={onSignIn}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 rounded-xl py-3 font-semibold shadow-lg hover:shadow-xl transition active:scale-[.99]"
          >
            <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#FFC107"
                d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8A12 12 0 1 1 24 12a11.9 11.9 0 0 1 8.4 3.3l5.7-5.7A19.9 19.9 0 0 0 24 4a20 20 0 1 0 19.6 16.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.7 1.1 7.8 3l5.9-5.9A19.9 19.9 0 0 0 24 4C15.6 4 8.5 8.8 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.1 0 9.8-2 13.2-5.3l-6.1-5A12 12 0 0 1 12.9 29l-6.5 5A20 20 0 0 0 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42V20H24v8h11.3c-1 2.8-2.9 5.2-5.3 6.8l6.1 5C39.4 36.8 44 31 44 24c0-1.2-.1-2.5-.4-3.5z"
              />
            </svg>
            Войти через Google
          </button>

          <p className="text-xs text-white/70 text-center mt-4">
            Нажимая «Войти», ты принимаешь условия использования и политику конфиденциальности.
          </p>
        </div>

        <p className="text-center text-white/60 text-xs mt-6">
          Если всплывающие окна заблокированы, разреши pop-ups для сайта или обнови страницу.
        </p>
      </div>
    </div>
  );
}