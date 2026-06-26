import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          low:    '#eab308',
          medium: '#f97316',
          high:   '#ef4444',
        },
      },
    },
  },
  plugins: [],
};

export default config;
