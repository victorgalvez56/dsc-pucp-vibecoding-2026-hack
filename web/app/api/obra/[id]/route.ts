import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import type { ObraRiesgo } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  try {
    const obra = await queryOne<ObraRiesgo>(`
      SELECT
        id_contrato, entidad, entidad_ruc, region, objeto, metodo_adjudicacion,
        contratista, ruc_contratista,
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
      WHERE id_contrato = $1
    `, [id]);

    if (!obra) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(obra);
  } catch (err) {
    console.error('[GET /api/obra/[id]]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
