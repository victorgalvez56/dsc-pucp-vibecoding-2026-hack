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
    WHERE ano = (SELECT MAX(ano) FROM presupuesto)
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
    WHERE ano = (SELECT MAX(ano) FROM planilla)
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
