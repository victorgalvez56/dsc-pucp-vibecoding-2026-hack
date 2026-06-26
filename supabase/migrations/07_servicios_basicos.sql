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
