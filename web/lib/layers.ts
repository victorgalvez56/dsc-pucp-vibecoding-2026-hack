import type { MapLayer, PerformanceRegional } from './types';
import { formatPENCompact, formatInt, titleCase } from './format';

type Rows = PerformanceRegional[];

export interface RankRow {
  region: string;     // título normalizado
  raw: string;        // región original (mayúsculas) para cruces
  value: number;
  display: string;
  pct: number;        // 0..100 para la barra
}

export interface RingSpec {
  label: string;
  pct: number;        // 0..100
  caption: string;
}

export interface LayerConfig {
  id: MapLayer;
  label: string;
  short: string;
  glyph: 'budget' | 'health' | 'people' | 'build';
  accent: string;
  accentSoft: string;
  gradient: [string, string];
  /** valor por región para el mapa */
  metric: (r: PerformanceRegional) => number;
  /** ['valor0','valor50','valor100'] del ramp de color del mapa */
  ramp: [string, string, string];
  /** 'pct' = valor ya es 0-100 ; 'max' = normalizar por el máximo del set */
  rampMode: 'pct' | 'max';
  /** ¿más alto es mejor (verde) o peor (rojo)? para invertir el ramp */
  invert: boolean;
  hero: { label: string; value: (rows: Rows) => number; fmt: (v: number) => string };
  rings: (rows: Rows) => [RingSpec, RingSpec];
  rank: { label: string; note: string; rows: (rows: Rows) => RankRow[] };
}

// ── helpers ──
const sum = (rows: Rows, f: (r: PerformanceRegional) => number) =>
  rows.reduce((a, r) => a + (f(r) || 0), 0);

const mkRank = (
  rows: Rows,
  value: (r: PerformanceRegional) => number,
  display: (v: number) => string,
  dir: 'asc' | 'desc',
  limit = 7,
): RankRow[] => {
  const withVals = rows
    .map((r) => ({ r, v: value(r) || 0 }))
    .filter((x) => (dir === 'asc' ? true : x.v > 0));
  const max = Math.max(1, ...withVals.map((x) => x.v));
  return withVals
    .sort((a, b) => (dir === 'asc' ? a.v - b.v : b.v - a.v))
    .slice(0, limit)
    .map((x) => ({
      region: titleCase(x.r.region),
      raw: x.r.region,
      value: x.v,
      display: display(x.v),
      pct: Math.round((x.v / max) * 100),
    }));
};

export const LAYERS: Record<MapLayer, LayerConfig> = {
  presupuesto: {
    id: 'presupuesto',
    label: 'Presupuesto',
    short: 'Ejecución del gasto · MEF',
    glyph: 'budget',
    accent: '#6366f1',
    accentSoft: '#a5b4fc',
    gradient: ['#818cf8', '#6366f1'],
    metric: (r) => r.pct_ejecucion,
    ramp: ['#ef4444', '#f59e0b', '#22c55e'],
    rampMode: 'pct',
    invert: false,
    hero: {
      label: 'Devengado nacional 2025',
      value: (rows) => sum(rows, (r) => r.devengado_total),
      fmt: formatPENCompact,
    },
    rings: (rows) => {
      const pim = sum(rows, (r) => r.pim_total);
      const dev = sum(rows, (r) => r.devengado_total);
      const ejec = pim > 0 ? (dev / pim) * 100 : 0;
      const conData = rows.filter((r) => r.pim_total > 0);
      const rezago = conData.filter((r) => r.pct_ejecucion < 50).length;
      const pctRezago = conData.length ? (rezago / conData.length) * 100 : 0;
      return [
        { label: 'Ejecución', pct: Math.round(ejec), caption: 'del PIM nacional devengado' },
        { label: 'En rezago', pct: Math.round(pctRezago), caption: `${rezago} regiones bajo 50%` },
      ];
    },
    rank: {
      label: 'Regiones con menor ejecución',
      note: 'Presupuesto asignado sin gastar',
      rows: (rows) =>
        mkRank(rows.filter((r) => r.pim_total > 0), (r) => r.pct_ejecucion, (v) => `${v.toFixed(0)}%`, 'asc'),
    },
  },

  servicios: {
    id: 'servicios',
    label: 'Servicios',
    short: 'Salud y educación · MINSA + MINEDU',
    glyph: 'health',
    accent: '#14b8a6',
    accentSoft: '#5eead4',
    gradient: ['#2dd4bf', '#14b8a6'],
    metric: (r) => r.n_servicios,
    ramp: ['#fca5a5', '#5eead4', '#0f766e'],
    rampMode: 'max',
    invert: false,
    hero: {
      label: 'Servicios básicos activos',
      value: (rows) => sum(rows, (r) => r.n_servicios),
      fmt: formatInt,
    },
    rings: (rows) => {
      const esc = sum(rows, (r) => r.n_escuelas);
      const salud = sum(rows, (r) => r.n_postas + r.n_hospitales);
      const tot = Math.max(1, esc + salud);
      return [
        { label: 'Educación', pct: Math.round((esc / tot) * 100), caption: `${formatInt(esc)} instituciones educativas` },
        { label: 'Salud', pct: Math.round((salud / tot) * 100), caption: `${formatInt(salud)} establecimientos de salud` },
      ];
    },
    rank: {
      label: 'Cobertura de servicios por región',
      note: 'Establecimientos activos registrados',
      rows: (rows) => mkRank(rows, (r) => r.n_servicios, (v) => formatInt(v), 'desc'),
    },
  },

  planilla: {
    id: 'planilla',
    label: 'Planilla',
    short: 'Empleo público · SERVIR',
    glyph: 'people',
    accent: '#f59e0b',
    accentSoft: '#fcd34d',
    gradient: ['#fbbf24', '#f59e0b'],
    metric: (r) => r.n_empleados,
    ramp: ['#fde68a', '#fbbf24', '#b45309'],
    rampMode: 'max',
    invert: false,
    hero: {
      label: 'Empleados públicos',
      value: (rows) => sum(rows, (r) => r.n_empleados),
      fmt: formatInt,
    },
    rings: (rows) => {
      const tot = Math.max(1, sum(rows, (r) => r.n_empleados));
      const lima = rows.find((r) => r.region === 'LIMA')?.n_empleados ?? 0;
      const sueldos = rows.filter((r) => r.sueldo_promedio > 0).map((r) => r.sueldo_promedio);
      const avgSueldo = sueldos.length ? sueldos.reduce((a, b) => a + b, 0) / sueldos.length : 0;
      return [
        { label: 'Lima', pct: Math.round((lima / tot) * 100), caption: 'de la planilla nacional' },
        { label: 'Sueldo', pct: Math.min(100, Math.round((avgSueldo / 8000) * 100)), caption: `S/ ${formatInt(avgSueldo)} promedio` },
      ];
    },
    rank: {
      label: 'Mayor planilla pública',
      note: 'Trabajadores del Estado por región',
      rows: (rows) => mkRank(rows, (r) => r.n_empleados, (v) => formatInt(v), 'desc'),
    },
  },

  obras: {
    id: 'obras',
    label: 'Obras',
    short: 'Riesgo en contratación · OCDS + INFOBRAS',
    glyph: 'build',
    accent: '#f43f5e',
    accentSoft: '#fda4af',
    gradient: ['#fb7185', '#f43f5e'],
    metric: (r) => r.n_obras_riesgo,
    ramp: ['#fecdd3', '#fb7185', '#be123c'],
    rampMode: 'max',
    invert: true,
    hero: {
      label: 'Monto en riesgo detectado',
      value: (rows) => sum(rows, (r) => r.monto_riesgo),
      fmt: formatPENCompact,
    },
    rings: (rows) => {
      const conObras = rows.filter((r) => r.n_obras_riesgo > 0);
      const cobertura = (conObras.length / 25) * 100;
      const scores = conObras.map((r) => r.score_promedio).filter((s) => s > 0);
      const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return [
        { label: 'Riesgo', pct: Math.round(avgScore), caption: 'score promedio de obras marcadas' },
        { label: 'Alcance', pct: Math.round(cobertura), caption: `${conObras.length} de 25 regiones afectadas` },
      ];
    },
    rank: {
      label: 'Regiones más críticas',
      note: 'Obras con señales de riesgo',
      rows: (rows) => mkRank(rows, (r) => r.n_obras_riesgo, (v) => `${formatInt(v)} obras`, 'desc'),
    },
  },
};

export const LAYER_ORDER: MapLayer[] = ['presupuesto', 'servicios', 'planilla', 'obras'];
