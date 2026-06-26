import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import type { StatsResponse, RegionStat, ContratistaStat } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const [totals, por_region, top_contratistas] = await Promise.all([
      queryOne<{ total_obras: string; total_obras_riesgo: string; monto_total_riesgo: string }>(`
        SELECT
          (SELECT COUNT(*)::text FROM obras)                           AS total_obras,
          (SELECT COUNT(*)::text FROM obras_riesgo)                   AS total_obras_riesgo,
          (SELECT COALESCE(SUM(monto_contrato),0)::text
             FROM obras_riesgo)                                        AS monto_total_riesgo
      `),
      query<RegionStat>(`
        SELECT
          region,
          COUNT(*)::int                  AS n_obras,
          ROUND(AVG(red_flag_score))::int AS avg_score
        FROM obras_riesgo
        WHERE region IS NOT NULL
        GROUP BY region
        ORDER BY n_obras DESC
        LIMIT 25
      `),
      query<ContratistaStat>(`
        SELECT
          contratista,
          ruc_contratista               AS ruc,
          COUNT(*)::int                 AS n_obras,
          MAX(red_flag_score)::int      AS score_max
        FROM obras_riesgo
        WHERE contratista IS NOT NULL
        GROUP BY contratista, ruc_contratista
        ORDER BY n_obras DESC, score_max DESC
        LIMIT 10
      `),
    ]);

    const response: StatsResponse = {
      total_obras:        Number(totals?.total_obras         ?? 0),
      total_obras_riesgo: Number(totals?.total_obras_riesgo  ?? 0),
      monto_total_riesgo: Number(totals?.monto_total_riesgo  ?? 0),
      por_region,
      top_contratistas,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[GET /api/stats]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
