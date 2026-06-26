import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegister from './components/ServiceWorkerRegister';

export const metadata: Metadata = {
  applicationName: 'Vigía',
  title: 'Vigía · Monitor del Estado Peruano',
  description:
    'Cuatro capas de datos abiertos del Estado peruano —presupuesto, servicios, planilla y obras— en un solo mapa con scoring de riesgo explicable.',
  appleWebApp: {
    capable: true,
    title: 'Vigía',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#eef1ff',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <head>
        {/* Tipografías distintivas (Fontshare, gratuitas) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;900&display=swap"
          rel="stylesheet"
        />
        {/* El CSS de MapLibre GL v5 se importa dentro de MapClient.tsx */}
      </head>
      <body className="h-full overflow-hidden font-sans text-ink antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
