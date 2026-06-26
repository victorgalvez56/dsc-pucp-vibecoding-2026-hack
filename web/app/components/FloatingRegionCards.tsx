'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import type { MapLayer } from '@/lib/types';
import { LAYERS, type RankRow } from '@/lib/layers';
import GlyphChip from './GlyphChip';

gsap.registerPlugin(useGSAP);

const POS = [
  'top-[11%] left-[8%]',
  'top-[30%] right-[7%]',
  'bottom-[33%] left-[16%]',
];

interface Props {
  layerId: MapLayer;
  rows: RankRow[];
  onSelect?: (raw: string) => void;
}

export default function FloatingRegionCards({ layerId, rows, onSelect }: Props) {
  const cfg = LAYERS[layerId];
  const ref = useRef<HTMLDivElement>(null);
  const top = rows.slice(0, 3);

  useGSAP(() => {
    gsap.from('.float-card', {
      y: 18, scale: 0.9, autoAlpha: 0, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.12,
    });
  }, { dependencies: [layerId], scope: ref });

  return (
    <div ref={ref} className="absolute inset-0 pointer-events-none z-10 hidden lg:block">
      {top.map((r, i) => (
        <div key={r.raw} className={`float-card absolute ${POS[i]} animate-floaty`} style={{ animationDelay: `${i * 0.8}s` }}>
          <button
            onClick={() => onSelect?.(r.raw)}
            className="pointer-events-auto glass-strong rounded-2xl pl-2.5 pr-4 py-2 flex items-center gap-2.5 shadow-float transition-transform hover:scale-[1.04] active:scale-100"
          >
            <GlyphChip glyph={cfg.glyph} gradient={cfg.gradient} size={34} />
            <div className="text-left">
              <div className="text-[11px] text-inksoft leading-none mb-1">{r.region}</div>
              <div className="font-display text-[16px] font-semibold text-ink nums leading-none">{r.display}</div>
            </div>
          </button>
          {/* conector */}
          <span className="block w-2.5 h-2.5 rounded-full bg-white shadow-pill ring-1 ring-black/5 mt-1 ml-6" />
        </div>
      ))}
    </div>
  );
}
