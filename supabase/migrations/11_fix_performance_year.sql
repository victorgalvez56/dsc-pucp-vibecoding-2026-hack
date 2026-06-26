-- =============================================================================
-- 11 · FIX — performance_regional usaba el AÑO ACTUAL (CURRENT_DATE = 2026)
-- pero los datos son de 2025 → presupuesto y planilla salían en CERO.
-- Este script reconstruye la vista usando el ÚLTIMO año disponible por tabla.
-- Pegar en el SQL Editor de Supabase y ejecutar. Idempotente.
-- =============================================================================

DROP MATERIALIZED VIEW IF EXISTS performance_regional;

CREATE MATERIALIZED VIEW performance_regional AS
WITH ppto AS (
    SELECT
        region,
        SUM(pim)                                                      AS pim_total,
        SUM(devengado)                                                AS devengado_total,
        ROUND(CASE WHEN SUM(COALESCE(pim, 0)) > 0
                   THEN SUM(COALESCE(devengado, 0)) / SUM(COALESCE(pim, 0)) * 100
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
    rc.region, rc.lat, rc.lng,
    COALESCE(p.pim_total, 0)        AS pim_total,
    COALESCE(p.devengado_total, 0)  AS devengado_total,
    COALESCE(p.pct_ejecucion, 0)    AS pct_ejecucion,
    COALESCE(s.n_escuelas, 0)       AS n_escuelas,
    COALESCE(s.n_postas, 0)         AS n_postas,
    COALESCE(s.n_hospitales, 0)     AS n_hospitales,
    COALESCE(s.n_servicios, 0)      AS n_servicios,
    COALESCE(l.n_empleados, 0)      AS n_empleados,
    COALESCE(l.sueldo_promedio, 0)  AS sueldo_promedio,
    COALESCE(o.n_obras_riesgo, 0)   AS n_obras_riesgo,
    COALESCE(o.score_promedio, 0)   AS score_promedio,
    COALESCE(o.monto_riesgo, 0)     AS monto_riesgo
FROM region_centroide rc
LEFT JOIN ppto p ON p.region = rc.region
LEFT JOIN svc  s ON s.region = rc.region
LEFT JOIN pln  l ON l.region = rc.region
LEFT JOIN obr  o ON o.region = rc.region
WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_perf_regional_region ON performance_regional (region);
CREATE INDEX IF NOT EXISTS idx_perf_ejecucion ON performance_regional (pct_ejecucion);

REFRESH MATERIALIZED VIEW performance_regional;

-- Verificar (deben salir montos > 0 en pim_total y n_empleados):
SELECT region, pct_ejecucion, n_servicios, n_empleados, n_obras_riesgo
FROM performance_regional ORDER BY pim_total DESC LIMIT 10;
