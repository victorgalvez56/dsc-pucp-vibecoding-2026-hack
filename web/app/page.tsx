import { query } from '@/lib/db';
import type { ObraRiesgo, PerformanceRegional } from '@/lib/types';
import Dashboard from './components/Dashboard';

export const dynamic = 'force-dynamic';

async function getObras(): Promise<ObraRiesgo[]> {
  try {
    return await query<ObraRiesgo>(`
      SELECT
        id_contrato, entidad, entidad_ruc, region, objeto, metodo_adjudicacion,
        contratista, ruc_contratista,
        monto_adjudicado::float8 AS monto_adjudicado,
        monto_contrato::float8   AS monto_contrato,
        moneda,
        fecha_adjudicacion::text AS fecha_adjudicacion,
        codigo_obra,
        lat::float8 AS lat, lng::float8 AS lng,
        red_flag_score, red_flag_reasons,
        avance_fisico_pct::float8 AS avance_fisico_pct,
        estado_obra, n_modificaciones_plazo,
        fecha_fin_programada::text AS fecha_fin_programada,
        fecha_fin_real::text AS fecha_fin_real
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
      FROM performance_regional
      ORDER BY region
    `);
  } catch { return []; }
}

export default async function HomePage() {
  const [obras, performance] = await Promise.all([getObras(), getPerformance()]);

  // Solo datos reales: si la BD no responde, se muestra el estado vacío honesto
  // (sin mock). Verifica que DATABASE_URL apunte al pooler de Supabase.
  if (performance.length === 0) {
    return (
      <div className="h-full grid place-items-center p-8">
        <div className="glass-strong rounded-3xl px-8 py-7 max-w-md text-center">
          <div className="font-display text-2xl font-semibold text-ink mb-2">Vigía está listo</div>
          <p className="text-[13px] text-inksoft leading-relaxed">
            Aún no hay datos cargados. Ejecuta{' '}
            <code className="px-1.5 py-0.5 rounded-md bg-black/5 text-obras text-[12px]">supabase/migrations/00_full_setup.sql</code>{' '}
            en Supabase para poblar las cuatro capas y refrescar las vistas Gold.
          </p>
        </div>
      </div>
    );
  }

  return <Dashboard obras={obras} performance={performance} />;
}
