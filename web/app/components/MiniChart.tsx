'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface Props {
  data: number[];
  color: string;
  variant?: 'area' | 'bars';
  width?: number;
  height?: number;
}

/** Sparkline SVG (área con línea, o barras) con dibujo animado por GSAP. */
export default function MiniChart({ data, color, variant = 'area', width = 220, height = 56 }: Props) {
  const rootRef = useRef<SVGSVGElement>(null);
  const max = Math.max(1, ...data);
  const n = data.length;

  useGSAP(() => {
    if (!rootRef.current) return;
    if (variant === 'area') {
      const path = rootRef.current.querySelector<SVGPathElement>('.spark-line');
      if (path) {
        const len = path.getTotalLength();
        gsap.fromTo(path, { strokeDashoffset: len, strokeDasharray: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out' });
      }
      gsap.from(rootRef.current.querySelector('.spark-fill'), { opacity: 0, duration: 1, delay: 0.3 });
    } else {
      gsap.from(rootRef.current.querySelectorAll('.spark-bar'), {
        scaleY: 0, transformOrigin: 'bottom', stagger: 0.05, duration: 0.7, ease: 'power2.out',
      });
    }
  }, { dependencies: [data, variant] });

  if (variant === 'bars') {
    const gap = 4;
    const bw = (width - gap * (n - 1)) / n;
    return (
      <svg ref={rootRef} width={width} height={height} className="overflow-visible">
        {data.map((v, i) => {
          const h = (v / max) * height;
          return (
            <rect
              key={i}
              className="spark-bar"
              x={i * (bw + gap)}
              y={height - h}
              width={bw}
              height={h}
              rx={Math.min(3, bw / 2)}
              fill={color}
              opacity={0.55 + 0.45 * (v / max)}
            />
          );
        })}
      </svg>
    );
  }

  const pts = data.map((v, i) => [(i / (n - 1)) * width, height - (v / max) * (height - 4) - 2]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const gid = `sparkfill-${color.replace('#', '')}`;

  return (
    <svg ref={rootRef} width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="spark-fill" d={area} fill={`url(#${gid})`} />
      <path className="spark-line" d={line} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
