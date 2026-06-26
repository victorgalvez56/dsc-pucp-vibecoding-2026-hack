import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vigía — Monitor de Obras Públicas Perú',
  description:
    'Detecta irregularidades en contratos y obras del Estado peruano con scoring explicable.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <head>
        {/* MapLibre GL JS CSS — cargado via CDN para no complicar el bundle */}
        <link
          href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-slate-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
