import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans:    ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Tinta (texto) sobre fondo claro
        ink:      '#191b2e',
        inksoft:  '#565a7c',
        inkfaint: '#9298bd',
        // Acentos por capa de datos del Estado
        presupuesto: { DEFAULT: '#6366f1', soft: '#a5b4fc' },
        servicios:   { DEFAULT: '#14b8a6', soft: '#5eead4' },
        planilla:    { DEFAULT: '#f59e0b', soft: '#fcd34d' },
        obras:       { DEFAULT: '#f43f5e', soft: '#fda4af' },
        // Escala de riesgo (red flags)
        risk: { low: '#eab308', medium: '#f97316', high: '#ef4444' },
      },
      boxShadow: {
        glass:   '0 10px 40px -8px rgba(30,34,90,0.16), inset 0 1px 0 rgba(255,255,255,0.65)',
        float:   '0 18px 50px -12px rgba(30,34,90,0.28), inset 0 1px 0 rgba(255,255,255,0.7)',
        pill:    '0 6px 18px -4px rgba(30,34,90,0.18)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        floaty: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-6px)' },
        },
        pulsering: {
          '0%':   { transform: 'scale(0.6)', opacity: '0.7' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        floaty:    'floaty 6s ease-in-out infinite',
        pulsering: 'pulsering 2.4s ease-out infinite',
        shimmer:   'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
