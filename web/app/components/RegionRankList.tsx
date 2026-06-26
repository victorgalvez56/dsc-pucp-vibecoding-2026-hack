'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import type { RankRow } from '@/lib/layers';

gsap.registerPlugin(useGSAP);

interface Props {
  rows: RankRow[];
  gradient: [string, string];
  onHover?: (raw: string | null) => void;
  onSelect?: (raw: string) => void;
}

export default function RegionRankList({ rows, gradient, onHover, onSelect }: Props) {
  const ref = useRef<HTMLUListElement>(null);

  useGSAP(() => {
    gsap.from('.rank-row', {
      x: -16, autoAlpha: 0, duration: 0.5, ease: 'power2.out', stagger: 0.06,
    });
  }, { dependencies: [rows], scope: ref });

  return (
    <ul ref={ref} className="space-y-2">
      {rows.map((r, i) => (
        <li
          key={r.raw}
          className="rank-row flex items-center gap-3 cursor-pointer group"
          onMouseEnter={() => onHover?.(r.raw)}
          onMouseLeave={() => onHover?.(null)}
          onClick={() => onSelect?.(r.raw)}
        >
          <div className="flex-1 min-w-0">
            <div
              className="relative flex items-center h-9 rounded-xl px-3 text-white text-[13px] font-semibold shadow-pill overflow-hidden transition-transform duration-200 group-hover:scale-[1.015] group-active:scale-100"
              style={{
                width: `${Math.max(52, r.pct)}%`,
                background: `linear-gradient(100deg, ${gradient[0]}, ${gradient[1]})`,
              }}
            >
              <span className="truncate">{r.region}</span>
              <span className="ml-auto pl-2 text-[10px] font-bold opacity-80 tabular-nums">{i + 1}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[13px] font-bold text-ink nums leading-none">{r.display}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
