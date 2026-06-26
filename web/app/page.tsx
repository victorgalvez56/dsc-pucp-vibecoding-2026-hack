import { query } from '@/lib/db';
import type { ObraRiesgo, PerformanceRegional } from '@/lib/types';
import MapClient from './components/MapClient';

export const dynamic = 'force-dynamic';

// ─── Fetches server-side (RSC) ────────────────────────────────────────────────

async function getObras(): Promise<ObraRiesgo[]> {
  try {
    return await query<ObraRiesgo>(`
      SELECT
        id_contrato, entidad, entidad_ruc, region, objeto, metodo_adjudicacion,
        contratista, ruc_contratista,
        monto_adjudicado::float8        AS monto_adjudicado,
        monto_contrato::float8          AS monto_contrato,
        moneda,
        fecha_adjudicacion::text        AS fecha_adjudicacion,
        codigo_obra,
        lat::float8                     AS lat,
        lng::float8                     AS lng,
        red_flag_score,
        red_flag_reasons,
        avance_fisico_pct::float8       AS avance_fisico_pct,
        estado_obra,
        n_modificaciones_plazo,
        fecha_fin_programada::text      AS fecha_fin_programada,
        fecha_fin_real::text            AS fecha_fin_real
      FROM obras_riesgo
      ORDER BY red_flag_score DESC
      LIMIT 500
    `);
  } catch { return []; }
}

async function getPerformance(): Promise<PerformanceRegional[]> {
  try {
    return await query<PerformanceRegional>(`
      SELECT
        region,
        lat::float8 AS lat, lng::float8 AS lng,
        pim_total::float8, devengado_total::float8, pct_ejecucion::float8,
        n_escuelas::int, n_postas::int, n_hospitales::int, n_servicios::int,
        n_empleados::int, sueldo_promedio::float8,
        n_obras_riesgo::int, score_promedio::int, monto_riesgo::float8
      FROM performance_regional ORDER BY region
    `);
  } catch { return []; }
}

async function getKPIs() {
  try {
    const [row] = await query<{
      total_obras: string; total_riesgo: string; monto: string;
      pct_ejecucion: string; n_servicios: string; n_empleados: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM obras)                             AS total_obras,
        (SELECT COUNT(*)::text FROM obras_riesgo)                     AS total_riesgo,
        (SELECT COALESCE(SUM(monto_contrato),0)::text FROM obras_riesgo) AS monto,
        (SELECT COALESCE(ROUND(AVG(pct_ejecucion),1),0)::text
           FROM performance_regional WHERE pim_total > 0)             AS pct_ejecucion,
        (SELECT COALESCE(SUM(n_servicios),0)::text
           FROM performance_regional)                                  AS n_servicios,
        (SELECT COALESCE(SUM(n_empleados),0)::text
           FROM performance_regional)                                  AS n_empleados
    `);
    return {
      totalObras:    Number(row?.total_obras    ?? 0),
      totalRiesgo:   Number(row?.total_riesgo   ?? 0),
      monto:         Number(row?.monto          ?? 0),
      pctEjecucion:  Number(row?.pct_ejecucion  ?? 0),
      nServicios:    Number(row?.n_servicios     ?? 0),
      nEmpleados:    Number(row?.n_empleados     ?? 0),
    };
  } catch {
    return { totalObras: 0, totalRiesgo: 0, monto: 0,
             pctEjecucion: 0, nServicios: 0, nEmpleados: 0 };
  }
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `S/ ${(n / 1_000_000_000).toFixed(1)} B`;
  if (n >= 1_000_000)     return `S/ ${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)         return `S/ ${(n / 1_000).toFixed(0)} K`;
  return `S/ ${n.toFixed(0)}`;
}

function KPIChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div className={`text-lg font-bold tabular-nums ${accent ? 'text-red-400' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const [obras, performance, kpis] = await Promise.all([
    getObras(), getPerformance(), getKPIs(),
  ]);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* ── Header ── */}
      <header className="flex items-center gap-6 px-5 py-3 border-b border-slate-800 bg-slate-950 z-30 shrink-0">
        <div className="flex items-baseline gap-2.5">
          <span className="text-xl font-black tracking-tight text-red-500">VIGÍA</span>
          <span className="text-xs text-slate-500 hidden sm:block">
            Monitor del Estado Peruano · 4 capas de datos
          </span>
        </div>
        <div className="flex items-center gap-5 ml-auto">
          <KPIChip label="Ejecución presup." value={`${kpis.pctEjecucion}%`} />
          <KPIChip label="Servicios básicos" value={kpis.nServicios.toLocaleString('es-PE')} />
          <KPIChip label="Empleados públicos" value={kpis.nEmpleados.toLocaleString('es-PE')} />
          <KPIChip label="Obras en riesgo"   value={kpis.totalRiesgo.toLocaleString('es-PE')} accent />
          <KPIChip label="Monto en riesgo"   value={fmt(kpis.monto)} />
        </div>
      </header>

      {/* ── Mapa multi-capa ── */}
      <main className="flex-1 relative min-h-0">
        <MapClient obras={obras} performance={performance} />
      </main>
    </div>
  );
}
