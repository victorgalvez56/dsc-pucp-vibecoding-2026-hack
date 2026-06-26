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

const fmtInt = (n: number | null | undefined) => Number(n ?? 0).toLocaleString('es-PE');

const titleCase = (s: string | null) =>
  (s ?? '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Acorta nombres de contratistas/entidades largos para que la respuesta sea legible.
function shortName(s: string | null): string {
  if (!s) return 'Sin nombre';
  let x = titleCase(s.split(' - ')[0])
    .replace(/Sociedad Anonima Cerrada/gi, 'S.A.C.')
    .replace(/Sociedad Comercial De Responsabilidad Limitada/gi, 'S.R.L.')
    .replace(/Empresa Individual De Responsabilidad Limitada/gi, 'E.I.R.L.')
    .replace(/Sociedad Anonima/gi, 'S.A.')
    .replace(/Contratistas Generales/gi, 'Contratistas')
    .replace(/\s+/g, ' ')
    .trim();
  if (x.length > 40) {
    x = x.slice(0, 40);
    const sp = x.lastIndexOf(' ');
    x = (sp > 20 ? x.slice(0, sp) : x).trim() + '…';
  }
  return x;
}

// "A, B y C" — solo con los elementos presentes.
const joinY = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;

// 25 regiones del Perú (para detectar a cuál se refiere la pregunta).
const REGIONS = [
  'amazonas', 'ancash', 'apurimac', 'arequipa', 'ayacucho', 'cajamarca', 'callao',
  'cusco', 'huancavelica', 'huanuco', 'ica', 'junin', 'la libertad', 'lambayeque',
  'lima', 'loreto', 'madre de dios', 'moquegua', 'pasco', 'piura', 'puno',
  'san martin', 'tacna', 'tumbes', 'ucayali',
];

function detectRegion(q: string): string | null {
  const n = norm(q).replace(/cuzco/g, 'cusco'); // variante común
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

  // Intención 1 — ranking de regiones por OBRAS/RIESGO
  if (/regi(on|ones)/.test(n) && /(obra|riesgo|score|sospechos|marcad|peor)/.test(n)) {
    const byScore = /score|riesgo promedio|peor|sospechos/.test(n);
    const orderCol = byScore ? 'score_promedio' : 'n_obras_riesgo';
    const sql = `SELECT region, n_obras_riesgo::int, score_promedio::int,
                        monto_riesgo::float8 AS monto_riesgo
                 FROM performance_regional
                 ORDER BY ${orderCol} DESC, monto_riesgo DESC LIMIT 5`;
    const rows: any[] = await query(sql, []);
    const r0 = rows[0];
    const rest = joinY(rows.slice(1, 3).map((r) => `${titleCase(r.region)} (${r.n_obras_riesgo})`));
    const answer = byScore
      ? `La más comprometida es ${titleCase(r0.region)}, con un score promedio de ${r0.score_promedio}/100. Le siguen ${rest}.`
      : `${titleCase(r0.region)} encabeza con ${r0.n_obras_riesgo} obras en riesgo (${fmtPEN(r0.monto_riesgo)} en juego). Le siguen ${rest}.`;
    return { answer, sql: renderSql(sql, []), rowCount: rows.length, rows };
  }

  // Intención 2 — ranking de contratistas reincidentes
  if (/contratist|empresa/.test(n) && /(mas|mayor|reincident|repit|ranking|top)/.test(n) && !flag) {
    const sql = `SELECT contratista, ruc_contratista AS ruc, COUNT(*)::int AS n_obras,
                        MAX(red_flag_score)::int AS score_max, SUM(monto_contrato)::float8 AS monto
                 FROM obras_riesgo WHERE contratista IS NOT NULL
                 GROUP BY contratista, ruc_contratista
                 ORDER BY n_obras DESC, score_max DESC LIMIT 5`;
    const rows: any[] = await query(sql, []);
    const r0 = rows[0];
    const rest = joinY(rows.slice(1, 3).map((r) => `${shortName(r.contratista)} (${r.n_obras})`));
    const answer = `El más reincidente es ${shortName(r0.contratista)}, con ${r0.n_obras} obras marcadas por ${fmtPEN(r0.monto)}. Le siguen ${rest}.`;
    return { answer, sql: renderSql(sql, []), rowCount: rows.length, rows };
  }

  // Intención 3 — presupuesto / ejecución
  if (/presupuest|ejecu|pim|devengad/.test(n)) {
    const asc = /menos|baja|peor|menor/.test(n);
    const sql = `SELECT region, pim_total::float8, devengado_total::float8, pct_ejecucion::float8
                 FROM performance_regional ORDER BY pct_ejecucion ${asc ? 'ASC' : 'DESC'} LIMIT 5`;
    const rows: any[] = await query(sql, []);
    const r0 = rows[0];
    const sigue = rows[1] ? ` Le sigue ${titleCase(rows[1].region)} (${rows[1].pct_ejecucion}%).` : '';
    const answer = `${titleCase(r0.region)} ${asc ? 'es la que menos ejecuta' : 'lidera la ejecución'}: ${r0.pct_ejecucion}% de su presupuesto (PIM de ${fmtPEN(r0.pim_total)}).${sigue}`;
    return { answer, sql: renderSql(sql, []), rowCount: rows.length, rows };
  }

  // Intención 4 — servicios básicos (escuelas / hospitales / postas)
  if (/escuela|colegio|hospital|posta|salud|servicio/.test(n)) {
    let col = 'n_servicios', label = 'servicios activos';
    if (/escuela|colegio/.test(n)) { col = 'n_escuelas'; label = 'escuelas activas'; }
    else if (/hospital/.test(n)) { col = 'n_hospitales'; label = 'hospitales'; }
    else if (/posta/.test(n)) { col = 'n_postas'; label = 'postas de salud'; }
    const sql = `SELECT region, ${col}::int AS valor FROM performance_regional ORDER BY ${col} DESC LIMIT 5`;
    const rows: any[] = await query(sql, []);
    const r0 = rows[0];
    const rest = joinY(rows.slice(1, 3).map((r) => `${titleCase(r.region)} (${fmtInt(r.valor)})`));
    const answer = `${titleCase(r0.region)} concentra más ${label}: ${fmtInt(r0.valor)}. Le siguen ${rest}.`;
    return { answer, sql: renderSql(sql, []), rowCount: rows.length, rows };
  }

  // Intención 4b — planilla / empleados públicos
  if (/empleado|planilla|trabajador|sueldo|salario/.test(n)) {
    const sql = `SELECT region, n_empleados::int, sueldo_promedio::float8
                 FROM performance_regional ORDER BY n_empleados DESC LIMIT 5`;
    const rows: any[] = await query(sql, []);
    const r0 = rows[0];
    const rest = joinY(rows.slice(1, 3).map((r) => `${titleCase(r.region)} (${fmtInt(r.n_empleados)})`));
    const answer = `${titleCase(r0.region)} concentra más empleados públicos: ${fmtInt(r0.n_empleados)}. Le siguen ${rest}.`;
    return { answer, sql: renderSql(sql, []), rowCount: rows.length, rows };
  }

  // Intención 5 — obras filtradas por bandera y/o región (el caso forense central)
  const where: string[] = [];
  const params: unknown[] = [];
  if (flag) { params.push(flag.like); where.push(`red_flag_reasons::text ILIKE $${params.length}`); }
  if (region) { params.push(`%${region}%`); where.push(`region ILIKE $${params.length}`); }
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
  const rows: any[] = await query(sql, params);

  // Descripción natural del filtro: "paralizadas" / "con contratista sancionado" + "en Región".
  const descr = flag?.label === 'obra paralizada' ? ' paralizadas' : flag ? ` con ${flag.label}` : '';
  const loc = region ? ` en ${titleCase(region)}` : '';

  if (rows.length === 0) {
    return {
      answer: `No encontré obras${descr}${loc}. Probá con otra región, o con "obras paralizadas" o "sobrecosto".`,
      sql: renderSql(sql, params), rowCount: 0, rows,
    };
  }

  const bullets = rows.slice(0, 3).map((r) =>
    `• ${shortName(r.contratista ?? r.entidad)} — ${fmtPEN(r.monto)} · riesgo ${r.red_flag_score}${r.estado_obra ? ` · ${r.estado_obra.toLowerCase()}` : ''}`,
  ).join('\n');
  const lead = `Encontré ${rows.length} obra${rows.length === 1 ? '' : 's'}${descr}${loc}. ${orderByMonto ? 'Las de mayor monto' : 'Las más riesgosas'}:`;
  const more = rows.length > 3 ? `\n\n…y ${rows.length - 3} más.` : '';

  return { answer: `${lead}\n\n${bullets}${more}`, sql: renderSql(sql, params), rowCount: rows.length, rows };
}
