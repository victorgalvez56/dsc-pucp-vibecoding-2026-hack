-- =============================================================================
-- 01 · Silver/Gold — tabla canónica `obras`
-- Contratación pública del Estado (fuente: OCDS). Una fila por contrato.
-- Enriquecida con coordenadas, código de obra (link a avance_obra) y el score
-- de riesgo (lo calcula la función de la migración 04).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- fuzzy matching de nombres (entity resolution)

CREATE TABLE IF NOT EXISTS obras (
    -- Identidad
    id_contrato         TEXT PRIMARY KEY,          -- id único del contrato (OCDS ocid/contract id)
    source_year         INTEGER,

    -- Entidad compradora
    entidad             TEXT,
    entidad_ruc         TEXT,
    region              TEXT,

    -- Objeto del contrato
    objeto              TEXT,                       -- título / descripción de la contratación
    metodo_adjudicacion TEXT,                       -- LP, AD (adjudicación directa), etc.

    -- Contratista / proveedor
    contratista         TEXT,
    ruc_contratista     TEXT,                       -- cruce con sanciones.ruc

    -- Montos
    monto_adjudicado    NUMERIC,
    monto_contrato      NUMERIC,
    moneda              TEXT DEFAULT 'PEN',
    fecha_adjudicacion  DATE,

    -- Enriquecimiento
    codigo_obra         TEXT,                       -- cruce con avance_obra.codigo (INFOBRAS)
    lat                 NUMERIC,
    lng                 NUMERIC,

    -- Riesgo (lo puebla compute_red_flag_scores())
    is_red_flag         BOOLEAN NOT NULL DEFAULT FALSE,
    red_flag_score      INTEGER NOT NULL DEFAULT 0,
    red_flag_reasons    JSONB   NOT NULL DEFAULT '[]',

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obras_ruc         ON obras(ruc_contratista);
CREATE INDEX IF NOT EXISTS idx_obras_region      ON obras(region);
CREATE INDEX IF NOT EXISTS idx_obras_metodo      ON obras(metodo_adjudicacion);
CREATE INDEX IF NOT EXISTS idx_obras_codigo_obra ON obras(codigo_obra);
CREATE INDEX IF NOT EXISTS idx_obras_score       ON obras(red_flag_score DESC);
CREATE INDEX IF NOT EXISTS idx_obras_geo         ON obras(lat, lng);
-- Trigram sobre el nombre del contratista (matching difuso entre fuentes)
CREATE INDEX IF NOT EXISTS idx_obras_contratista_trgm
    ON obras USING gin (contratista gin_trgm_ops);

ALTER TABLE obras DISABLE ROW LEVEL SECURITY;
-- =============================================================================
-- 02 · Silver — tabla canónica `sanciones`
-- Sancionados, penalidades e inhabilitaciones de contratistas (fuente: OECE /
-- datos abiertos). Se cruza con obras por RUC. Base de las red flags.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sanciones (
    id           SERIAL PRIMARY KEY,
    ruc          TEXT NOT NULL,                 -- cruce con obras.ruc_contratista
    nombre       TEXT,
    tipo         TEXT NOT NULL,                 -- sancion | penalidad | inhabilitacion_judicial
    descripcion  TEXT,
    fecha_inicio DATE,
    fecha_fin    DATE,
    vigente      BOOLEAN,                       -- TRUE si sigue activa (sin fecha_fin o futura)
    fuente       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sanciones_ruc  ON sanciones(ruc);
CREATE INDEX IF NOT EXISTS idx_sanciones_tipo ON sanciones(tipo);

ALTER TABLE sanciones DISABLE ROW LEVEL SECURITY;
-- =============================================================================
-- 03 · Silver — tabla canónica `avance_obra`
-- Avance físico y estado de ejecución de obras (fuente: Contraloría / INFOBRAS).
-- Se cruza con obras por codigo_obra. Aporta señales de paralización y plazos.
-- =============================================================================

CREATE TABLE IF NOT EXISTS avance_obra (
    codigo                 TEXT PRIMARY KEY,        -- código INFOBRAS; cruce con obras.codigo_obra
    nombre                 TEXT,
    entidad                TEXT,
    contratista            TEXT,
    contratista_ruc        TEXT,

    -- Avance / estado
    avance_fisico_pct      NUMERIC,                 -- 0-100
    estado                 TEXT,                    -- en ejecución | paralizada | concluida | ...
    n_modificaciones_plazo INTEGER DEFAULT 0,

    -- Plazos
    fecha_inicio           DATE,
    fecha_fin_programada   DATE,
    fecha_fin_real         DATE,

    -- Montos
    monto_aprobacion       NUMERIC,

    -- Geo
    lat                    NUMERIC,
    lng                    NUMERIC,

    scraped_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avance_estado ON avance_obra(estado);
CREATE INDEX IF NOT EXISTS idx_avance_ruc    ON avance_obra(contratista_ruc);

ALTER TABLE avance_obra DISABLE ROW LEVEL SECURITY;
-- =============================================================================
-- 04 · Gold — motor de reglas: scoring de red flags (explicable)
-- compute_red_flag_scores() calcula un score ponderado [0-100] por obra cruzando
-- sanciones + avance_obra + atributos del contrato, y guarda el desglose en
-- obras.red_flag_reasons (JSONB) para poder explicar *por qué* está marcada.
-- Correr tras cada ingesta:  SELECT compute_red_flag_scores();
--
-- Pesos (ver docs/architecture.md §5):
--   contratista_sancionado  35 | inhabilitacion_judicial +15 | sobrecosto 25
--   obra_paralizada 20 | obra_vencida 15 | adjudicacion_directa 10
--   modificaciones_plazo 10 | contratista_recurrente 10   (score truncado a 100)
-- =============================================================================

CREATE OR REPLACE FUNCTION compute_red_flag_scores()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Contratistas con muchas adjudicaciones (proxy de concentración/captura)
  CREATE TEMP TABLE _recurrente ON COMMIT DROP AS
    SELECT ruc_contratista
    FROM obras
    WHERE ruc_contratista IS NOT NULL AND ruc_contratista <> ''
    GROUP BY ruc_contratista
    HAVING COUNT(*) >= 10;

  UPDATE obras o
  SET red_flag_score   = LEAST(100, sub.score),
      red_flag_reasons = sub.reasons,
      is_red_flag      = sub.score > 0
  FROM (
    SELECT
      o2.id_contrato,
      (
        CASE WHEN s.ruc IS NOT NULL THEN 35 ELSE 0 END
      + CASE WHEN s.judicial_vigente THEN 15 ELSE 0 END
      + CASE WHEN o2.monto_contrato > o2.monto_adjudicado * 1.15
                  AND o2.monto_adjudicado > 0 THEN 25 ELSE 0 END
      + CASE WHEN a.estado ILIKE '%paraliz%' THEN 20 ELSE 0 END
      + CASE WHEN a.fecha_fin_programada IS NOT NULL
                  AND a.fecha_fin_real IS NULL
                  AND COALESCE(a.avance_fisico_pct, 0) < 100
                  AND a.fecha_fin_programada < CURRENT_DATE THEN 15 ELSE 0 END
      + CASE WHEN o2.metodo_adjudicacion ILIKE '%directa%' THEN 10 ELSE 0 END
      + CASE WHEN COALESCE(a.n_modificaciones_plazo, 0) >= 3 THEN 10 ELSE 0 END
      + CASE WHEN r.ruc_contratista IS NOT NULL THEN 10 ELSE 0 END
      ) AS score,
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('code', code, 'weight', w)), '[]')
        FROM (
          SELECT 'contratista_sancionado' AS code, 35 AS w WHERE s.ruc IS NOT NULL
          UNION ALL SELECT 'inhabilitacion_judicial', 15 WHERE s.judicial_vigente
          UNION ALL SELECT 'sobrecosto', 25
            WHERE o2.monto_contrato > o2.monto_adjudicado * 1.15 AND o2.monto_adjudicado > 0
          UNION ALL SELECT 'obra_paralizada', 20 WHERE a.estado ILIKE '%paraliz%'
          UNION ALL SELECT 'obra_vencida', 15
            WHERE a.fecha_fin_programada IS NOT NULL AND a.fecha_fin_real IS NULL
              AND COALESCE(a.avance_fisico_pct, 0) < 100 AND a.fecha_fin_programada < CURRENT_DATE
          UNION ALL SELECT 'adjudicacion_directa', 10 WHERE o2.metodo_adjudicacion ILIKE '%directa%'
          UNION ALL SELECT 'modificaciones_plazo', 10 WHERE COALESCE(a.n_modificaciones_plazo,0) >= 3
          UNION ALL SELECT 'contratista_recurrente', 10 WHERE r.ruc_contratista IS NOT NULL
        ) reasons
      ) AS reasons
    FROM obras o2
    -- ¿el contratista tiene sanción? ¿alguna es judicial vigente?
    LEFT JOIN LATERAL (
      SELECT MIN(sa.ruc) AS ruc,
             bool_or(sa.tipo = 'inhabilitacion_judicial' AND COALESCE(sa.vigente, TRUE)) AS judicial_vigente
      FROM sanciones sa
      WHERE sa.ruc = o2.ruc_contratista
    ) s ON TRUE
    -- señales de avance de obra
    LEFT JOIN avance_obra a ON a.codigo = o2.codigo_obra
    LEFT JOIN _recurrente r ON r.ruc_contratista = o2.ruc_contratista
  ) sub
  WHERE o.id_contrato = sub.id_contrato;
END;
$$;
-- =============================================================================
-- 05 · Gold — Vista Materializada `obras_riesgo`
-- Read model (CQRS-lite): obras con red_flag_score > 0, enriquecidas con datos
-- de avance_obra para el panel forense y el mapa.
--
-- Aplicar DESPUÉS de haber corrido SELECT compute_red_flag_scores();
-- Para refrescar tras cada ingesta:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY obras_riesgo;
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS obras_riesgo AS
SELECT
  o.id_contrato,
  o.entidad,
  o.entidad_ruc,
  o.region,
  o.objeto,
  o.metodo_adjudicacion,
  o.contratista,
  o.ruc_contratista,
  o.monto_adjudicado,
  o.monto_contrato,
  o.moneda,
  o.fecha_adjudicacion,
  o.codigo_obra,
  -- Coordenadas: preferir las de obras, fallback a avance_obra
  COALESCE(o.lat, a.lat)   AS lat,
  COALESCE(o.lng, a.lng)   AS lng,
  o.red_flag_score,
  o.red_flag_reasons,
  -- Señales de avance (para el panel forense)
  a.avance_fisico_pct,
  a.estado                 AS estado_obra,
  a.n_modificaciones_plazo,
  a.fecha_fin_programada,
  a.fecha_fin_real
FROM obras o
LEFT JOIN avance_obra a ON a.codigo = o.codigo_obra
WHERE o.red_flag_score > 0
WITH NO DATA;

-- Índice único requerido para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_obras_riesgo_id
    ON obras_riesgo (id_contrato);

-- Índice principal de lectura (orden por score desc — lo que pide el mapa)
CREATE INDEX IF NOT EXISTS idx_obras_riesgo_score
    ON obras_riesgo (red_flag_score DESC);

-- Índice geoespacial (filtro rápido por bbox)
CREATE INDEX IF NOT EXISTS idx_obras_riesgo_geo
    ON obras_riesgo (lat, lng)
    WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Índice por región (filtro de faceta en la API)
CREATE INDEX IF NOT EXISTS idx_obras_riesgo_region
    ON obras_riesgo (region);

-- Primer poblado de la vista
REFRESH MATERIALIZED VIEW obras_riesgo;
-- =============================================================================
-- 06 · Silver — tabla canónica `presupuesto`
-- Ejecución presupuestal del Estado peruano (fuente: MEF Consulta Amigable).
-- Una fila por entidad × año × función presupuestal.
-- =============================================================================

CREATE TABLE IF NOT EXISTS presupuesto (
    id              SERIAL PRIMARY KEY,
    ano             INTEGER NOT NULL,
    nivel_gobierno  TEXT,               -- GN | GR | GL
    sector          TEXT,
    pliego          TEXT,
    pliego_codigo   TEXT,
    entidad         TEXT NOT NULL,
    entidad_codigo  TEXT,
    region          TEXT,               -- cruce con region_centroide
    funcion         TEXT,
    programa        TEXT,
    tipo_gasto      TEXT,
    pim             NUMERIC,            -- Presupuesto Institucional Modificado
    devengado       NUMERIC,            -- Monto ejecutado
    pct_ejecucion   NUMERIC,            -- devengado / pim * 100 (calculado en ETL)
    scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presupuesto_region  ON presupuesto(region);
CREATE INDEX IF NOT EXISTS idx_presupuesto_ano     ON presupuesto(ano);
CREATE INDEX IF NOT EXISTS idx_presupuesto_nivel   ON presupuesto(nivel_gobierno);
CREATE INDEX IF NOT EXISTS idx_presupuesto_entidad ON presupuesto(entidad_codigo);

ALTER TABLE presupuesto DISABLE ROW LEVEL SECURITY;
-- =============================================================================
-- 07 · Silver — tabla canónica `servicios_basicos`
-- Establecimientos de salud (MINSA/RENIPRESS) e instituciones educativas
-- (MINEDU). Permite calcular cobertura y brecha por distrito / región.
-- =============================================================================

CREATE TABLE IF NOT EXISTS servicios_basicos (
    id              SERIAL PRIMARY KEY,
    tipo            TEXT NOT NULL,      -- escuela | posta_salud | hospital | comisaria
    nombre          TEXT,
    codigo          TEXT,               -- código MINEDU o RENIPRESS
    region          TEXT,
    provincia       TEXT,
    distrito        TEXT,
    ubigeo          TEXT,               -- código ubigeo 6 dígitos
    estado          TEXT,               -- activo | cerrado | en_construccion
    nivel           TEXT,               -- inicial | primaria | secundaria (escuelas)
    n_alumnos       INTEGER,
    n_docentes      INTEGER,
    n_camas         INTEGER,            -- establecimientos de salud
    lat             NUMERIC,
    lng             NUMERIC,
    fuente          TEXT NOT NULL,      -- minedu | minsa
    scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servicios_region ON servicios_basicos(region);
CREATE INDEX IF NOT EXISTS idx_servicios_tipo   ON servicios_basicos(tipo);
CREATE INDEX IF NOT EXISTS idx_servicios_ubigeo ON servicios_basicos(ubigeo);
CREATE INDEX IF NOT EXISTS idx_servicios_geo    ON servicios_basicos(lat, lng)
    WHERE lat IS NOT NULL AND lng IS NOT NULL;

ALTER TABLE servicios_basicos DISABLE ROW LEVEL SECURITY;
-- =============================================================================
-- 08 · Silver — tabla canónica `planilla`
-- Planilla del sector público (fuente: SERVIR / datos abiertos).
-- Una fila por entidad × año × régimen laboral.
-- =============================================================================

CREATE TABLE IF NOT EXISTS planilla (
    id              SERIAL PRIMARY KEY,
    ano             INTEGER NOT NULL,
    mes             INTEGER,
    entidad         TEXT NOT NULL,
    entidad_codigo  TEXT,
    sector          TEXT,
    nivel_gobierno  TEXT,               -- GN | GR | GL
    region          TEXT,               -- cruce con region_centroide
    regimen         TEXT,               -- CAS | D.Leg 276 | D.Leg 728 | SNP | etc
    n_trabajadores  INTEGER,
    monto_total     NUMERIC,
    promedio_sueldo NUMERIC,
    scraped_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planilla_region  ON planilla(region);
CREATE INDEX IF NOT EXISTS idx_planilla_ano     ON planilla(ano);
CREATE INDEX IF NOT EXISTS idx_planilla_entidad ON planilla(entidad_codigo);

ALTER TABLE planilla DISABLE ROW LEVEL SECURITY;
-- =============================================================================
-- 09 · Gold — centroides regionales + Vista Materializada `performance_regional`
-- Agrega las 4 capas (presupuesto, servicios, planilla, obras) por región para
-- el mapa de desempeño integral. Refrescar tras cada ingesta:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY performance_regional;
-- =============================================================================

-- Tabla auxiliar: centroide geográfico de las 25 regiones del Perú
CREATE TABLE IF NOT EXISTS region_centroide (
    region  TEXT PRIMARY KEY,
    lat     NUMERIC NOT NULL,
    lng     NUMERIC NOT NULL
);

INSERT INTO region_centroide (region, lat, lng) VALUES
  ('AMAZONAS',       -4.50,  -78.00),
  ('ANCASH',         -9.50,  -77.55),
  ('APURIMAC',      -14.05,  -73.09),
  ('AREQUIPA',      -16.40,  -71.54),
  ('AYACUCHO',      -13.16,  -74.22),
  ('CAJAMARCA',      -7.16,  -78.51),
  ('CALLAO',        -12.06,  -77.13),
  ('CUSCO',         -13.53,  -71.97),
  ('HUANCAVELICA',  -12.79,  -74.97),
  ('HUANUCO',        -9.93,  -76.24),
  ('ICA',           -14.07,  -75.73),
  ('JUNIN',         -11.99,  -75.00),
  ('LA LIBERTAD',    -8.11,  -78.00),
  ('LAMBAYEQUE',     -6.77,  -79.84),
  ('LIMA',          -12.05,  -77.04),
  ('LORETO',         -4.35,  -76.13),
  ('MADRE DE DIOS', -11.60,  -70.08),
  ('MOQUEGUA',      -17.19,  -70.93),
  ('PASCO',         -10.68,  -76.26),
  ('PIURA',          -5.19,  -80.63),
  ('PUNO',          -15.84,  -70.02),
  ('SAN MARTIN',     -6.49,  -76.37),
  ('TACNA',         -18.01,  -70.25),
  ('TUMBES',         -3.57,  -80.45),
  ('UCAYALI',        -9.53,  -73.07)
ON CONFLICT (region) DO NOTHING;

-- Vista materializada: desempeño por región — las 4 capas resumidas
CREATE MATERIALIZED VIEW IF NOT EXISTS performance_regional AS
WITH ppto AS (
    SELECT
        region,
        SUM(pim)                                                      AS pim_total,
        SUM(devengado)                                                AS devengado_total,
        ROUND(CASE WHEN SUM(COALESCE(pim, 0)) > 0
                   THEN SUM(COALESCE(devengado, 0)) /
                        SUM(COALESCE(pim, 0)) * 100
                   ELSE 0 END, 1)                                     AS pct_ejecucion
    FROM presupuesto
    WHERE ano = EXTRACT(YEAR FROM CURRENT_DATE)::int
      AND region IS NOT NULL
    GROUP BY region
),
svc AS (
    SELECT
        region,
        COUNT(*) FILTER (WHERE tipo = 'escuela')     AS n_escuelas,
        COUNT(*) FILTER (WHERE tipo = 'posta_salud') AS n_postas,
        COUNT(*) FILTER (WHERE tipo = 'hospital')    AS n_hospitales,
        COUNT(*)                                      AS n_servicios
    FROM servicios_basicos
    WHERE estado = 'activo' AND region IS NOT NULL
    GROUP BY region
),
pln AS (
    SELECT
        region,
        SUM(n_trabajadores)            AS n_empleados,
        ROUND(AVG(promedio_sueldo), 0) AS sueldo_promedio
    FROM planilla
    WHERE ano = EXTRACT(YEAR FROM CURRENT_DATE)::int
      AND region IS NOT NULL
    GROUP BY region
),
obr AS (
    SELECT
        region,
        COUNT(*)                        AS n_obras_riesgo,
        ROUND(AVG(red_flag_score))::int AS score_promedio,
        SUM(monto_contrato)             AS monto_riesgo
    FROM obras_riesgo
    WHERE region IS NOT NULL
    GROUP BY region
)
SELECT
    rc.region,
    rc.lat,
    rc.lng,
    -- Presupuesto
    COALESCE(p.pim_total,       0) AS pim_total,
    COALESCE(p.devengado_total, 0) AS devengado_total,
    COALESCE(p.pct_ejecucion,   0) AS pct_ejecucion,
    -- Servicios
    COALESCE(s.n_escuelas,   0) AS n_escuelas,
    COALESCE(s.n_postas,     0) AS n_postas,
    COALESCE(s.n_hospitales, 0) AS n_hospitales,
    COALESCE(s.n_servicios,  0) AS n_servicios,
    -- Planilla
    COALESCE(l.n_empleados,     0) AS n_empleados,
    COALESCE(l.sueldo_promedio, 0) AS sueldo_promedio,
    -- Obras
    COALESCE(o.n_obras_riesgo, 0) AS n_obras_riesgo,
    COALESCE(o.score_promedio, 0) AS score_promedio,
    COALESCE(o.monto_riesgo,   0) AS monto_riesgo
FROM region_centroide rc
LEFT JOIN ppto p ON p.region = rc.region
LEFT JOIN svc  s ON s.region = rc.region
LEFT JOIN pln  l ON l.region = rc.region
LEFT JOIN obr  o ON o.region = rc.region
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_regional_region
    ON performance_regional (region);

CREATE INDEX IF NOT EXISTS idx_perf_ejecucion
    ON performance_regional (pct_ejecucion);

REFRESH MATERIALIZED VIEW performance_regional;
-- =============================================================================
-- 10 · SEED DEMO — Datos de muestra para demostración
-- Insertar en Supabase SQL Editor para poblar el mapa sin esperar el ETL.
-- Cuando el ETL esté listo: TRUNCATE obras, sanciones, avance_obra,
--   presupuesto, servicios_basicos, planilla CASCADE; y reinsertar con datos reales.
-- =============================================================================

-- ─── 1. Sanciones (necesarias para activar red flags) ────────────────────────
INSERT INTO sanciones (ruc, nombre, tipo, descripcion, fecha_inicio, fecha_fin, vigente, fuente) VALUES
  ('20100070970', 'CONSTRUCTORA ALTAMIRA SAC',       'sancion',                  'Incumplimiento contractual reiterado',          '2022-03-01', NULL,         TRUE,  'OECE'),
  ('20100070970', 'CONSTRUCTORA ALTAMIRA SAC',       'inhabilitacion_judicial',  'Inhabilitación por colusión en licitación',     '2023-06-15', NULL,         TRUE,  'OECE'),
  ('20131312955', 'CONSORCIO VIAL NORTE EIRL',       'sancion',                  'Penalidad por retraso en entrega de obra',      '2021-09-10', '2023-09-10', FALSE, 'OECE'),
  ('20456789012', 'INMOBILIARIA LOS ANDES SAC',      'penalidad',                'Penalidad por defectos en construcción',        '2023-01-20', NULL,         TRUE,  'OECE'),
  ('20512345678', 'TECH CONSTRUCCIONES PERU SAC',    'sancion',                  'Sanción por presentar documentos falsos',       '2024-02-01', NULL,         TRUE,  'OECE')
ON CONFLICT DO NOTHING;

-- ─── 2. Avance de obras (señales de paralización y retrasos) ─────────────────
INSERT INTO avance_obra (codigo, nombre, entidad, contratista, contratista_ruc, avance_fisico_pct, estado, n_modificaciones_plazo, fecha_inicio, fecha_fin_programada, fecha_fin_real, monto_aprobacion, lat, lng) VALUES
  ('INF-001', 'Mejoramiento carretera Cusco-Quillabamba',       'GORE CUSCO',     'CONSTRUCTORA ALTAMIRA SAC',    '20100070970', 23.5,  'Paralizada',    4, '2021-03-01', '2022-12-31', NULL,         15800000, -13.5319, -71.9675),
  ('INF-002', 'Construcción hospital nivel II Puno',             'GORE PUNO',      'CONSORCIO VIAL NORTE EIRL',   '20131312955', 61.0,  'En ejecución',  3, '2022-06-01', '2023-12-31', NULL,         28400000, -15.8402, -70.0219),
  ('INF-003', 'Ampliación sistema de agua potable Ayacucho',    'MPAYACUCHO',     'INMOBILIARIA LOS ANDES SAC',  '20456789012', 88.0,  'En ejecución',  1, '2023-01-15', '2024-01-15', NULL,          4200000, -13.1588, -74.2236),
  ('INF-004', 'Rehabilitación pistas y veredas Lima Norte',     'MDC LIMA',       'TECH CONSTRUCCIONES PERU SAC','20512345678', 0.0,   'Paralizada',    5, '2022-09-01', '2023-06-30', NULL,          9750000, -11.9675, -77.0856),
  ('INF-005', 'Construcción colegio emblemático Trujillo',      'GRE LA LIBERTAD','CONSORCIO SUR ANDINO SAC',    '20601234567', 95.0,  'En ejecución',  0, '2023-03-01', '2024-03-01', NULL,          6300000,  -8.1091, -79.0215),
  ('INF-006', 'Mejoramiento plaza principal Huancayo',          'MPH JUNIN',      'OBRAS CIVILES JUNIN EIRL',    '20712345678', 100.0, 'Concluida',     0, '2022-01-01', '2022-12-31', '2023-01-15',  1850000, -12.0651, -75.2049),
  ('INF-007', 'Construcción puente vehicular Loreto',           'GORE LORETO',    'CONSTRUCTORA AMAZONICA SAC',  '20823456789', 15.0,  'Paralizada',    6, '2021-07-01', '2023-07-01', NULL,         22100000,  -3.7480, -73.2516),
  ('INF-008', 'Electrificación rural Cajamarca',               'GORE CAJAMARCA', 'ELECTROANDES PERU SAC',       '20934567890', 72.0,  'En ejecución',  2, '2023-04-01', '2024-10-01', NULL,          7600000,  -7.1638, -78.5001)
ON CONFLICT (codigo) DO NOTHING;

-- ─── 3. Obras (contratación pública) ─────────────────────────────────────────
INSERT INTO obras (id_contrato, source_year, entidad, entidad_ruc, region, objeto, metodo_adjudicacion, contratista, ruc_contratista, monto_adjudicado, monto_contrato, moneda, fecha_adjudicacion, codigo_obra, lat, lng) VALUES
  -- CUSCO — contratista sancionado + inhabilitación judicial + paralizada + sobrecosto + 4 ampliaciones
  ('CONT-2021-CUSCO-001', 2021, 'Gobierno Regional Cusco',         '20212862271', 'CUSCO',
   'Mejoramiento carretera Cusco-Quillabamba tramo I',
   'Licitación Pública', 'CONSTRUCTORA ALTAMIRA SAC', '20100070970',
   12500000, 15800000, 'PEN', '2021-02-15', 'INF-001', -13.5319, -71.9675),

  -- PUNO — contratista con sanción vigente + obra vencida + 3 ampliaciones
  ('CONT-2022-PUNO-001', 2022, 'Gobierno Regional Puno',           '20445654481', 'PUNO',
   'Construcción hospital nivel II ciudad de Puno',
   'Concurso Público', 'CONSORCIO VIAL NORTE EIRL', '20131312955',
   24000000, 28400000, 'PEN', '2022-05-20', 'INF-002', -15.8402, -70.0219),

  -- AYACUCHO — penalidad + adjudicación directa
  ('CONT-2023-AYA-001', 2023, 'Municipalidad Provincial Huamanga', '20407277144', 'AYACUCHO',
   'Ampliación y mejoramiento sistema agua potable Ayacucho',
   'Adjudicación Directa', 'INMOBILIARIA LOS ANDES SAC', '20456789012',
   4000000, 4200000, 'PEN', '2023-01-10', 'INF-003', -13.1588, -74.2236),

  -- LIMA — sancionado + paralizada + 5 ampliaciones + adjudicación directa
  ('CONT-2022-LIMA-001', 2022, 'Municipalidad Distrital Comas',    '20131369477', 'LIMA',
   'Rehabilitación de pistas y veredas Lima Norte sector 4',
   'Adjudicación Directa', 'TECH CONSTRUCCIONES PERU SAC', '20512345678',
   8500000, 9750000, 'PEN', '2022-08-30', 'INF-004', -11.9675, -77.0856),

  -- LA LIBERTAD — obra en buen estado (score bajo)
  ('CONT-2023-LALI-001', 2023, 'GRE La Libertad',                  '20481536908', 'LA LIBERTAD',
   'Construcción colegio emblemático Trujillo sector norte',
   'Licitación Pública', 'CONSORCIO SUR ANDINO SAC', '20601234567',
   6200000, 6300000, 'PEN', '2023-02-20', 'INF-005', -8.1091, -79.0215),

  -- JUNIN — obra concluida sin flags
  ('CONT-2022-JUN-001', 2022, 'Municipalidad Provincial Huancayo', '20281533175', 'JUNIN',
   'Mejoramiento de plaza principal y área circundante Huancayo',
   'Adjudicación Simplificada', 'OBRAS CIVILES JUNIN EIRL', '20712345678',
   1800000, 1850000, 'PEN', '2021-12-10', 'INF-006', -12.0651, -75.2049),

  -- LORETO — paralizada + 6 ampliaciones + adjudicación directa
  ('CONT-2021-LOR-001', 2021, 'Gobierno Regional Loreto',          '20274660440', 'LORETO',
   'Construcción puente vehicular sobre río Itaya ciudad Iquitos',
   'Adjudicación Directa', 'CONSTRUCTORA AMAZONICA SAC', '20823456789',
   18000000, 22100000, 'PEN', '2021-06-15', 'INF-007', -3.7480, -73.2516),

  -- CAJAMARCA — vencida + 2 ampliaciones
  ('CONT-2023-CAJ-001', 2023, 'Gobierno Regional Cajamarca',       '20453271737', 'CAJAMARCA',
   'Electrificación rural 32 centros poblados Cajamarca',
   'Concurso Público', 'ELECTROANDES PERU SAC', '20934567890',
   7400000, 7600000, 'PEN', '2023-03-25', 'INF-008', -7.1638, -78.5001),

  -- AREQUIPA — contratista recurrente (sin otras flags)
  ('CONT-2023-ARE-001', 2023, 'Municipalidad Provincial Arequipa', '20454316752', 'AREQUIPA',
   'Mejoramiento de parques metropolitanos Arequipa',
   'Licitación Pública', 'GRUPO CONSTRUCTOR AREQUIPA SAC', '20111222333',
   3200000, 3250000, 'PEN', '2023-04-10', NULL, -16.3989, -71.5369),

  ('CONT-2023-ARE-002', 2023, 'Municipalidad Provincial Arequipa', '20454316752', 'AREQUIPA',
   'Construcción mercado municipal La Pampa',
   'Licitación Pública', 'GRUPO CONSTRUCTOR AREQUIPA SAC', '20111222333',
   4100000, 4150000, 'PEN', '2023-05-20', NULL, -16.4090, -71.5372),

  ('CONT-2022-ARE-003', 2022, 'GORE Arequipa',                     '20453774445', 'AREQUIPA',
   'Rehabilitación vía expresa metropolitana tramo sur',
   'Licitación Pública', 'GRUPO CONSTRUCTOR AREQUIPA SAC', '20111222333',
   9800000, 9900000, 'PEN', '2022-11-05', NULL, -16.4205, -71.5140),

  -- ANCASH — sobrecosto
  ('CONT-2022-ANC-001', 2022, 'Municipalidad Provincial Huaraz',   '20601011028', 'ANCASH',
   'Construcción sistema de drenaje pluvial Huaraz',
   'Licitación Pública', 'CONSTRUCTORA WARI EIRL', '20167890123',
   5500000, 6800000, 'PEN', '2022-07-14', NULL, -9.5278, -77.5278),

  -- PIURA — adjudicación directa + sobrecosto
  ('CONT-2023-PIU-001', 2023, 'Municipalidad Distrital Castilla',  '20484421021', 'PIURA',
   'Mejoramiento canales de riego sector norte Piura',
   'Adjudicación Directa', 'HIDRAULICA PIURA SAC', '20278901234',
   2800000, 3400000, 'PEN', '2023-06-01', NULL, -5.1945, -80.6328),

  -- MOQUEGUA — sin flags
  ('CONT-2023-MOQ-001', 2023, 'Municipalidad Provincial Mariscal Nieto', '20279404560', 'MOQUEGUA',
   'Construcción polideportivo municipal Moquegua',
   'Licitación Pública', 'CONSTRUCTORA SUR PERU SAC', '20389012345',
   3900000, 4000000, 'PEN', '2023-08-15', NULL, -17.1942, -70.9312),

  -- TACNA
  ('CONT-2023-TAC-001', 2023, 'Municipalidad Provincial Tacna',    '20279404678', 'TACNA',
   'Mejoramiento acceso vial zona franca Tacna',
   'Adjudicación Simplificada', 'VIAS Y OBRAS TACNA EIRL', '20490123456',
   2100000, 2150000, 'PEN', '2023-09-01', NULL, -18.0146, -70.2536)

ON CONFLICT (id_contrato) DO NOTHING;

-- ─── 4. Presupuesto por región (MEF 2025 — valores aproximados reales) ────────
INSERT INTO presupuesto (ano, nivel_gobierno, sector, entidad, region, funcion, pim, devengado, pct_ejecucion) VALUES
  (2025, 'GR', 'SALUD',       'GORE AMAZONAS',    'AMAZONAS',     'SALUD',        180500000,  142300000, 78.8),
  (2025, 'GR', 'EDUCACION',   'GORE AMAZONAS',    'AMAZONAS',     'EDUCACION',    210300000,  168700000, 80.2),
  (2025, 'GR', 'TRANSPORTE',  'GORE ANCASH',      'ANCASH',       'TRANSPORTE',   890400000,  423100000, 47.5),
  (2025, 'GR', 'SALUD',       'GORE ANCASH',      'ANCASH',       'SALUD',        620100000,  487200000, 78.6),
  (2025, 'GR', 'TRANSPORTE',  'GORE APURIMAC',    'APURIMAC',     'TRANSPORTE',   340200000,   89400000, 26.3),
  (2025, 'GR', 'SALUD',       'GORE APURIMAC',    'APURIMAC',     'SALUD',        290100000,  198400000, 68.4),
  (2025, 'GR', 'TRANSPORTE',  'GORE AREQUIPA',    'AREQUIPA',     'TRANSPORTE',  1240000000,  820000000, 66.1),
  (2025, 'GR', 'SALUD',       'GORE AREQUIPA',    'AREQUIPA',     'SALUD',        980000000,  791000000, 80.7),
  (2025, 'GR', 'TRANSPORTE',  'GORE AYACUCHO',    'AYACUCHO',     'TRANSPORTE',   520000000,  182000000, 35.0),
  (2025, 'GR', 'SALUD',       'GORE AYACUCHO',    'AYACUCHO',     'SALUD',        380000000,  261000000, 68.7),
  (2025, 'GR', 'TRANSPORTE',  'GORE CAJAMARCA',   'CAJAMARCA',    'TRANSPORTE',   780000000,  312000000, 40.0),
  (2025, 'GR', 'SALUD',       'GORE CAJAMARCA',   'CAJAMARCA',    'SALUD',        620000000,  415000000, 66.9),
  (2025, 'GN', 'TRANSPORTE',  'MUNICIPALIDAD CALLAO', 'CALLAO',   'TRANSPORTE',   430000000,  361000000, 83.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE CUSCO',       'CUSCO',        'TRANSPORTE',  1100000000,  374000000, 34.0),
  (2025, 'GR', 'SALUD',       'GORE CUSCO',       'CUSCO',        'SALUD',        780000000,  530000000, 67.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE HUANCAVELICA','HUANCAVELICA', 'TRANSPORTE',   290000000,   75000000, 25.9),
  (2025, 'GR', 'SALUD',       'GORE HUANCAVELICA','HUANCAVELICA', 'SALUD',        240000000,  157000000, 65.4),
  (2025, 'GR', 'TRANSPORTE',  'GORE HUANUCO',     'HUANUCO',      'TRANSPORTE',   420000000,  176000000, 41.9),
  (2025, 'GR', 'SALUD',       'GORE HUANUCO',     'HUANUCO',      'SALUD',        360000000,  245000000, 68.1),
  (2025, 'GR', 'TRANSPORTE',  'GORE ICA',         'ICA',          'TRANSPORTE',   580000000,  432000000, 74.5),
  (2025, 'GR', 'SALUD',       'GORE ICA',         'ICA',          'SALUD',        470000000,  381000000, 81.1),
  (2025, 'GR', 'TRANSPORTE',  'GORE JUNIN',       'JUNIN',        'TRANSPORTE',   690000000,  352000000, 51.0),
  (2025, 'GR', 'SALUD',       'GORE JUNIN',       'JUNIN',        'SALUD',        540000000,  389000000, 72.0),
  (2025, 'GR', 'TRANSPORTE',  'GORE LA LIBERTAD', 'LA LIBERTAD',  'TRANSPORTE',   920000000,  552000000, 60.0),
  (2025, 'GR', 'SALUD',       'GORE LA LIBERTAD', 'LA LIBERTAD',  'SALUD',        720000000,  547000000, 75.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE LAMBAYEQUE',  'LAMBAYEQUE',   'TRANSPORTE',   610000000,  409000000, 67.0),
  (2025, 'GN', 'TRANSPORTE',  'MML',              'LIMA',         'TRANSPORTE',  8200000000, 5330000000, 65.0),
  (2025, 'GN', 'SALUD',       'MINSA LIMA',       'LIMA',         'SALUD',       6100000000, 4758000000, 78.0),
  (2025, 'GR', 'TRANSPORTE',  'GORE LORETO',      'LORETO',       'TRANSPORTE',   540000000,  119000000, 22.0),
  (2025, 'GR', 'SALUD',       'GORE LORETO',      'LORETO',       'SALUD',        410000000,  258000000, 62.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE MADRE DE DIOS','MADRE DE DIOS','TRANSPORTE',  180000000,  108000000, 60.0),
  (2025, 'GR', 'TRANSPORTE',  'GORE MOQUEGUA',    'MOQUEGUA',     'TRANSPORTE',   310000000,  245000000, 79.0),
  (2025, 'GR', 'TRANSPORTE',  'GORE PASCO',       'PASCO',        'TRANSPORTE',   240000000,   74000000, 30.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE PIURA',       'PIURA',        'TRANSPORTE',  1050000000,  567000000, 54.0),
  (2025, 'GR', 'SALUD',       'GORE PIURA',       'PIURA',        'SALUD',        810000000,  591000000, 72.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE PUNO',        'PUNO',         'TRANSPORTE',   750000000,  248000000, 33.1),
  (2025, 'GR', 'SALUD',       'GORE PUNO',        'PUNO',         'SALUD',        590000000,  384000000, 65.1),
  (2025, 'GR', 'TRANSPORTE',  'GORE SAN MARTIN',  'SAN MARTIN',   'TRANSPORTE',   430000000,  270000000, 62.8),
  (2025, 'GR', 'TRANSPORTE',  'GORE TACNA',       'TACNA',        'TRANSPORTE',   290000000,  246000000, 84.8),
  (2025, 'GR', 'TRANSPORTE',  'GORE TUMBES',      'TUMBES',       'TRANSPORTE',   180000000,  131000000, 72.8),
  (2025, 'GR', 'TRANSPORTE',  'GORE UCAYALI',     'UCAYALI',      'TRANSPORTE',   370000000,  155000000, 41.9)
ON CONFLICT DO NOTHING;

-- ─── 5. Servicios básicos por región (muestra representativa) ────────────────
INSERT INTO servicios_basicos (tipo, nombre, region, provincia, distrito, estado, nivel, n_alumnos, lat, lng, fuente) VALUES
  -- CUSCO
  ('escuela',     'IE 50500 Urubamba',                'CUSCO',       'Urubamba',   'Urubamba',    'activo', 'primaria',    320, -13.3042, -72.1145, 'minedu'),
  ('posta_salud', 'PS Ccorca',                        'CUSCO',       'Cusco',      'Ccorca',      'activo', NULL,         NULL, -13.6089, -72.0823, 'minsa'),
  ('hospital',    'Hospital Regional Cusco',          'CUSCO',       'Cusco',      'Cusco',       'activo', NULL,         NULL, -13.5200, -71.9720, 'minsa'),
  -- PUNO
  ('escuela',     'IE 70025 Gran Unidad Puno',        'PUNO',        'Puno',       'Puno',        'activo', 'secundaria', 890, -15.8402, -70.0219, 'minedu'),
  ('posta_salud', 'PS Acora',                         'PUNO',        'Puno',       'Acora',       'activo', NULL,         NULL, -16.0203, -69.9862, 'minsa'),
  ('hospital',    'Hospital Manuel Núñez Butrón Puno','PUNO',        'Puno',       'Puno',        'activo', NULL,         NULL, -15.8412, -70.0198, 'minsa'),
  -- LORETO
  ('escuela',     'IE 601050 Iquitos',                'LORETO',      'Maynas',     'Iquitos',     'activo', 'primaria',    410, -3.7480, -73.2516, 'minedu'),
  ('posta_salud', 'PS Belén',                         'LORETO',      'Maynas',     'Belén',       'activo', NULL,         NULL,  -3.7620, -73.2580, 'minsa'),
  -- HUANCAVELICA
  ('escuela',     'IE Nuestra Señora de Lourdes',     'HUANCAVELICA','Huancavelica','Huancavelica','activo','primaria',    180, -12.7870, -74.9761, 'minedu'),
  ('posta_salud', 'PS Manta',                         'HUANCAVELICA','Huancavelica','Manta',       'activo', NULL,         NULL, -12.5420, -74.8230, 'minsa'),
  -- APURIMAC
  ('escuela',     'IE 54001 Abancay',                 'APURIMAC',    'Abancay',    'Abancay',     'activo', 'secundaria', 560, -13.6374, -72.8814, 'minedu'),
  ('posta_salud', 'PS Lambrama',                      'APURIMAC',    'Abancay',    'Lambrama',    'activo', NULL,         NULL, -13.7102, -72.7234, 'minsa'),
  -- LIMA
  ('escuela',     'IE Gran Bretaña Lima',             'LIMA',        'Lima',       'Miraflores',  'activo', 'secundaria',1200, -12.1176, -77.0282, 'minedu'),
  ('hospital',    'Hospital Nacional Dos de Mayo',    'LIMA',        'Lima',       'Cercado',     'activo', NULL,         NULL, -12.0530, -77.0210, 'minsa'),
  ('posta_salud', 'PS Villa el Salvador',             'LIMA',        'Lima',       'Villa el Salvador','activo',NULL,    NULL, -12.2140, -76.9398, 'minsa'),
  -- CAJAMARCA
  ('escuela',     'IE San Ramón Cajamarca',           'CAJAMARCA',   'Cajamarca',  'Cajamarca',   'activo', 'secundaria', 740, -7.1638, -78.5001, 'minedu'),
  ('posta_salud', 'PS Namora',                        'CAJAMARCA',   'Cajamarca',  'Namora',      'activo', NULL,         NULL,  -7.2140, -78.3890, 'minsa'),
  -- PIURA
  ('escuela',     'IE San Miguel Piura',              'PIURA',       'Piura',      'Piura',       'activo', 'secundaria', 980, -5.1945, -80.6328, 'minedu'),
  ('hospital',    'Hospital Santa Rosa Piura',        'PIURA',       'Piura',      'Piura',       'activo', NULL,         NULL, -5.1890, -80.6270, 'minsa'),
  -- ANCASH
  ('escuela',     'IE Inmaculada Concepción Huaraz',  'ANCASH',      'Huaraz',     'Huaraz',      'activo', 'secundaria', 650, -9.5278, -77.5278, 'minedu'),
  ('posta_salud', 'PS Jangas',                        'ANCASH',      'Huaraz',     'Jangas',      'activo', NULL,         NULL, -9.4890, -77.5650, 'minsa')
ON CONFLICT DO NOTHING;

-- ─── 6. Planilla pública por región ──────────────────────────────────────────
INSERT INTO planilla (ano, mes, entidad, sector, nivel_gobierno, region, regimen, n_trabajadores, monto_total, promedio_sueldo) VALUES
  (2025, 6, 'GORE AMAZONAS',     'INTERIOR', 'GR', 'AMAZONAS',     'D.Leg 276', 4200,   18900000, 4500),
  (2025, 6, 'GORE ANCASH',       'INTERIOR', 'GR', 'ANCASH',       'D.Leg 276', 12800,  67200000, 5250),
  (2025, 6, 'GORE APURIMAC',     'INTERIOR', 'GR', 'APURIMAC',     'CAS',        6100,   25620000, 4200),
  (2025, 6, 'GORE AREQUIPA',     'INTERIOR', 'GR', 'AREQUIPA',     'D.Leg 276', 28400, 170400000, 6000),
  (2025, 6, 'GORE AYACUCHO',     'INTERIOR', 'GR', 'AYACUCHO',     'D.Leg 276',  9800,   44100000, 4500),
  (2025, 6, 'GORE CAJAMARCA',    'INTERIOR', 'GR', 'CAJAMARCA',    'D.Leg 276', 18600,   88350000, 4750),
  (2025, 6, 'MUNI CALLAO',       'INTERIOR', 'GL', 'CALLAO',       'D.Leg 728', 11200,   67200000, 6000),
  (2025, 6, 'GORE CUSCO',        'INTERIOR', 'GR', 'CUSCO',        'D.Leg 276', 22400,  112000000, 5000),
  (2025, 6, 'GORE HUANCAVELICA', 'INTERIOR', 'GR', 'HUANCAVELICA', 'CAS',        5400,   21060000, 3900),
  (2025, 6, 'GORE HUANUCO',      'INTERIOR', 'GR', 'HUANUCO',      'D.Leg 276',  8900,   37380000, 4200),
  (2025, 6, 'GORE ICA',          'INTERIOR', 'GR', 'ICA',          'D.Leg 276', 14600,   80300000, 5500),
  (2025, 6, 'GORE JUNIN',        'INTERIOR', 'GR', 'JUNIN',        'D.Leg 276', 17200,   86000000, 5000),
  (2025, 6, 'GORE LA LIBERTAD',  'INTERIOR', 'GR', 'LA LIBERTAD',  'D.Leg 276', 24800,  136400000, 5500),
  (2025, 6, 'GORE LAMBAYEQUE',   'INTERIOR', 'GR', 'LAMBAYEQUE',   'D.Leg 276', 16400,   82000000, 5000),
  (2025, 6, 'MML',               'INTERIOR', 'GL', 'LIMA',         'D.Leg 728', 98000,  686000000, 7000),
  (2025, 6, 'GORE LORETO',       'INTERIOR', 'GR', 'LORETO',       'D.Leg 276', 13200,   59400000, 4500),
  (2025, 6, 'GORE MADRE DE DIOS','INTERIOR', 'GR', 'MADRE DE DIOS','CAS',        3100,   15500000, 5000),
  (2025, 6, 'GORE MOQUEGUA',     'INTERIOR', 'GR', 'MOQUEGUA',     'D.Leg 276',  5800,   34800000, 6000),
  (2025, 6, 'GORE PASCO',        'INTERIOR', 'GR', 'PASCO',        'CAS',        4600,   18860000, 4100),
  (2025, 6, 'GORE PIURA',        'INTERIOR', 'GR', 'PIURA',        'D.Leg 276', 26200,  143100000, 5465),
  (2025, 6, 'GORE PUNO',         'INTERIOR', 'GR', 'PUNO',         'D.Leg 276', 19800,   89100000, 4500),
  (2025, 6, 'GORE SAN MARTIN',   'INTERIOR', 'GR', 'SAN MARTIN',   'D.Leg 276',  9400,   42300000, 4500),
  (2025, 6, 'GORE TACNA',        'INTERIOR', 'GR', 'TACNA',        'D.Leg 276',  7200,   43200000, 6000),
  (2025, 6, 'GORE TUMBES',       'INTERIOR', 'GR', 'TUMBES',       'D.Leg 276',  4800,   24000000, 5000),
  (2025, 6, 'GORE UCAYALI',      'INTERIOR', 'GR', 'UCAYALI',      'D.Leg 276',  7600,   34200000, 4500)
ON CONFLICT DO NOTHING;

-- ─── 7. Calcular scores y refrescar vistas Gold ───────────────────────────────
SELECT compute_red_flag_scores();
REFRESH MATERIALIZED VIEW obras_riesgo;
REFRESH MATERIALIZED VIEW performance_regional;

-- ─── 8. Verificar resultados ──────────────────────────────────────────────────
SELECT region, red_flag_score, red_flag_reasons
FROM obras
ORDER BY red_flag_score DESC;

SELECT region, pct_ejecucion, n_servicios, n_empleados, n_obras_riesgo
FROM performance_regional
ORDER BY pct_ejecucion ASC;
