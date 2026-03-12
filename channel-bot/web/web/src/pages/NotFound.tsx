import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex flex-col gap-3 p-4 max-w-3xl mx-auto pb-20 bubble-stagger">
      <div className="text-center">
        <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
          Page Not Found
        </span>
      </div>

      <div className="flex gap-2 items-start max-w-[85%] mr-auto">
        <div className="w-8 h-8 rounded-full bg-tg-input flex items-center justify-center text-sm shrink-0 mt-1">
          🤖
        </div>
        <div>
          <div className="bg-tg-bubble-in rounded-2xl rounded-bl-sm px-4 py-3 text-white">
            <p className="text-tg-blue text-sm font-medium mb-1">PumpKit Bot</p>
            <p className="text-6xl text-center my-4">🔍</p>
            <p className="text-lg font-semibold text-center mb-2">404 — Channel not found</p>
            <p className="text-sm text-zinc-300 text-center mb-4">
              This page doesn&apos;t exist. Maybe the token rugged? 😅
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/"
                className="bg-tg-input text-tg-blue text-sm rounded-lg px-4 py-2 text-center hover:brightness-110 transition"
              >
                🏠 Go Home
              </Link>
              <Link
                to="/docs"
                className="bg-tg-input text-tg-blue text-sm rounded-lg px-4 py-2 text-center hover:brightness-110 transition"
              >
                📖 Read Docs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
