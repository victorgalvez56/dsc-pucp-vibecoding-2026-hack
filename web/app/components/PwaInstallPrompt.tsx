'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed (running as standalone PWA)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Don't show if user already dismissed this session
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-prompt-dismissed', '1');
    setDismissed(true);
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div
      role="banner"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm
                 glass-strong rounded-2xl px-4 py-3.5 flex items-center gap-3
                 animate-[fadeSlideUp_0.35s_ease-out]"
      style={{ animation: 'fadeSlideUp 0.35s ease-out' }}
    >
      {/* Icon */}
      <div className="shrink-0 w-10 h-10 rounded-xl bg-presupuesto/10 grid place-items-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-presupuesto">
          <path d="M12 2v13M8 11l4 4 4-4" />
          <path d="M20 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-ink leading-tight">Instalar Vigía</p>
        <p className="text-[11px] text-inksoft mt-0.5 leading-tight">
          Acceso rápido desde tu pantalla de inicio
        </p>
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
        <button
          onClick={handleInstall}
          className="px-3.5 py-1.5 rounded-xl bg-presupuesto text-white text-[12px] font-semibold
                     hover:bg-presupuesto/90 transition-colors shadow-pill"
        >
          Instalar
        </button>
      </div>
    </div>
  );
}
