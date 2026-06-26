'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'ios' | 'native' | 'manual' | null;

function detectMode(): Mode {
  // Already installed
  if (window.matchMedia('(display-mode: standalone)').matches) return null;
  // iOS Safari — no beforeinstallprompt support
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) && !(window as unknown as Record<string, unknown>).MSStream;
  if (isIos) return 'ios';
  // Chrome/Edge/Samsung — will use beforeinstallprompt or fallback
  return 'manual';
}

export default function PwaInstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return;

    const detected = detectMode();
    if (!detected) return;

    setMode(detected);

    if (detected !== 'ios') {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setMode('native');
      };
      window.addEventListener('beforeinstallprompt', handler);

      // Show manual hint after 2s if native prompt hasn't fired
      const timer = setTimeout(() => {
        setMode((prev) => (prev === 'manual' ? 'manual' : prev));
      }, 2000);

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(timer);
      };
    }
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted' || outcome === 'dismissed') {
        setDeferredPrompt(null);
        setMode(null);
      }
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
    setDismissed(true);
  };

  if (!mode || dismissed) return null;

  return (
    <div
      role="banner"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm
                 glass-strong rounded-2xl px-4 py-3.5 flex items-start gap-3"
      style={{ animation: 'fadeSlideUp 0.35s ease-out' }}
    >
      {/* Icon */}
      <div className="shrink-0 w-10 h-10 rounded-xl bg-presupuesto/10 grid place-items-center mt-0.5">
        {mode === 'ios' ? (
          /* Share icon for iOS */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-presupuesto">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        ) : (
          /* Download icon for Chrome/Android */
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-presupuesto">
            <path d="M12 2v13M8 11l4 4 4-4" />
            <path d="M20 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
          </svg>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink leading-tight">Instalar Vigía</p>
        {mode === 'ios' && (
          <p className="text-[11px] text-inksoft mt-1 leading-snug">
            Toca <span className="font-semibold">Compartir</span>{' '}
            <span className="inline-block text-[10px]">⎙</span>{' '}
            y luego <span className="font-semibold">&ldquo;Agregar a inicio&rdquo;</span>
          </p>
        )}
        {mode === 'native' && (
          <p className="text-[11px] text-inksoft mt-0.5 leading-tight">
            Acceso rápido desde tu pantalla de inicio
          </p>
        )}
        {mode === 'manual' && (
          <p className="text-[11px] text-inksoft mt-1 leading-snug">
            Toca el ícono <span className="font-semibold">⊕</span> en la barra de direcciones
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleDismiss}
          aria-label="Cerrar"
          className="w-7 h-7 rounded-lg grid place-items-center text-inkfaint hover:text-inksoft hover:bg-black/5 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {mode === 'native' && (
          <button
            onClick={handleInstall}
            className="px-3.5 py-1.5 rounded-xl bg-presupuesto text-white text-[12px] font-semibold
                       hover:bg-presupuesto/90 transition-colors shadow-pill"
          >
            Instalar
          </button>
        )}
      </div>
    </div>
  );
}
