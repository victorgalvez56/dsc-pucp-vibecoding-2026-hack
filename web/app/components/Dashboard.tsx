'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { MapLayer, ObraRiesgo, PerformanceRegional } from '@/lib/types';
import { LAYERS } from '@/lib/layers';
import Sidebar from './Sidebar';
import StatsPanel from './StatsPanel';
import LayerTabs from './LayerTabs';

// Code-split: MapLibre (~250kb) carga en su propio chunk, no en el bundle inicial
const MapClient = dynamic(() => import('./MapClient'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-inksoft text-[13px]">
      Cargando globo 3D…
    </div>
  ),
});
import FloatingRegionCards from './FloatingRegionCards';
import MapInsightCards from './MapInsightCards';
import Legend from './Legend';
import ForensicPanel from './ForensicPanel';
import Icon from './Icon';

interface Props {
  obras: ObraRiesgo[];
  performance: PerformanceRegional[];
}

export default function Dashboard({ obras, performance }: Props) {
  const [activeLayer, setActiveLayer] = useState<MapLayer>('presupuesto');
  const [selectedObra, setSelectedObra] = useState<ObraRiesgo | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);

  const rankRows = LAYERS[activeLayer].rank.rows(performance);

  // Centroide por región (para girar el globo)
  const centroids = useMemo(() => {
    const m: Record<string, { lat: number; lng: number }> = {};
    performance.forEach((r) => { if (r.lat && r.lng) m[r.region] = { lat: r.lat, lng: r.lng }; });
    return m;
  }, [performance]);

  // Peor obra por región (para el panel forense)
  const worstObra = useMemo(() => {
    const m: Record<string, ObraRiesgo> = {};
    obras.forEach((o) => {
      if (!o.region) return;
      if (!m[o.region] || o.red_flag_score > m[o.region].red_flag_score) m[o.region] = o;
    });
    return m;
  }, [obras]);

  const onChangeLayer = (l: MapLayer) => {
    setActiveLayer(l);
    setSelectedObra(null);
  };

  const onSelectRegion = (raw: string) => {
    const c = centroids[raw];
    if (c) setFocus({ ...c });
    if (activeLayer === 'obras') {
      const o = worstObra[raw];
      if (o) setSelectedObra(o);
    } else {
      setSelectedObra(null);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full w-full overflow-y-auto lg:overflow-hidden">
      <Sidebar />
      <StatsPanel
        layerId={activeLayer}
        rows={performance}
        onSelectRegion={onSelectRegion}
      />

      {/* Lienzo del globo */}
      <main className="order-1 lg:order-none relative flex-1 min-h-[58vh] lg:min-h-0 m-3 lg:my-3 lg:mr-3 lg:ml-0 rounded-[24px] lg:rounded-[28px] overflow-hidden glass shadow-glass">
        <MapClient
          obras={obras}
          performance={performance}
          activeLayer={activeLayer}
          focus={focus}
          onSelectObra={setSelectedObra}
        />

        {/* Barra superior */}
        <div className="absolute top-4 lg:top-5 left-4 lg:left-5 right-4 lg:right-5 flex items-start justify-between gap-3 z-20 pointer-events-none">
          <div className="pointer-events-auto max-w-[64%] overflow-x-auto no-scrollbar">
            <LayerTabs active={activeLayer} onChange={onChangeLayer} />
          </div>
          <div className="flex flex-col items-end gap-3 pointer-events-auto">
            <div className="glass-strong rounded-2xl px-3 lg:px-4 py-2 flex items-center gap-2.5">
              <span className="grid place-items-center w-6 h-6 rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#818cf8,#f43f5e)' }}>
                <Icon name="shield" size={13} />
              </span>
              <div className="leading-none hidden sm:block">
                <div className="font-display text-[13px] font-bold tracking-tight text-ink">VIGÍA</div>
                <div className="text-[9.5px] text-inksoft">Estado Peruano · 2025</div>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-servicios animate-pulse" title="datos activos" />
            </div>
            <div className="hidden sm:block">
              <Legend layerId={activeLayer} />
            </div>
          </div>
        </div>

        {/* Pista capa obras */}
        {activeLayer === 'obras' && !selectedObra && (
          <div className="absolute top-[4.5rem] lg:top-20 left-1/2 -translate-x-1/2 z-20 glass-strong rounded-full px-4 py-1.5 text-[11px] text-inksoft flex items-center gap-1.5 pointer-events-none text-center">
            <Icon name="alert" size={12} className="text-obras shrink-0" />
            Toca una región para abrir el panel forense
          </div>
        )}

        <FloatingRegionCards layerId={activeLayer} rows={rankRows} onSelect={onSelectRegion} />
        <MapInsightCards layerId={activeLayer} rows={performance} />

        {selectedObra && <ForensicPanel obra={selectedObra} onClose={() => setSelectedObra(null)} />}
      </main>
    </div>
  );
}
