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
