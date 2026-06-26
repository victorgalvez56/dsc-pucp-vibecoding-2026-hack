'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker en producción. No renderiza nada.
 * En desarrollo se omite para no cachear builds en caliente.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('[Vigía] Falló el registro del service worker:', err);
      });
    };

    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
