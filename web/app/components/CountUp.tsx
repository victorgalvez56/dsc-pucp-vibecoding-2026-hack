'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface Props {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}

/** Cuenta animada con GSAP. Re-anima cuando cambia `value`. */
export default function CountUp({ value, format = (v) => Math.round(v).toString(), duration = 1.1, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useGSAP(() => {
    const obj = { v: prev.current };
    gsap.to(obj, {
      v: value,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) ref.current.textContent = format(obj.v);
      },
      onComplete: () => { prev.current = value; },
    });
  }, { dependencies: [value] });

  return <span ref={ref} className={className}>{format(value)}</span>;
}
