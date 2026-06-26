'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import type { MapLayer, PerformanceRegional } from '@/lib/types';
import { LAYERS } from '@/lib/layers';
import { formatPENCompact, formatInt } from '@/lib/format';
import Image from 'next/image';
import Icon from './Icon';
import CountUp from './CountUp';
import { withLayer, type LayerInjectedProps } from '@/app/hoc/withLayer';
import ProgressRing from './ProgressRing';
import RegionRankList from './RegionRankList';

gsap.registerPlugin(useGSAP);

const sum = (rows: PerformanceRegional[], f: (r: PerformanceRegional) => number) =>
  rows.reduce((a, r) => a + (f(r) || 0), 0);

function strip(layer: MapLayer, rows: PerformanceRegional[]): { k: string; v: string }[] {
  switch (layer) {
    case 'presupuesto': {
      const pim = sum(rows, (r) => r.pim_total);
      const dev = sum(rows, (r) => r.devengado_total);
      return [
        { k: 'PIM nacional', v: formatPENCompact(pim) },
        { k: 'Sin ejecutar', v: formatPENCompact(pim - dev) },
        { k: 'Regiones', v: `${rows.filter((r) => r.pim_total > 0).length}` },
      ];
    }
    case 'servicios':
      return [
        { k: 'Escuelas', v: formatInt(sum(rows, (r) => r.n_escuelas)) },
        { k: 'Salud', v: formatInt(sum(rows, (r) => r.n_postas + r.n_hospitales)) },
        { k: 'Regiones', v: '25' },
      ];
    case 'planilla': {
      const planillaMes = sum(rows, (r) => r.n_empleados * r.sueldo_promedio);
      const sueldos = rows.filter((r) => r.sueldo_promedio > 0).map((r) => r.sueldo_promedio);
      const avg = sueldos.length ? sueldos.reduce((a, b) => a + b, 0) / sueldos.length : 0;
      return [
        { k: 'Planilla/mes', v: formatPENCompact(planillaMes) },
        { k: 'Sueldo prom.', v: `S/ ${formatInt(avg)}` },
        { k: 'Entidades', v: `${rows.length}` },
      ];
    }
    case 'obras': {
      const con = rows.filter((r) => r.n_obras_riesgo > 0);
      const scores = con.map((r) => r.score_promedio).filter((s) => s > 0);
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return [
        { k: 'Obras marcadas', v: formatInt(sum(rows, (r) => r.n_obras_riesgo)) },
        { k: 'Score prom.', v: `${Math.round(avg)}` },
        { k: 'Regiones', v: `${con.length}` },
      ];
    }
  }
}

interface Props extends LayerInjectedProps {
  rows: PerformanceRegional[];
  onHoverRegion?: (raw: string | null) => void;
  onSelectRegion?: (raw: string) => void;
}

function StatsPanel({ activeLayer, rows, onHoverRegion, onSelectRegion }: Props) {
  const layerId = activeLayer;
  const layer = LAYERS[layerId];
  const rootRef = useRef<HTMLDivElement>(null);
  const heroVal = layer.hero.value(rows);
  const [ringA, ringB] = layer.rings(rows);
  const rankRows = layer.rank.rows(rows);
  const facts = strip(layerId, rows);

  useGSAP(() => {
    gsap.from('.panel-block', { y: 14, autoAlpha: 0, duration: 0.55, ease: 'power2.out', stagger: 0.08 });
  }, { dependencies: [layerId], scope: rootRef });

  return (
    <div
      ref={rootRef}
      id="tour-stats"
      className="order-2 lg:order-none w-full lg:w-[350px] xl:w-[380px] shrink-0 lg:h-full lg:overflow-y-auto px-5 py-5 lg:px-6 lg:py-6 flex flex-col gap-5 lg:gap-6"
    >
      {/* Logo */}
      <div className="panel-block">
        <Image src="/icons/vigia-logo.png" alt="Vigía" width={40} height={40} className="rounded-xl" priority />
      </div>

      {/* Encabezado */}
      <div className="panel-block flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-semibold text-ink leading-tight tracking-tight">
            Estadísticas generales
          </h1>
          <p className="text-[12px] text-inksoft mt-0.5">{layer.short}</p>
        </div>
        <button className="flex items-center gap-1 text-[11px] font-semibold text-inksoft hover:text-ink transition-colors">
          Detalle <Icon name="chevron" size={13} />
        </button>
      </div>

      {/* Hero */}
      <div className="panel-block">
        <p className="text-[11px] uppercase tracking-[0.14em] text-inkfaint font-semibold mb-1">
          {layer.hero.label}
        </p>
        <CountUp
          value={heroVal}
          format={layer.hero.fmt}
          className="font-display text-[38px] lg:text-[44px] leading-none font-semibold text-ink nums block"
        />
        {/* Micro-stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {facts.map((f) => (
            <div key={f.k} className="glass rounded-2xl px-3 py-2.5">
              <div className="text-[15px] font-bold text-ink nums leading-none">{f.v}</div>
              <div className="text-[10px] text-inksoft mt-1 leading-tight">{f.k}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Anillos */}
      <div className="panel-block glass rounded-3xl p-4 flex flex-col gap-4">
        <ProgressRing pct={ringA.pct} label={ringA.label} caption={ringA.caption} color={layer.accent} />
        <div className="h-px bg-gradient-to-r from-transparent via-black/5 to-transparent" />
        <ProgressRing pct={ringB.pct} label={ringB.label} caption={ringB.caption} color={layer.gradient[0]} />
      </div>

      {/* Ranking */}
      <div className="panel-block">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-display text-[15px] font-semibold text-ink">{layer.rank.label}</h2>
          <span className="text-[10px] uppercase tracking-wider text-inkfaint font-semibold">Ver todo</span>
        </div>
        <p className="text-[11px] text-inksoft mb-3 -mt-1.5">{layer.rank.note}</p>
        <RegionRankList rows={rankRows} gradient={layer.gradient} onHover={onHoverRegion} onSelect={onSelectRegion} />
      </div>
    </div>
  );
}

export default withLayer(StatsPanel);
