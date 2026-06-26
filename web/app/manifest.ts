import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vigía · Monitor del Estado Peruano',
    short_name: 'Vigía',
    description:
      'Cuatro capas de datos abiertos del Estado peruano —presupuesto, servicios, planilla y obras— en un solo mapa con scoring de riesgo explicable.',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    lang: 'es-PE',
    dir: 'ltr',
    background_color: '#eef1ff',
    theme_color: '#6366f1',
    categories: ['government', 'utilities', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
