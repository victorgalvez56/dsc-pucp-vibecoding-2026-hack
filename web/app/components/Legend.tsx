'use client';

import type { MapLayer } from '@/lib/types';
import { LAYERS } from '@/lib/layers';

const LABELS: Record<MapLayer, [string, string]> = {
  presupuesto: ['Baja ejecución', 'Alta ejecución'],
  servicios:   ['Menor cobertura', 'Mayor cobertura'],
  planilla:    ['Menor planilla', 'Mayor planilla'],
  obras:       ['Riesgo bajo', 'Riesgo crítico'],
};

export default function Legend({ layerId }: { layerId: MapLayer }) {
  const cfg = LAYERS[layerId];
  const [lo, hi] = LABELS[layerId];
  const ramp =
    layerId === 'obras'
      ? ['#eab308', '#f97316', '#ef4444']
      : cfg.invert
      ? [...cfg.ramp].reverse()
      : cfg.ramp;

  return (
    <div className="glass-strong rounded-2xl px-3.5 py-3 w-[180px]">
      <div className="text-[10px] uppercase tracking-wider text-inkfaint font-semibold mb-2">{cfg.label}</div>
      <div className="h-2 rounded-full mb-1.5" style={{ background: `linear-gradient(90deg, ${ramp[0]}, ${ramp[1]}, ${ramp[2]})` }} />
      <div className="flex justify-between text-[9.5px] text-inksoft">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}
