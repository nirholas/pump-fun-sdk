import { Link } from 'react-router-dom';

function BotBubble({ children, time }: { children: React.ReactNode; time?: string }) {
  return (
    <div className="flex gap-2 items-start max-w-[85%] mr-auto">
      <div className="w-8 h-8 rounded-full bg-tg-input flex items-center justify-center text-sm shrink-0 mt-1">
        🪙
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-tg-bubble-in rounded-2xl rounded-bl-sm px-4 py-3 text-white">
          <p className="text-tg-blue text-sm font-medium mb-1">Token Launch</p>
          {children}
        </div>
        {time && <p className="text-[11px] text-zinc-500 mt-1 text-right">{time}</p>}
      </div>
    </div>
  );
}

function UserBubble({ children, time }: { children: React.ReactNode; time?: string }) {
  return (
    <div className="max-w-[85%] ml-auto">
      <div className="bg-tg-bubble rounded-2xl rounded-br-sm px-4 py-3 text-white">
        {children}
      </div>
      {time && <p className="text-[11px] text-zinc-500 mt-1 text-right">{time}</p>}
    </div>
  );
}

const lifecycle = [
  {
    emoji: '🪙',
    title: 'Create',
    desc: 'Mint a new SPL token with metadata, image, and bonding curve',
    color: 'text-tg-blue',
  },
  {
    emoji: '📈',
    title: 'Bond',
    desc: 'Trade on the bonding curve — price rises with each buy',
    color: 'text-pump-green',
  },
  {
    emoji: '🎓',
    title: 'Graduate',
    desc: 'At ~$69K market cap, liquidity migrates to PumpSwap AMM',
    color: 'text-pump-purple',
  },
  {
    emoji: '💱',
    title: 'Trade',
    desc: 'Full AMM trading with LP positions, fee sharing, and cashback',
    color: 'text-pump-cyan',
  },
];

const features = [
  { emoji: '⚡', title: 'createV2', desc: 'Latest instruction with mayhem mode + cashback support' },
  { emoji: '🔄', title: 'Fee Sharing', desc: 'Split creator fees across multiple shareholders (10,000 BPS)' },
  { emoji: '💰', title: 'Cashback', desc: 'Volume-based rewards via UserVolumeAccumulator PDA' },
  { emoji: '🌪️', title: 'Mayhem Mode', desc: 'Enhanced launch mechanics for viral token creation' },
  { emoji: '📊', title: 'Analytics', desc: 'Price impact, graduation progress, bonding curve math' },
  { emoji: '🤖', title: 'Bot Ready', desc: 'All instructions return TransactionInstruction[] — compose freely' },
];

export function CreateCoin() {
  return (
    <div className="flex flex-col gap-3 p-4 max-w-3xl mx-auto pb-20">
      {/* Date separator */}
      <div className="text-center">
        <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
          Token Launch Guide
        </span>
      </div>

      {/* 1. Intro */}
      <BotBubble time="14:00">
        <p className="text-lg font-semibold mb-2">How tokens work on PumpFun</p>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Every token on PumpFun follows the same lifecycle: <strong>create → bond → graduate → trade</strong>.
          PumpKit gives you TypeScript tools to build Telegram bots that handle every stage.
        </p>
      </BotBubble>

      {/* 2. Token Lifecycle */}
      <UserBubble time="14:01">
        <p className="text-sm font-medium mb-3 text-zinc-300">🔄 Token Lifecycle</p>
        <div className="grid grid-cols-2 gap-2">
          {lifecycle.map((step) => (
            <div key={step.title} className="bg-tg-bubble-in/60 rounded-lg p-3">
              <p className="text-xl mb-1">{step.emoji}</p>
              <p className={`text-sm font-semibold ${step.color}`}>{step.title}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{step.desc}</p>
            </div>
          ))}
        </div>
      </UserBubble>

      {/* 3. The PumpFun Token Card (visual showcase) */}
      <BotBubble time="14:02">
        <p className="text-sm font-medium mb-3">Here&apos;s what a token looks like on PumpFun:</p>
        <div className="bg-gradient-to-br from-[#1a2332] to-[#0d1520] rounded-xl p-4 border border-tg-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pump-green/30 to-pump-purple/30 flex items-center justify-center text-2xl">
              🐸
            </div>
            <div>
              <p className="text-base font-bold text-white">PumpKitty</p>
              <p className="text-sm text-pump-green font-mono">$KITTY</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-zinc-500">Market Cap</p>
              <p className="text-sm font-bold text-pump-green">$42,069</p>
            </div>
          </div>
          {/* Bonding curve progress */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span>Bonding Curve Progress</span>
              <span className="text-pump-green">61%</span>
            </div>
            <div className="w-full h-2 bg-tg-input rounded-full overflow-hidden">
              <div className="h-full w-[61%] bg-gradient-to-r from-pump-green to-pump-cyan rounded-full transition-all" />
            </div>
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-tg-input/60 rounded-lg py-1.5">
              <p className="text-xs text-zinc-500">24h Vol</p>
              <p className="text-sm font-medium text-white">$12.4K</p>
            </div>
            <div className="bg-tg-input/60 rounded-lg py-1.5">
              <p className="text-xs text-zinc-500">Holders</p>
              <p className="text-sm font-medium text-white">847</p>
            </div>
            <div className="bg-tg-input/60 rounded-lg py-1.5">
              <p className="text-xs text-zinc-500">Txns</p>
              <p className="text-sm font-medium text-white">2,341</p>
            </div>
          </div>
          {/* Fake inline buttons */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <span className="bg-tg-input text-pump-green text-xs rounded-lg px-3 py-2 text-center font-medium">
              Buy
            </span>
            <span className="bg-tg-input text-pump-pink text-xs rounded-lg px-3 py-2 text-center font-medium">
              Sell
            </span>
          </div>
        </div>
      </BotBubble>

      {/* 4. Code — Create Token */}
      <div className="text-center">
        <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
          Build with PumpKit
        </span>
      </div>

      <BotBubble time="14:03">
        <p className="text-sm font-medium mb-2">⚡ Create a token in ~10 lines:</p>
        <div className="bg-[#1a2332] rounded-lg p-3 overflow-x-auto">
          <pre className="font-mono text-xs text-zinc-300 whitespace-pre">{`import { PUMP_SDK } from "@nirholas/pump-sdk";
import { Keypair } from "@solana/web3.js";

const mint = Keypair.generate();

const instructions = await PUMP_SDK.createV2Instruction({
  mint: mint.publicKey,
  name: "PumpKitty",
  symbol: "KITTY",
  uri: "https://arweave.net/metadata.json",
  creator: wallet.publicKey,
  user: wallet.publicKey,
  mayhemMode: false,
  cashback: true,
});

// → returns TransactionInstruction[]
// Add to a transaction and send!`}</pre>
        </div>
      </BotBubble>

      {/* 5. Code — Buy Tokens */}
      <UserBubble time="14:04">
        <p className="text-sm font-medium mb-2">📈 Buy tokens on the bonding curve:</p>
        <div className="bg-[#1a2332] rounded-lg p-3 overflow-x-auto">
          <pre className="font-mono text-xs text-zinc-300 whitespace-pre">{`import { OnlinePumpSdk } from "@nirholas/pump-sdk";
import BN from "bn.js";

const online = new OnlinePumpSdk(connection);
const global = await online.fetchGlobal();
const state = await online.fetchBuyState(mint, user);

const buyIxs = await PUMP_SDK.buyInstructions({
  global,
  bondingCurve: state.bondingCurve,
  bondingCurveAccountInfo: state.bondingCurveAccountInfo,
  associatedUserAccountInfo: state.associatedUserAccountInfo,
  mint,
  user: wallet.publicKey,
  solAmount: new BN(500_000_000), // 0.5 SOL
  amount: tokensOut,
  slippage: 1,
  tokenProgram: TOKEN_PROGRAM_ID,
});`}</pre>
        </div>
      </UserBubble>

      {/* 6. Code — Fee Sharing */}
      <BotBubble time="14:05">
        <p className="text-sm font-medium mb-2">🔄 Set up fee sharing (split revenue):</p>
        <div className="bg-[#1a2332] rounded-lg p-3 overflow-x-auto">
          <pre className="font-mono text-xs text-zinc-300 whitespace-pre">{`const feeIx = await PUMP_SDK.createFeeSharingConfig({
  mint,
  shareholders: [
    { address: creator, shareBps: 7000 },  // 70%
    { address: partner, shareBps: 3000 },  // 30%
  ],
  user: wallet.publicKey,
});
// Shares must total exactly 10,000 BPS`}</pre>
        </div>
      </BotBubble>

      {/* 7. Features grid */}
      <div className="text-center">
        <span className="bg-tg-input/80 text-zinc-400 text-xs px-3 py-1 rounded-full">
          SDK Features
        </span>
      </div>

      <UserBubble time="14:06">
        <div className="grid grid-cols-2 gap-2">
          {features.map((f) => (
            <div key={f.title} className="bg-tg-bubble-in/60 rounded-lg px-3 py-2.5">
              <p className="text-base mb-0.5">{f.emoji} <span className="text-sm font-medium">{f.title}</span></p>
              <p className="text-xs text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </UserBubble>

      {/* 8. Telegram Bot Integration */}
      <BotBubble time="14:07">
        <p className="text-sm font-medium mb-2">🤖 Wire it into a Telegram bot:</p>
        <div className="bg-[#1a2332] rounded-lg p-3 overflow-x-auto">
          <pre className="font-mono text-xs text-zinc-300 whitespace-pre">{`// With PumpKit's bot framework:
import { createBot } from '@pumpkit/core';

const bot = createBot({
  token: process.env.BOT_TOKEN!,
  commands: {
    launch: async (ctx) => {
      // Build create instructions with pump-sdk
      // Sign and send transaction
      // Reply with token card
      ctx.reply("🚀 Token launched! CA: ...");
    },
  },
});`}</pre>
        </div>
      </BotBubble>

      {/* 9. CTA */}
      <BotBubble time="14:08">
        <p className="text-sm mb-3">
          Ready to build your own token launch bot? Start with the full docs or
          check out the packages:
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Link
            to="/docs"
            className="bg-tg-input text-tg-blue text-sm rounded-lg px-3 py-2 text-center hover:brightness-110 transition"
          >
            📖 Docs
          </Link>
          <Link
            to="/packages"
            className="bg-tg-input text-tg-blue text-sm rounded-lg px-3 py-2 text-center hover:brightness-110 transition"
          >
            📦 Packages
          </Link>
          <a
            href="https://github.com/nirholas/pumpkit"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-tg-input text-tg-blue text-sm rounded-lg px-3 py-2 text-center hover:brightness-110 transition"
          >
            ⭐ GitHub
          </a>
        </div>
      </BotBubble>
    </div>
  );
}
