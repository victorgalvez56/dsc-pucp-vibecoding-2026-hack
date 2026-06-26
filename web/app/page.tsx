import { query } from '@/lib/db';
import type { ObraRiesgo } from '@/lib/types';
import MapClient from './components/MapClient';

export const dynamic = 'force-dynamic'; // siempre datos frescos de BD

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
  } catch (e) {
    console.error('getObras error:', e);
    return [];
  }
}

async function getStats() {
  try {
    const [row] = await query<{
      total_obras: string;
      total_riesgo: string;
      monto: string;
    }>(`
      SELECT
        (SELECT COUNT(*)::text FROM obras)                            AS total_obras,
        (SELECT COUNT(*)::text FROM obras_riesgo)                    AS total_riesgo,
        (SELECT COALESCE(SUM(monto_contrato),0)::text
           FROM obras_riesgo)                                         AS monto
    `);
    return {
      totalObras:   Number(row?.total_obras  ?? 0),
      totalRiesgo:  Number(row?.total_riesgo ?? 0),
      monto:        Number(row?.monto        ?? 0),
    };
  } catch {
    return { totalObras: 0, totalRiesgo: 0, monto: 0 };
  }
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function formatPEN(n: number): string {
  if (n >= 1_000_000_000) return `S/ ${(n / 1_000_000_000).toFixed(1)} B`;
  if (n >= 1_000_000)     return `S/ ${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)         return `S/ ${(n / 1_000).toFixed(0)} K`;
  return `S/ ${n.toFixed(0)}`;
}

function KPIChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
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
  const [obras, stats] = await Promise.all([getObras(), getStats()]);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* ── Header ── */}
      <header className="flex items-center gap-6 px-5 py-3 border-b border-slate-800 bg-slate-950 z-30 shrink-0">
        <div className="flex items-baseline gap-2.5">
          <span className="text-xl font-black tracking-tight text-red-500">VIGÍA</span>
          <span className="text-xs text-slate-500 hidden sm:block">
            Monitor de Obras Públicas · Perú
          </span>
        </div>

        <div className="flex items-center gap-6 ml-auto">
          <KPIChip
            label="Obras analizadas"
            value={stats.totalObras.toLocaleString('es-PE')}
          />
          <KPIChip
            label="En riesgo"
            value={stats.totalRiesgo.toLocaleString('es-PE')}
            accent
          />
          <KPIChip
            label="Monto en riesgo"
            value={formatPEN(stats.monto)}
          />
        </div>
      </header>

      {/* ── Mapa (isla cliente) — ocupa el resto del viewport ── */}
      <main className="flex-1 relative min-h-0">
        <MapClient obras={obras} />
        {obras.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="bg-slate-900/80 text-slate-400 text-sm px-4 py-2 rounded-lg">
              Sin datos aún — corre <code className="text-red-400">SELECT compute_red_flag_scores();</code> en Supabase
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
