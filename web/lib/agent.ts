// Agente Vigía — versión determinística (SIN LLM, costo cero).
// Interpreta la pregunta en español con detección de intención por palabras clave
// y ejecuta consultas parametrizadas (seguras) contra las vistas Gold reales.
// No llama a ninguna API de pago: 0 costo, 0 latencia de red, 0 alucinación.
import { query } from './db';

export interface AgentResult {
  answer: string;
  sql: string | null;
  rowCount: number;
  rows: Record<string, unknown>[];
}

// ── Utilidades ──────────────────────────────────────────────────────────────
const ACCENTS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' };
const norm = (s: string) =>
  s.toLowerCase().replace(/[áéíóúüñ]/g, (c) => ACCENTS[c] ?? c);

function fmtPEN(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (v >= 1e9) return `S/ ${(v / 1e9).toFixed(1)} mil M`;
  if (v >= 1e6) return `S/ ${(v / 1e6).toFixed(1)} M`;
  if (v >= 1e3) return `S/ ${Math.round(v / 1e3)} mil`;
  return `S/ ${Math.round(v)}`;
}

const titleCase = (s: string | null) =>
  (s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// 25 regiones del Perú (para detectar a cuál se refiere la pregunta).
const REGIONS = [
  'amazonas', 'ancash', 'apurimac', 'arequipa', 'ayacucho', 'cajamarca', 'callao',
  'cusco', 'huancavelica', 'huanuco', 'ica', 'junin', 'la libertad', 'lambayeque',
  'lima', 'loreto', 'madre de dios', 'moquegua', 'pasco', 'piura', 'puno',
  'san martin', 'tacna', 'tumbes', 'ucayali',
];

function detectRegion(q: string): string | null {
  const n = norm(q).replace(/cuzco/g, 'cusco'); // variante común
  // ordena por longitud desc para que 'la libertad' gane sobre 'lima' etc.
  for (const r of [...REGIONS].sort((a, b) => b.length - a.length)) {
    if (n.includes(r)) return r;
  }
  return null;
}

// Banderas (red flags) detectables por sinónimos.
const FLAGS: { test: RegExp; like: string; label: string }[] = [
  { test: /sancion|inhabilit/, like: '%sancion%', label: 'contratista sancionado' },
  { test: /paraliz|parad|abandonad/, like: '%paralizada%', label: 'obra paralizada' },
  { test: /sobrecost|sobre ?precio|sobre ?costo/, like: '%sobrecosto%', label: 'sobrecosto' },
  { test: /adjudicacion directa|directa/, like: '%adjudicacion_directa%', label: 'adjudicación directa' },
  { test: /vencid|plazo vencido/, like: '%obra_vencida%', label: 'obra vencida' },
  { test: /recurrent|reincident|repit/, like: '%contratista_recurrente%', label: 'contratista recurrente' },
];

// SQL legible (con params ya interpolados) para mostrar en "ver consulta".
function renderSql(sql: string, params: unknown[]): string {
  return sql
    .replace(/\$(\d+)/g, (_, i) => {
      const v = params[Number(i) - 1];
      return typeof v === 'string' ? `'${v}'` : String(v);
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Router de intención ─────────────────────────────────────────────────────
export async function askAgent(question: string): Promise<AgentResult> {
  const q = question.slice(0, 300);
  const n = norm(q);
  const region = detectRegion(q);
  const flag = FLAGS.find((f) => f.test.test(n));

  // Intención 1 — ranking de regiones por OBRAS/RIESGO (requiere ese contexto para
  // no acaparar preguntas de presupuesto/servicios/planilla que tienen su propia intención).
  if (/regi(on|ones)/.test(n) && /(obra|riesgo|score|sospechos|marcad|peor)/.test(n)) {
    const byScore = /score|riesgo promedio|peor|sospechos/.test(n);
    const orderCol = byScore ? 'score_promedio' : 'n_obras_riesgo';
    const sql = `SELECT region, n_obras_riesgo::int, score_promedio::int,
                        monto_riesgo::float8 AS monto_riesgo
                 FROM performance_regional
                 ORDER BY ${orderCol} DESC, monto_riesgo DESC LIMIT 5`;
    const rows = await query(sql, []);
    const lines = rows.map((r: any, i: number) =>
      `${i + 1}. ${titleCase(r.region)} — ${r.n_obras_riesgo} obras en riesgo · score ${r.score_promedio} · ${fmtPEN(r.monto_riesgo)} en riesgo`);
    return {
      answer: `Regiones con ${byScore ? 'mayor score de riesgo' : 'más obras en riesgo'}:\n\n${lines.join('\n')}`,
      sql: renderSql(sql, []), rowCount: rows.length, rows,
    };
  }

  // Intención 2 — ranking de contratistas reincidentes
  if (/contratist|empresa/.test(n) && /(mas|mayor|reincident|repit|ranking|top)/.test(n) && !flag) {
    const sql = `SELECT contratista, ruc_contratista AS ruc, COUNT(*)::int AS n_obras,
                        MAX(red_flag_score)::int AS score_max,
                        SUM(monto_contrato)::float8 AS monto
                 FROM obras_riesgo WHERE contratista IS NOT NULL
                 GROUP BY contratista, ruc_contratista
                 ORDER BY n_obras DESC, score_max DESC LIMIT 5`;
    const rows = await query(sql, []);
    const lines = rows.map((r: any, i: number) =>
      `${i + 1}. ${r.contratista} — ${r.n_obras} obras marcadas · score máx ${r.score_max} · ${fmtPEN(r.monto)}`);
    return {
      answer: `Contratistas con más obras marcadas como riesgo:\n\n${lines.join('\n')}`,
      sql: renderSql(sql, []), rowCount: rows.length, rows,
    };
  }

  // Intención 3 — presupuesto / ejecución
  if (/presupuest|ejecu|pim|devengad/.test(n)) {
    const asc = /menos|baja|peor|menor/.test(n);
    const sql = `SELECT region, pim_total::float8, devengado_total::float8, pct_ejecucion::float8
                 FROM performance_regional ORDER BY pct_ejecucion ${asc ? 'ASC' : 'DESC'} LIMIT 5`;
    const rows = await query(sql, []);
    const lines = rows.map((r: any, i: number) =>
      `${i + 1}. ${titleCase(r.region)} — ${r.pct_ejecucion}% ejecutado · PIM ${fmtPEN(r.pim_total)}`);
    return {
      answer: `Regiones con ${asc ? 'menor' : 'mayor'} ejecución presupuestal:\n\n${lines.join('\n')}`,
      sql: renderSql(sql, []), rowCount: rows.length, rows,
    };
  }

  // Intención 4 — servicios básicos (escuelas / hospitales / postas)
  if (/escuela|colegio|hospital|posta|salud|servicio/.test(n)) {
    let col = 'n_servicios', label = 'servicios activos';
    if (/escuela|colegio/.test(n)) { col = 'n_escuelas'; label = 'escuelas activas'; }
    else if (/hospital/.test(n)) { col = 'n_hospitales'; label = 'hospitales'; }
    else if (/posta/.test(n)) { col = 'n_postas'; label = 'postas de salud'; }
    const sql = `SELECT region, ${col}::int AS valor FROM performance_regional
                 ORDER BY ${col} DESC LIMIT 5`;
    const rows = await query(sql, []);
    const lines = rows.map((r: any, i: number) =>
      `${i + 1}. ${titleCase(r.region)} — ${Number(r.valor).toLocaleString('es-PE')} ${label}`);
    return {
      answer: `Regiones con más ${label}:\n\n${lines.join('\n')}`,
      sql: renderSql(sql, []), rowCount: rows.length, rows,
    };
  }

  // Intención 4b — planilla / empleados públicos / sueldos
  if (/empleado|planilla|trabajador|sueldo|salario/.test(n)) {
    const sql = `SELECT region, n_empleados::int, sueldo_promedio::float8
                 FROM performance_regional ORDER BY n_empleados DESC LIMIT 5`;
    const rows = await query(sql, []);
    const lines = rows.map((r: any, i: number) =>
      `${i + 1}. ${titleCase(r.region)} — ${Number(r.n_empleados).toLocaleString('es-PE')} empleados públicos`);
    return {
      answer: `Regiones con más empleados públicos en planilla:\n\n${lines.join('\n')}`,
      sql: renderSql(sql, []), rowCount: rows.length, rows,
    };
  }

  // Intención 5 — obras filtradas por bandera y/o región (el caso forense central)
  const where: string[] = [];
  const params: unknown[] = [];
  if (flag) { params.push(flag.like); where.push(`red_flag_reasons::text ILIKE $${params.length}`); }
  if (region) { params.push(`%${region}%`); where.push(`region ILIKE $${params.length}`); }
  // "paralizada" también filtra por estado_obra (señal más directa)
  if (flag?.label === 'obra paralizada') {
    where[where.length - 1] = `(${where[where.length - 1]} OR estado_obra ILIKE '%paraliz%')`;
  }

  const orderByMonto = /monto|caras?|costos|millon|grandes?|mayores?/.test(n);
  const orderCol = orderByMonto ? 'monto_contrato' : 'red_flag_score';
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT entidad, region, objeto, contratista, ruc_contratista AS ruc,
                      monto_contrato::float8 AS monto, red_flag_score, estado_obra
               FROM obras_riesgo ${whereSql}
               ORDER BY ${orderCol} DESC NULLS LAST LIMIT 8`;
  const rows = await query(sql, params);

  if (rows.length === 0) {
    return {
      answer: `No encontré obras${flag ? ` con ${flag.label}` : ''}${region ? ` en ${titleCase(region)}` : ''}. ` +
        `Probá con otra región o pregunta (ej. "obras paralizadas", "contratistas sancionados en Lima").`,
      sql: renderSql(sql, params), rowCount: 0, rows,
    };
  }

  const lines = rows.slice(0, 6).map((r: any, i: number) =>
    `${i + 1}. ${r.contratista ?? r.entidad} — ${(r.objeto ?? '').slice(0, 70)} ` +
    `(${titleCase(r.region)}) · ${fmtPEN(r.monto)} · score ${r.red_flag_score}` +
    `${r.estado_obra ? ` · ${r.estado_obra}` : ''}`);

  const filtro = [flag && flag.label, region && `en ${titleCase(region)}`].filter(Boolean).join(' ');
  const header = orderByMonto
    ? `Obras${filtro ? ` (${filtro})` : ''} con mayor monto`
    : `Obras${filtro ? ` (${filtro})` : ''} con mayor riesgo`;

  return {
    answer: `${header} — ${rows.length} encontrada${rows.length === 1 ? '' : 's'}:\n\n${lines.join('\n')}`,
    sql: renderSql(sql, params),
    rowCount: rows.length,
    rows,
  };
}
