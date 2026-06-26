import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import type { ServicioBasico } from '@/lib/types';

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const region = searchParams.get('region');
  const tipo   = searchParams.get('tipo');
  const limit  = Math.min(2000, parseInt(searchParams.get('limit') ?? '2000', 10));

  const params: unknown[] = [limit];
  const filters: string[] = ["estado = 'activo'", 'lat IS NOT NULL', 'lng IS NOT NULL'];

  if (region) { params.unshift(region); filters.push(`region = $${params.length - 1}`); }
  if (tipo)   { params.unshift(tipo);   filters.push(`tipo   = $${params.length - 1}`); }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const rows = await query<ServicioBasico>(`
      SELECT
        id, tipo, nombre, region, provincia, distrito,
        estado, nivel,
        n_alumnos, n_docentes, n_camas,
        lat::float8 AS lat,
        lng::float8 AS lng,
        fuente
      FROM servicios_basicos
      ${where}
      LIMIT $${params.length}
    `, params);
    return NextResponse.json({ data: rows, count: rows.length });
  } catch (err) {
    console.error('[GET /api/servicios]', err);
    return NextResponse.json({ data: [], count: 0 });
  }
}
