'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import type { ObraRiesgo } from '@/lib/types';
import ForensicPanel from './ForensicPanel';

// Estilo vectorial gratuito (no requiere API key)
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

interface Props {
  obras: ObraRiesgo[];
}

export default function MapClient({ obras }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<MLMap | null>(null);
  const [selected, setSelected] = useState<ObraRiesgo | null>(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    let map: MLMap;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;

      map = new maplibregl.Map({
        container: containerRef.current!,
        style: MAP_STYLE,
        center: [-75.5, -9.5],   // centro geográfico de Perú
        zoom: 5,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-left',
      );
      map.addControl(new maplibregl.NavigationControl(), 'top-left');

      mapRef.current = map;

      map.on('load', () => {
        const features = obras
          .filter((o) => o.lat != null && o.lng != null)
          .map((o) => ({
            type: 'Feature' as const,
            properties: {
              id:    o.id_contrato,
              score: o.red_flag_score,
            },
            geometry: {
              type: 'Point' as const,
              coordinates: [Number(o.lng), Number(o.lat)],
            },
          }));

        map.addSource('obras', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features },
        });

        map.addLayer({
          id:     'obras-puntos',
          type:   'circle',
          source: 'obras',
          paint: {
            // Radio crece con el score
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'score'],
              0, 6, 40, 9, 70, 12, 100, 16,
            ],
            // Color: amarillo → naranja → rojo
            'circle-color': [
              'interpolate', ['linear'], ['get', 'score'],
              0, '#eab308', 40, '#f97316', 70, '#ef4444',
            ],
            'circle-opacity': 0.85,
            'circle-stroke-color': '#0f172a',
            'circle-stroke-width': 1.5,
          },
        });

        map.on('click', 'obras-puntos', (e) => {
          const id   = e.features?.[0]?.properties?.id as string | undefined;
          const obra = obras.find((o) => o.id_contrato === id);
          if (obra) setSelected(obra);
        });

        map.on('mouseenter', 'obras-puntos', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'obras-puntos', () => {
          map.getCanvas().style.cursor = '';
        });
      });
    })();

    return () => {
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full">
      {/* Canvas del mapa */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Leyenda de score */}
      <div className="absolute bottom-8 right-4 bg-slate-900/90 backdrop-blur rounded-lg px-3 py-2 text-xs space-y-1 z-10 border border-slate-700">
        <p className="text-slate-400 font-semibold uppercase tracking-widest text-[10px] mb-1">Score</p>
        {[
          { color: '#eab308', label: '< 40 — Moderado' },
          { color: '#f97316', label: '40–69 — Alto'    },
          { color: '#ef4444', label: '≥ 70 — Crítico'  },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-slate-300">{label}</span>
          </div>
        ))}
      </div>

      {/* Panel forense (isla cliente) */}
      {selected && (
        <ForensicPanel obra={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
