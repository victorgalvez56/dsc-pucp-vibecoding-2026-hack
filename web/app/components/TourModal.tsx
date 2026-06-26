'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

type Side = 'center' | 'bottom' | 'right' | 'top';

interface Step {
  selector: string | null;
  side: Side;
  padding?: number;
  tag: string;
  title: string;
  body: string;
  layers?: { color: string; name: string }[];
}

const STEPS: Step[] = [
  {
    selector: null,
    side: 'center',
    tag: 'Bienvenido',
    title: 'Los datos del Estado, en un solo lugar',
    body: 'Vigía cruza datos abiertos del Estado peruano para detectar riesgos en obras públicas y convertirlos en un mapa forense explicable.',
  },
  {
    selector: '#tour-stats',
    side: 'right',
    padding: 12,
    tag: 'Estadísticas',
    title: 'Panel de métricas por capa',
    body: 'Aquí verás los indicadores clave de la capa activa: ejecución presupuestal, servicios, planilla o riesgo en obras.',
  },
  {
    selector: '#tour-layers',
    side: 'bottom',
    padding: 10,
    tag: 'Capas de datos',
    title: 'Cambia la capa que exploras',
    body: 'Cada pestaña activa una vista distinta sobre el gasto público peruano.',
  },
  {
    selector: '#tour-map',
    side: 'top',
    padding: 0,
    tag: 'Mapa forense',
    title: 'Toca una región del mapa',
    body: 'Se abre el panel forense: score de riesgo y razones explicables por obra.',
  },
];

interface Rect { top: number; left: number; width: number; height: number; }

const CARD_W = 300;
const GAP    = 14;
const STORAGE_KEY = 'vigia_tour_seen_v2';

export default function TourModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep]       = useState(0);
  const [fading, setFading]   = useState(false);
  const [spot, setSpot]       = useState<Rect | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  const measureSpot = useCallback((s: Step) => {
    if (!s.selector) { setSpot(null); return; }
    const el = document.querySelector<HTMLElement>(s.selector);
    if (!el) { setSpot(null); return; }
    const r = el.getBoundingClientRect();
    const p = s.padding ?? 8;
    setSpot({ top: r.top - p, left: r.left - p, width: r.width + p * 2, height: r.height + p * 2 });
  }, []);

  // Eleva el elemento objetivo sobre el backdrop para que sea visible
  useEffect(() => {
    if (!visible) return;
    const s = STEPS[step];
    const t = setTimeout(() => measureSpot(s), 80);

    const el = s.selector ? document.querySelector<HTMLElement>(s.selector) : null;
    if (el) {
      const prev = { zIndex: el.style.zIndex, position: el.style.position };
      el.style.zIndex = '45';
      el.style.position = 'relative';
      return () => {
        clearTimeout(t);
        el.style.zIndex = prev.zIndex;
        el.style.position = prev.position;
      };
    }
    return () => clearTimeout(t);
  }, [step, visible, measureSpot]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const goTo = (n: number) => {
    setFading(true);
    setTimeout(() => { setStep(n); setFading(false); }, 140);
  };

  if (!visible) return null;

  const current = STEPS[step];

  const cardStyle = (): React.CSSProperties => {
    if (!spot || current.side === 'center') {
      return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: CARD_W };
    }
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const clampX = (x: number) => Math.min(Math.max(x, 12), vw - CARD_W - 12);

    switch (current.side) {
      case 'bottom':
        return { position: 'fixed', top: spot.top + spot.height + GAP, left: clampX(spot.left + spot.width / 2 - CARD_W / 2), width: CARD_W };
      case 'right':
        return { position: 'fixed', top: Math.min(spot.top, vh - 320), left: Math.min(spot.left + spot.width + GAP, vw - CARD_W - 12), width: CARD_W };
      case 'top':
        return { position: 'fixed', bottom: vh - spot.top + GAP, left: clampX(spot.left + spot.width / 2 - CARD_W / 2), width: CARD_W };
      default:
        return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: CARD_W };
    }
  };

  return (
    <>
      {/* Backdrop solo cuando no hay spotlight (paso sin selector) */}
      {!spot && (
        <div className="fixed inset-0 z-40 pointer-events-none" style={{ background: 'rgba(20,22,46,0.55)' }} />
      )}

      {/* Spotlight — el box-shadow ES el backdrop; el hueco muestra el elemento real */}
      {spot && (
        <div
          className="fixed z-40 pointer-events-none"
          style={{
            top: spot.top, left: spot.left, width: spot.width, height: spot.height,
            borderRadius: 18,
            boxShadow: '0 0 0 9999px rgba(20,22,46,0.60)',
            outline: '2.5px solid rgba(255,255,255,0.35)',
          }}
        />
      )}

      {/* Click fuera para cerrar */}
      <div className="fixed inset-0 z-40" onClick={dismiss} />

      {/* Tarjeta tooltip */}
      <div
        className={`z-50 glass-strong rounded-[22px] p-6 flex flex-col gap-4 transition-all duration-150 ${fading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}
        style={cardStyle()}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={dismiss} className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-inkfaint hover:text-ink hover:bg-black/5 transition-all text-base">×</button>

        <div className="flex items-center gap-2">
          <Image src="/icons/vigia-logo.png" alt="" width={28} height={28} className="rounded-lg shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-inkfaint">{current.tag}</span>
        </div>

        <div>
          <h2 className="font-display text-[17px] font-semibold text-ink leading-snug">{current.title}</h2>
          <p className="text-[12px] text-inksoft mt-1.5 leading-relaxed">{current.body}</p>
        </div>

        {current.layers && (
          <div className="grid grid-cols-2 gap-1.5">
            {current.layers.map((l) => (
              <div key={l.name} className="flex items-center gap-2 glass rounded-xl px-3 py-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
                <span className="text-[11px] font-semibold text-ink">{l.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 items-center">
            {STEPS.map((_, i) => (
              <button key={i} onClick={() => goTo(i)} className="rounded-full transition-all duration-200"
                style={{ width: i === step ? 14 : 5, height: 5, background: i === step ? '#6366f1' : 'rgba(99,102,241,0.25)' }} />
            ))}
          </div>
          <div className="flex gap-1.5">
            {step > 0 && (
              <button onClick={() => goTo(step - 1)} className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-inksoft hover:text-ink hover:bg-black/5 transition-all">Atrás</button>
            )}
            <button
              onClick={() => step < STEPS.length - 1 ? goTo(step + 1) : dismiss()}
              className="px-4 py-1.5 rounded-xl text-[11px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#818cf8,#6366f1)' }}
            >
              {step < STEPS.length - 1 ? 'Siguiente →' : 'Explorar'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
