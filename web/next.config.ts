import type { NextConfig } from 'next';

const config: NextConfig = {
  // pg usa APIs de Node.js — no bundlear del lado del servidor
  serverExternalPackages: ['pg'],
};

export default config;
