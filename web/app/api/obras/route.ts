import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ObraRiesgo } from '@/lib/types';

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region    = searchParams.get('region');
  const minScore  = Math.max(0, parseInt(searchParams.get('min_score') ?? '0', 10));
  const limit     = Math.min(1000, parseInt(searchParams.get('limit') ?? '500', 10));

  const params: unknown[] = [minScore, limit];
  let regionClause = '';
  if (region) {
    params.splice(1, 0, region); // insert at index 1 → $2
    regionClause = 'AND region = $2';
  }
  const limitParam = `$${params.length}`;

  try {
    const rows = await query<ObraRiesgo>(`
      SELECT
        id_contrato, entidad, region, objeto, contratista, ruc_contratista,
        monto_adjudicado::float8         AS monto_adjudicado,
        monto_contrato::float8           AS monto_contrato,
        moneda,
        fecha_adjudicacion::text         AS fecha_adjudicacion,
        codigo_obra,
        lat::float8 AS lat,
        lng::float8 AS lng,
        red_flag_score,
        red_flag_reasons,
        avance_fisico_pct::float8        AS avance_fisico_pct,
        estado_obra,
        n_modificaciones_plazo,
        fecha_fin_programada::text       AS fecha_fin_programada,
        fecha_fin_real::text             AS fecha_fin_real
      FROM obras_riesgo
      WHERE red_flag_score >= $1 ${regionClause}
      ORDER BY red_flag_score DESC
      LIMIT ${limitParam}
    `, params);

    return NextResponse.json({ data: rows, count: rows.length });
  } catch (err) {
    console.error('[GET /api/obras]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
