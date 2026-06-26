import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { PerformanceRegional } from '@/lib/types';

export const revalidate = 120;

export async function GET(_req: NextRequest) {
  try {
    const rows = await query<PerformanceRegional>(`
      SELECT
        region,
        lat::float8                  AS lat,
        lng::float8                  AS lng,
        pim_total::float8            AS pim_total,
        devengado_total::float8      AS devengado_total,
        pct_ejecucion::float8        AS pct_ejecucion,
        n_escuelas::int              AS n_escuelas,
        n_postas::int                AS n_postas,
        n_hospitales::int            AS n_hospitales,
        n_servicios::int             AS n_servicios,
        n_empleados::int             AS n_empleados,
        sueldo_promedio::float8      AS sueldo_promedio,
        n_obras_riesgo::int          AS n_obras_riesgo,
        score_promedio::int          AS score_promedio,
        monto_riesgo::float8         AS monto_riesgo
      FROM performance_regional
      ORDER BY region
    `);
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error('[GET /api/performance]', err);
    return NextResponse.json({ data: [] });
  }
}
