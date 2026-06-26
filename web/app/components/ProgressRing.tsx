'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface Props {
  pct: number;          // 0..100
  label: string;
  caption: string;
  color: string;
  size?: number;
}

export default function ProgressRing({ pct, label, caption, color, size = 64 }: Props) {
  const ringRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(100, pct));

  useGSAP(() => {
    if (ringRef.current) {
      gsap.fromTo(
        ringRef.current,
        { strokeDashoffset: circ },
        { strokeDashoffset: circ * (1 - target / 100), duration: 1.3, ease: 'power3.out' },
      );
    }
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target,
      duration: 1.3,
      ease: 'power3.out',
      onUpdate: () => { if (numRef.current) numRef.current.textContent = `${Math.round(obj.v)}%`; },
    });
  }, { dependencies: [target] });

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(120,124,170,0.16)" strokeWidth={stroke} />
          <circle
            ref={ringRef}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ}
          />
        </svg>
        <span
          ref={numRef}
          className="absolute inset-0 grid place-items-center font-display text-sm font-semibold nums"
          style={{ color }}
        >
          0%
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-ink leading-tight">{label}</div>
        <div className="text-[11px] text-inksoft leading-snug">{caption}</div>
      </div>
    </div>
  );
}
