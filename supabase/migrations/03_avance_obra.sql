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
