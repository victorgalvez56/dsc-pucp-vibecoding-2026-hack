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
