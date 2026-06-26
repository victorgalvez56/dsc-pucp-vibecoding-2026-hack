'use client';

import type { MapLayer, PerformanceRegional } from '@/lib/types';
import { LAYERS } from '@/lib/layers';
import { titleCase } from '@/lib/format';
import MiniChart from './MiniChart';
import CountUp from './CountUp';

interface Props {
  layerId: MapLayer;
  rows: PerformanceRegional[];
}

export default function MapInsightCards({ layerId, rows }: Props) {
  const cfg = LAYERS[layerId];

  // serie ordenada (desc) del valor de la capa por región
  const sorted = [...rows]
    .map((r) => ({ region: r.region, v: cfg.metric(r) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);

  const trend = sorted.slice(0, 12).map((x) => x.v).reverse();
  const bars = sorted.slice(0, 8).map((x) => x.v);
  const heroVal = cfg.hero.value(rows);
  const leader = sorted[0];

  return (
    <div className="absolute bottom-6 left-6 right-6 z-10 hidden xl:flex gap-4 pointer-events-none justify-start">
      {/* Tendencia */}
      <div className="glass-strong rounded-3xl p-4 w-[300px] pointer-events-auto">
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-[12px] font-semibold text-ink">Tendencia · {cfg.label}</div>
            <div className="text-[10px] text-inksoft">Distribución entre regiones</div>
          </div>
          <CountUp
            value={heroVal}
            format={cfg.hero.fmt}
            className="font-display text-[18px] font-semibold nums"
          />
        </div>
        <MiniChart data={trend.length ? trend : [1, 2, 3]} color={cfg.accent} variant="area" width={268} height={52} />
      </div>

      {/* Cobertura / concentración */}
      <div className="glass-strong rounded-3xl p-4 w-[300px] pointer-events-auto">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[12px] font-semibold text-ink">Concentración regional</div>
            <div className="text-[10px] text-inksoft">
              {leader ? `Lidera ${titleCase(leader.region)}` : 'Sin datos'}
            </div>
          </div>
          <span
            className="text-[11px] font-bold px-2 py-1 rounded-lg text-white"
            style={{ background: `linear-gradient(135deg, ${cfg.gradient[0]}, ${cfg.gradient[1]})` }}
          >
            Top 8
          </span>
        </div>
        <MiniChart data={bars.length ? bars : [1, 2, 3, 4]} color={cfg.accent} variant="bars" width={268} height={52} />
      </div>
    </div>
  );
}
