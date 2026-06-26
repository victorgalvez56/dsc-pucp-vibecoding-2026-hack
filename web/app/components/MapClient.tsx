'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import type { MapLayer, ObraRiesgo, PerformanceRegional } from '@/lib/types';
import ForensicPanel from './ForensicPanel';

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

const LAYERS: { id: MapLayer; label: string; icon: string }[] = [
  { id: 'presupuesto', label: 'Presupuesto', icon: '💰' },
  { id: 'servicios',   label: 'Servicios',   icon: '🏥' },
  { id: 'planilla',    label: 'Planilla',     icon: '👥' },
  { id: 'obras',       label: 'Obras',        icon: '🏗️' },
];

interface Props {
  obras: ObraRiesgo[];
  performance: PerformanceRegional[];
}

export default function MapClient({ obras, performance }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<MLMap | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayer>('presupuesto');
  const [selectedObra, setSelectedObra] = useState<ObraRiesgo | null>(null);

  // Construye GeoJSON para cada capa regional
  const regionalGeoJSON = useCallback((field: keyof PerformanceRegional) => ({
    type: 'FeatureCollection' as const,
    features: performance
      .filter((r) => r.lat && r.lng)
      .map((r) => ({
        type: 'Feature' as const,
        properties: { region: r.region, value: Number(r[field]) },
        geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
      })),
  }), [performance]);

  const obrasGeoJSON = useCallback(() => ({
    type: 'FeatureCollection' as const,
    features: obras
      .filter((o) => o.lat != null && o.lng != null)
      .map((o) => ({
        type: 'Feature' as const,
        properties: { id: o.id_contrato, score: o.red_flag_score },
        geometry: { type: 'Point' as const, coordinates: [Number(o.lng), Number(o.lat)] },
      })),
  }), [obras]);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    let map: MLMap;

    (async () => {
      const mgl = (await import('maplibre-gl')).default;
      map = new mgl.Map({
        container: containerRef.current!,
        style: MAP_STYLE,
        center: [-75.5, -9.5],
        zoom: 5,
        attributionControl: false,
      });
      map.addControl(new mgl.AttributionControl({ compact: true }), 'bottom-left');
      map.addControl(new mgl.NavigationControl(), 'top-left');
      mapRef.current = map;

      map.on('load', () => {
        // ── Fuentes ──
        map.addSource('regional', { type: 'geojson', data: regionalGeoJSON('pct_ejecucion') });
        map.addSource('obras-src', { type: 'geojson', data: obrasGeoJSON() });

        // ── Capa regional (presupuesto / planilla / servicios) ──
        map.addLayer({
          id: 'regional-puntos', type: 'circle', source: 'regional',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'value'], 0, 14, 100, 40],
            'circle-color':  ['interpolate', ['linear'], ['get', 'value'], 0, '#ef4444', 50, '#f97316', 100, '#22c55e'],
            'circle-opacity': 0.75,
            'circle-stroke-color': '#0f172a',
            'circle-stroke-width': 1.5,
          },
        });

        // ── Capa obras (oculta por defecto) ──
        map.addLayer({
          id: 'obras-puntos', type: 'circle', source: 'obras-src',
          layout: { visibility: 'none' },
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 0, 6, 100, 16],
            'circle-color':  ['interpolate', ['linear'], ['get', 'score'], 0, '#eab308', 40, '#f97316', 70, '#ef4444'],
            'circle-opacity': 0.85,
            'circle-stroke-color': '#0f172a',
            'circle-stroke-width': 1.5,
          },
        });

        map.on('click', 'obras-puntos', (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          const obra = obras.find((o) => o.id_contrato === id);
          if (obra) setSelectedObra(obra);
        });
        map.on('mouseenter', 'obras-puntos', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'obras-puntos', () => { map.getCanvas().style.cursor = ''; });
      });
    })();

    return () => { map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reaccionar al cambio de capa activa
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const isObras = activeLayer === 'obras';
    map.setLayoutProperty('regional-puntos', 'visibility', isObras ? 'none' : 'visible');
    map.setLayoutProperty('obras-puntos',    'visibility', isObras ? 'visible' : 'none');

    if (!isObras) {
      const fieldMap: Record<MapLayer, keyof PerformanceRegional> = {
        presupuesto: 'pct_ejecucion',
        servicios:   'n_servicios',
        planilla:    'n_empleados',
        obras:       'n_obras_riesgo',
      };
      const src = map.getSource('regional') as maplibregl.GeoJSONSource | undefined;
      src?.setData(regionalGeoJSON(fieldMap[activeLayer]));
    }
    setSelectedObra(null);
  }, [activeLayer, regionalGeoJSON]);

  const legend = {
    presupuesto: [{ color: '#ef4444', label: '< 50% ejecutado' }, { color: '#f97316', label: '50–80%' }, { color: '#22c55e', label: '> 80%' }],
    servicios:   [{ color: '#ef4444', label: 'Pocas IIEE/postas' }, { color: '#f97316', label: 'Cobertura media' }, { color: '#22c55e', label: 'Alta cobertura' }],
    planilla:    [{ color: '#ef4444', label: 'Pocos empleados' }, { color: '#f97316', label: 'Medio' }, { color: '#22c55e', label: 'Alta densidad' }],
    obras:       [{ color: '#eab308', label: 'Score < 40' }, { color: '#f97316', label: '40–69' }, { color: '#ef4444', label: '≥ 70 Crítico' }],
  }[activeLayer];

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Toggle de capas */}
      <div className="absolute top-4 left-12 flex gap-1 z-10">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveLayer(l.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${activeLayer === l.id
                ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/30'
                : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:border-slate-500'}`}
          >
            <span>{l.icon}</span>{l.label}
          </button>
        ))}
      </div>

      {/* Leyenda */}
      <div className="absolute bottom-8 right-4 bg-slate-900/90 backdrop-blur rounded-lg px-3 py-2 text-xs space-y-1 z-10 border border-slate-700">
        {legend.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-slate-300">{label}</span>
          </div>
        ))}
      </div>

      {selectedObra && (
        <ForensicPanel obra={selectedObra} onClose={() => setSelectedObra(null)} />
      )}
    </div>
  );
}
