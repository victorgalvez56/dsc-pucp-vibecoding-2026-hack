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
