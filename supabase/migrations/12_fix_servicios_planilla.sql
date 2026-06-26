-- =============================================================================
-- 12 · FIX — performance_regional mostraba servicios y empleados en CERO
--
-- Dos bugs en la vista Gold (09_gold_performance_regional.sql):
--   1) svc: `WHERE estado = 'activo'` no matcheaba nada — la data real usa
--      'Activo' (escuelas) y 'ACTIVO' (hospitales/postas). Fix: LOWER(estado).
--   2) pln: Callao no cruzaba — planilla guarda 'PROVINCIA CONSTITUCIONAL DEL
--      CALLAO' pero region_centroide usa 'CALLAO'. Fix: normalizar la región.
--
-- Solo recrea la vista materializada (read model). No toca tablas crudas.
-- Refrescar tras cada ingesta:  REFRESH MATERIALIZED VIEW CONCURRENTLY performance_regional;
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS performance_regional;

CREATE MATERIALIZED VIEW performance_regional AS
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
    WHERE LOWER(estado) = 'activo' AND region IS NOT NULL   -- FIX (1): case-insensitive
    GROUP BY region
),
pln AS (
    SELECT
        -- FIX (2): normaliza el nombre largo de Callao al del centroide
        CASE WHEN region = 'PROVINCIA CONSTITUCIONAL DEL CALLAO' THEN 'CALLAO'
             ELSE region END                AS region,
        SUM(n_trabajadores)                 AS n_empleados,
        ROUND(AVG(promedio_sueldo), 0)      AS sueldo_promedio
    FROM planilla
    WHERE ano = (SELECT MAX(ano) FROM planilla)
      AND region IS NOT NULL
    GROUP BY 1
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
LEFT JOIN obr  o ON o.region = rc.region;

CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_regional_region
    ON performance_regional (region);

CREATE INDEX IF NOT EXISTS idx_perf_ejecucion
    ON performance_regional (pct_ejecucion);
