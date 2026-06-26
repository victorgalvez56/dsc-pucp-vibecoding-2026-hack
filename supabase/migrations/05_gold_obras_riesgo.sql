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
