import { useState } from 'react';
import { Link } from 'react-router-dom';

function IncomingBubble({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <div className="flex gap-2 items-end max-w-[85%]">
      <div className="w-8 h-8 rounded-full bg-tg-input flex items-center justify-center text-sm shrink-0">
        🤖
      </div>
      <div>
        <div className="bg-tg-bubble-in rounded-2xl rounded-bl-sm px-4 py-3">
          <p className="text-tg-blue text-sm font-medium mb-1">PumpKit Bot</p>
          {children}
          <span className="text-[11px] text-zinc-500 block text-right mt-1">{time}</span>
        </div>
      </div>
    </div>
  );
}

function OutgoingBubble({ children, time }: { children: React.ReactNode; time: string }) {
  return (
    <div className="max-w-[85%] ml-auto">
      <div className="bg-tg-bubble rounded-2xl rounded-br-sm px-4 py-3 text-white">
        {children}
      </div>
      <p className="text-[11px] text-zinc-500 mt-1 text-right">{time}</p>
    </div>
  );
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-10 h-6 rounded-full relative transition-colors ${enabled ? 'bg-pump-green' : 'bg-tg-input'}`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'left-5' : 'left-1'}`}
      />
    </button>
  );
}

export function CreateCoin() {
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [mayhemMode, setMayhemMode] = useState(false);
  const [cashback, setCashback] = useState(true);
  const [creatorFeeSharing, setCreatorFeeSharing] = useState(false);

  return (
    <div className="flex flex-col gap-3 p-4 max-w-3xl mx-auto pb-20">
      {/* Date separator */}
      <div className="text-center">
        <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
          Today
        </span>
      </div>

      {/* 1. Welcome message */}
      <IncomingBubble time="14:00">
        <p className="text-sm leading-relaxed">
          Let's create your token on PumpFun! Fill in the details below and I'll generate the instructions.
        </p>
      </IncomingBubble>

      {/* 2. Token Name */}
      <IncomingBubble time="14:01">
        <p className="text-sm">What's your token name?</p>
      </IncomingBubble>
      <OutgoingBubble time="14:01">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. PumpKit Token"
          className="bg-tg-input border border-tg-border rounded-lg px-3 py-2 text-white w-full outline-none focus:ring-1 focus:ring-tg-blue/40 placeholder-zinc-500 text-sm"
        />
      </OutgoingBubble>

      {/* 3. Token Symbol */}
      <IncomingBubble time="14:02">
        <p className="text-sm">Choose a ticker symbol (1–8 chars)</p>
      </IncomingBubble>
      <OutgoingBubble time="14:02">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.slice(0, 8))}
          placeholder="e.g. PUMP"
          className="bg-tg-input border border-tg-border rounded-lg px-3 py-2 text-white w-full outline-none focus:ring-1 focus:ring-tg-blue/40 placeholder-zinc-500 text-sm"
        />
      </OutgoingBubble>

      {/* 4. Description */}
      <IncomingBubble time="14:03">
        <p className="text-sm">Describe your token (optional)</p>
      </IncomingBubble>
      <OutgoingBubble time="14:03">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="The best PumpFun bot framework..."
          rows={3}
          className="bg-tg-input border border-tg-border rounded-lg px-3 py-2 text-white w-full outline-none focus:ring-1 focus:ring-tg-blue/40 placeholder-zinc-500 text-sm resize-none"
        />
      </OutgoingBubble>

      {/* 5. Token Image */}
      <IncomingBubble time="14:04">
        <p className="text-sm">Upload a token image (optional)</p>
      </IncomingBubble>
      <OutgoingBubble time="14:04">
        <div className="border-2 border-dashed border-tg-border rounded-xl p-8 text-center">
          <p className="text-3xl mb-2">🖼️</p>
          <p className="text-sm text-zinc-400">Drag &amp; drop or click to upload</p>
        </div>
      </OutgoingBubble>

      {/* 6. Options */}
      <IncomingBubble time="14:05">
        <p className="text-sm mb-3">Configure launch options:</p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Mayhem Mode</span>
            <Toggle enabled={mayhemMode} onToggle={() => setMayhemMode(!mayhemMode)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Cashback Enabled</span>
            <Toggle enabled={cashback} onToggle={() => setCashback(!cashback)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Creator Fee Sharing</span>
            <Toggle enabled={creatorFeeSharing} onToggle={() => setCreatorFeeSharing(!creatorFeeSharing)} />
          </div>
        </div>
      </IncomingBubble>

      {/* 7. Preview Card */}
      <OutgoingBubble time="14:06">
        <div className="bg-gradient-to-br from-tg-input to-tg-bubble-in rounded-xl p-4 relative">
          <span className="absolute top-2 right-2 text-[10px] bg-tg-input/80 text-zinc-400 px-2 py-0.5 rounded-full">
            Preview
          </span>
          <p className="text-3xl mb-2">🪙</p>
          <p className="text-lg font-bold">
            {name || 'Token Name'}{' '}
            <span className="text-sm font-normal text-zinc-400">
              {symbol ? `$${symbol}` : '$TICKER'}
            </span>
          </p>
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Bonding Curve</span>
              <span>0%</span>
            </div>
            <div className="w-full h-1.5 bg-tg-input rounded-full overflow-hidden">
              <div className="h-full w-0 bg-pump-green rounded-full" />
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-0.5 text-xs text-zinc-400">
            <span>Market Cap: —</span>
            <span>Created by: You</span>
          </div>
        </div>
      </OutgoingBubble>

      {/* 8. Launch Button (inline keyboard style) */}
      <div className="max-w-[85%] ml-auto flex flex-col gap-1">
        <button
          type="button"
          className="w-full bg-pump-green text-black font-bold rounded-lg py-3 text-center text-sm hover:brightness-110 transition"
        >
          🚀 Create Token
        </button>
        <p className="text-[11px] text-zinc-500 text-center">
          This is a demo — use @pumpkit/monitor to build a real bot
        </p>
      </div>

      {/* 9. Info Footer */}
      <IncomingBubble time="14:07">
        <p className="text-sm mb-3">
          Want to integrate token creation into your own bot? Check out the SDK docs:
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/docs"
            className="bg-tg-input text-tg-blue text-sm rounded-lg px-4 py-2 text-center hover:brightness-110 transition"
          >
            📖 SDK Docs
          </Link>
          <Link
            to="/packages"
            className="bg-tg-input text-tg-blue text-sm rounded-lg px-4 py-2 text-center hover:brightness-110 transition"
          >
            📦 Packages
          </Link>
        </div>
      </IncomingBubble>
    </div>
  );
}
