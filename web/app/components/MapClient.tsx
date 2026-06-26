'use client';

import { useCallback, useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { MapLayer, ObraRiesgo, PerformanceRegional } from '@/lib/types';
import { LAYERS } from '@/lib/layers';

// Basemap neutro (CARTO Positron) — sin colores, papel claro
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

function hexLerp(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function rampColor(ramp: [string, string, string], t: number): string {
  return t < 0.5 ? hexLerp(ramp[0], ramp[1], t * 2) : hexLerp(ramp[1], ramp[2], (t - 0.5) * 2);
}

interface Props {
  obras: ObraRiesgo[];
  performance: PerformanceRegional[];
  activeLayer: MapLayer;
  focus: { lat: number; lng: number } | null;
  onSelectObra: (o: ObraRiesgo) => void;
}

export default function MapClient({ obras, performance, activeLayer, focus, onSelectObra }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const readyRef = useRef(false);

  const regionalData = useCallback((layerId: MapLayer) => {
    const cfg = LAYERS[layerId];
    const max = Math.max(1, ...performance.map((r) => cfg.metric(r)));
    return {
      type: 'FeatureCollection' as const,
      features: performance
        .filter((r) => r.lat && r.lng)
        .map((r) => {
          const v = cfg.metric(r);
          const t = cfg.rampMode === 'pct' ? Math.min(1, v / 100) : v / max;
          return {
            type: 'Feature' as const,
            properties: { region: r.region, color: rampColor(cfg.ramp, cfg.invert ? 1 - t : t), radius: 9 + t * 22 },
            geometry: { type: 'Point' as const, coordinates: [r.lng, r.lat] },
          };
        }),
    };
  }, [performance]);

  const obrasData = useCallback(() => ({
    type: 'FeatureCollection' as const,
    features: obras
      .filter((o) => o.lat != null && o.lng != null)
      .map((o) => ({
        type: 'Feature' as const,
        properties: { id: o.id_contrato, score: o.red_flag_score },
        geometry: { type: 'Point' as const, coordinates: [Number(o.lng), Number(o.lat)] },
      })),
  }), [obras]);

  const applyLayer = useCallback((layerId: MapLayer) => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const isObras = layerId === 'obras';
    ['regional-halo', 'regional-core'].forEach((id) =>
      map.getLayer(id) && map.setLayoutProperty(id, 'visibility', isObras ? 'none' : 'visible'));
    if (map.getLayer('obras-pts')) map.setLayoutProperty('obras-pts', 'visibility', isObras ? 'visible' : 'none');
    if (!isObras) (map.getSource('regional') as GeoJSONSource | undefined)?.setData(regionalData(layerId) as never);
  }, [regionalData]);

  // ── Init (una vez) ──
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-72, -12],
      zoom: 3.1,
      pitch: 12,
      attributionControl: false,
      maxZoom: 14,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

    map.on('load', () => {
      // Proyección de globo 3D (MapLibre v5)
      try { map.setProjection({ type: 'globe' }); } catch { /* mercator fallback */ }

      map.addSource('regional', { type: 'geojson', data: regionalData(activeLayer) });
      map.addSource('obras-src', { type: 'geojson', data: obrasData() });

      map.addLayer({
        id: 'regional-halo', type: 'circle', source: 'regional',
        paint: {
          'circle-radius': ['+', ['get', 'radius'], 9],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-blur': 0.65,
        },
      });
      map.addLayer({
        id: 'regional-core', type: 'circle', source: 'regional',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.92,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'obras-pts', type: 'circle', source: 'obras-src',
        layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 0, 6, 100, 17],
          'circle-color': ['interpolate', ['linear'], ['get', 'score'], 0, '#eab308', 45, '#f97316', 75, '#ef4444'],
          'circle-opacity': 0.9,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.6,
        },
      });

      map.on('click', 'obras-pts', (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        const o = obras.find((x) => x.id_contrato === id);
        if (o) onSelectObra(o);
      });
      ['obras-pts', 'regional-core'].forEach((lid) => {
        map.on('mouseenter', lid, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', lid, () => { map.getCanvas().style.cursor = ''; });
      });

      readyRef.current = true;
      applyLayer(activeLayer);
      setTimeout(() => map.resize(), 120);
    });

    const onResize = () => { try { map.resize(); } catch { /* noop */ } };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); map.remove(); mapRef.current = null; readyRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambio de capa
  useEffect(() => { applyLayer(activeLayer); }, [activeLayer, applyLayer]);

  // Vuelo a la región enfocada
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const fly = () => map.flyTo({ center: [focus.lng, focus.lat], zoom: 5.2, pitch: 35, duration: 1700, essential: true });
    if (readyRef.current) fly(); else map.once('load', fly);
  }, [focus]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
