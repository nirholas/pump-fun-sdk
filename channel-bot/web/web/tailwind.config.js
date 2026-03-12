/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Telegram-inspired palette
        tg: {
          bg: '#17212b',          // main background (dark mode)
          sidebar: '#0e1621',     // sidebar / left panel
          chat: '#0e1621',        // chat area background
          header: '#17212b',      // top bar
          input: '#242f3d',       // input fields / cards
          hover: '#202b36',       // hover state
          border: '#1c2733',      // subtle borders
          blue: '#5eb5f7',        // telegram blue (links, accent)
          green: '#4fae4e',       // online / success
          bubble: '#2b5278',      // outgoing message bubble
          'bubble-in': '#182533', // incoming message bubble
        },
        // PumpFun accent colors
        pump: {
          green: '#00e676',       // buy / success / launch
          pink: '#ff6b9d',        // sell / hot
          yellow: '#ffd54f',      // warnings / trending
          purple: '#b388ff',      // graduation
          orange: '#ff9100',      // whale
          cyan: '#00e5ff',        // info
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
      },
      boxShadow: {
        'tg': '0 1px 2px rgba(0, 0, 0, 0.3)',
        'tg-lg': '0 2px 8px rgba(0, 0, 0, 0.4)',
        'glow-green': '0 0 12px rgba(0, 230, 118, 0.2)',
        'glow-blue': '0 0 12px rgba(94, 181, 247, 0.2)',
      },
    },
  },
  plugins: [],
};
