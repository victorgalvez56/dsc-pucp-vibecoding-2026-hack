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
