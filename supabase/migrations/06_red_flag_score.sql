-- =============================================================================
-- Red-flag SCORING (v2)
-- -----------------------------------------------------------------------------
-- La v1 marcaba is_red_flag como booleano (RUC del contratista aparece en una
-- sanción OECE). La v2 calcula un SCORE de severidad ponderado [0-100] cruzando
-- varias señales de riesgo, y guarda el desglose en red_flag_reasons (JSONB)
-- para poder explicarle al ciudadano *por qué* una obra está marcada.
--
-- Señales y pesos (configurables abajo):
--   contratista_sancionado     35  -- RUC en red_flags (sanción / inhabilitación)
--   inhabilitacion_judicial    +15 -- extra si la sanción es judicial y vigente
--   sobrecosto                 25  -- contract_amount supera award/tender > umbral
--   obra_paralizada            20  -- INFOBRAS: avance bajo + estado paralizado
--   obra_vencida               15  -- fin programado pasó y avance < 100%
--   adjudicacion_directa       10  -- método sin competencia
--   modificaciones_plazo       10  -- muchas ampliaciones de plazo (INFOBRAS)
--   contratista_recurrente     10  -- mismo RUC con muchas adjudicaciones
-- El score se trunca a 100.
-- =============================================================================

ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS red_flag_score   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS red_flag_reasons JSONB   NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_obras_red_flag_score ON obras(red_flag_score DESC);

-- -----------------------------------------------------------------------------
-- Función: recalcula score + reasons para todas las obras (idempotente).
-- Correr tras cada ingesta:  SELECT compute_red_flag_scores();
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION compute_red_flag_scores()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  -- Umbral de sobrecosto: el contrato supera lo adjudicado en > 15%
  COST_OVERRUN_RATIO   CONSTANT NUMERIC := 1.15;
  -- Avance que se considera "bajo" para una obra reportada como paralizada
  STALLED_PROGRESS_MAX CONSTANT NUMERIC := 80;
  -- Nº de adjudicaciones para considerar a un RUC "recurrente"
  RECURRENT_AWARDS      CONSTANT INTEGER := 10;
BEGIN
  -- RUCs con muchas adjudicaciones (proxy de captura/concentración)
  CREATE TEMP TABLE _recurrent ON COMMIT DROP AS
    SELECT supplier_ruc
    FROM obras
    WHERE supplier_ruc IS NOT NULL AND supplier_ruc <> ''
    GROUP BY supplier_ruc
    HAVING COUNT(*) >= RECURRENT_AWARDS;

  UPDATE obras o
  SET
    red_flag_reasons = sub.reasons,
    red_flag_score   = LEAST(100, sub.score),
    is_red_flag      = sub.score > 0
  FROM (
    SELECT
      o2.id,
      -- score total
      (
        CASE WHEN rf.ruc IS NOT NULL THEN 35 ELSE 0 END
      + CASE WHEN rf.judicial_vigente THEN 15 ELSE 0 END
      + CASE WHEN o2.contract_amount > o2.award_amount * 1.15
                  AND o2.award_amount > 0 THEN 25 ELSE 0 END
      + CASE WHEN inf.paralizada THEN 20 ELSE 0 END
      + CASE WHEN inf.vencida    THEN 15 ELSE 0 END
      + CASE WHEN o2.procurement_method ILIKE '%directa%' THEN 10 ELSE 0 END
      + CASE WHEN COALESCE(inf.n_modificaciones_plazo,0) >= 3 THEN 10 ELSE 0 END
      + CASE WHEN rec.supplier_ruc IS NOT NULL THEN 10 ELSE 0 END
      ) AS score,
      -- desglose explicable
      (
        SELECT COALESCE(jsonb_agg(r), '[]')
        FROM (
          SELECT 'contratista_sancionado' AS code, 35 AS w WHERE rf.ruc IS NOT NULL
          UNION ALL SELECT 'inhabilitacion_judicial', 15 WHERE rf.judicial_vigente
          UNION ALL SELECT 'sobrecosto', 25
            WHERE o2.contract_amount > o2.award_amount * 1.15 AND o2.award_amount > 0
          UNION ALL SELECT 'obra_paralizada', 20 WHERE inf.paralizada
          UNION ALL SELECT 'obra_vencida', 15 WHERE inf.vencida
          UNION ALL SELECT 'adjudicacion_directa', 10
            WHERE o2.procurement_method ILIKE '%directa%'
          UNION ALL SELECT 'modificaciones_plazo', 10
            WHERE COALESCE(inf.n_modificaciones_plazo,0) >= 3
          UNION ALL SELECT 'contratista_recurrente', 10 WHERE rec.supplier_ruc IS NOT NULL
        ) r
      ) AS reasons
    FROM obras o2
    -- ¿el contratista tiene sanción? ¿es judicial vigente?
    LEFT JOIN LATERAL (
      SELECT
        MIN(rf.ruc) AS ruc,
        bool_or(rf.tipo = 'inhabilitacion_judicial' AND COALESCE(rf.vigente, true)) AS judicial_vigente
      FROM red_flags rf
      WHERE rf.ruc = o2.supplier_ruc AND rf.country = o2.country
    ) rf ON TRUE
    -- señales de INFOBRAS (avance / estado / plazos)
    LEFT JOIN LATERAL (
      SELECT
        (i.estado ILIKE '%paraliz%' OR i.avance_fisico_pct < 80) AND i.estado ILIKE '%paraliz%' AS paralizada,
        (i.fecha_fin_programada IS NOT NULL
          AND i.fecha_fin_real IS NULL
          AND COALESCE(i.avance_fisico_pct,0) < 100
          AND i.fecha_fin_programada::date < CURRENT_DATE) AS vencida,
        i.n_modificaciones_plazo
      FROM infobras_full i
      WHERE i.codigo_infobras::text = o2.infobras_code
      LIMIT 1
    ) inf ON TRUE
    LEFT JOIN _recurrent rec ON rec.supplier_ruc = o2.supplier_ruc
  ) sub
  WHERE o.id = sub.id;
END;
$$;

-- Vista para el ranking forense del front (obras ordenadas por riesgo).
CREATE OR REPLACE VIEW obras_riesgo AS
SELECT
  id, ocid, country, city, buyer_name, buyer_region,
  tender_title, supplier_name, supplier_ruc,
  award_amount, contract_amount, procurement_method,
  lat, lng, infobras_code,
  red_flag_score, red_flag_reasons, red_flag_types
FROM obras
WHERE red_flag_score > 0
ORDER BY red_flag_score DESC;
