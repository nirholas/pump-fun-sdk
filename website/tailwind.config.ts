import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* Lair Ultramarine palette */
        primary: '#080A19',
        'primary-foreground': '#A7C2F3',
        muted: '#4B5E8C',
        'muted-foreground': '#7B93C4',
        border: '#1A1E3D',
        'border-light': '#2A3060',
        card: '#0C0F27',
        'card-light': '#15183E',
        accent: 'rgb(97, 121, 255)',
        'accent-hover': '#70BCF9',
        'accent-text': '#0F1538',
        good: '#85FF85',
        bad: '#AC4949',
        solana: '#6179FF',
        'solana-green': '#85FF85',
        dark: {
          900: '#080A19',
          800: '#0C0F27',
          700: '#15183E',
          600: '#1A1E3D',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        sans: ['Poppins', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 2s ease-in-out infinite alternate',
        scan: 'scan 2s linear infinite',
        float: 'float 6s ease-in-out infinite',
        gradient: 'gradient 8s ease infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        pop: 'pop 0.5s cubic-bezier(0.36, 0.38, 0, 0.94)',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(97, 121, 255, 0.3), 0 0 10px rgba(97, 121, 255, 0.1)' },
          '100%': { boxShadow: '0 0 10px rgba(97, 121, 255, 0.5), 0 0 20px rgba(97, 121, 255, 0.2)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      backgroundImage: {
        'grid-pattern':
          'linear-gradient(to right, rgba(167, 194, 243, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(167, 194, 243, 0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '24px 24px',
      },
      borderRadius: {
        lair: '0.7em',
        'lair-sm': '0.35em',
      },
    },
  },
  plugins: [],
};

export default config;

