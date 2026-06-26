-- =============================================================================
-- 04 · Gold — motor de reglas: scoring de red flags (explicable)
-- compute_red_flag_scores() calcula un score ponderado [0-100] por obra cruzando
-- sanciones + avance_obra + atributos del contrato, y guarda el desglose en
-- obras.red_flag_reasons (JSONB) para poder explicar *por qué* está marcada.
-- Correr tras cada ingesta:  SELECT compute_red_flag_scores();
--
-- Pesos (ver docs/architecture.md §5):
--   contratista_sancionado  35 | inhabilitacion_judicial +15 | sobrecosto 25
--   obra_paralizada 20 | obra_vencida 15 | adjudicacion_directa 10
--   modificaciones_plazo 10 | contratista_recurrente 10   (score truncado a 100)
-- =============================================================================

CREATE OR REPLACE FUNCTION compute_red_flag_scores()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Contratistas con muchas adjudicaciones (proxy de concentración/captura)
  CREATE TEMP TABLE _recurrente ON COMMIT DROP AS
    SELECT ruc_contratista
    FROM obras
    WHERE ruc_contratista IS NOT NULL AND ruc_contratista <> ''
    GROUP BY ruc_contratista
    HAVING COUNT(*) >= 10;

  UPDATE obras o
  SET red_flag_score   = LEAST(100, sub.score),
      red_flag_reasons = sub.reasons,
      is_red_flag      = sub.score > 0
  FROM (
    SELECT
      o2.id_contrato,
      (
        CASE WHEN s.ruc IS NOT NULL THEN 35 ELSE 0 END
      + CASE WHEN s.judicial_vigente THEN 15 ELSE 0 END
      + CASE WHEN o2.monto_contrato > o2.monto_adjudicado * 1.15
                  AND o2.monto_adjudicado > 0 THEN 25 ELSE 0 END
      + CASE WHEN a.estado ILIKE '%paraliz%' THEN 20 ELSE 0 END
      + CASE WHEN a.fecha_fin_programada IS NOT NULL
                  AND a.fecha_fin_real IS NULL
                  AND COALESCE(a.avance_fisico_pct, 0) < 100
                  AND a.fecha_fin_programada < CURRENT_DATE THEN 15 ELSE 0 END
      + CASE WHEN o2.metodo_adjudicacion ILIKE '%directa%' THEN 10 ELSE 0 END
      + CASE WHEN COALESCE(a.n_modificaciones_plazo, 0) >= 3 THEN 10 ELSE 0 END
      + CASE WHEN r.ruc_contratista IS NOT NULL THEN 10 ELSE 0 END
      ) AS score,
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('code', code, 'weight', w)), '[]')
        FROM (
          SELECT 'contratista_sancionado' AS code, 35 AS w WHERE s.ruc IS NOT NULL
          UNION ALL SELECT 'inhabilitacion_judicial', 15 WHERE s.judicial_vigente
          UNION ALL SELECT 'sobrecosto', 25
            WHERE o2.monto_contrato > o2.monto_adjudicado * 1.15 AND o2.monto_adjudicado > 0
          UNION ALL SELECT 'obra_paralizada', 20 WHERE a.estado ILIKE '%paraliz%'
          UNION ALL SELECT 'obra_vencida', 15
            WHERE a.fecha_fin_programada IS NOT NULL AND a.fecha_fin_real IS NULL
              AND COALESCE(a.avance_fisico_pct, 0) < 100 AND a.fecha_fin_programada < CURRENT_DATE
          UNION ALL SELECT 'adjudicacion_directa', 10 WHERE o2.metodo_adjudicacion ILIKE '%directa%'
          UNION ALL SELECT 'modificaciones_plazo', 10 WHERE COALESCE(a.n_modificaciones_plazo,0) >= 3
          UNION ALL SELECT 'contratista_recurrente', 10 WHERE r.ruc_contratista IS NOT NULL
        ) reasons
      ) AS reasons
    FROM obras o2
    -- ¿el contratista tiene sanción? ¿alguna es judicial vigente?
    LEFT JOIN LATERAL (
      SELECT MIN(sa.ruc) AS ruc,
             bool_or(sa.tipo = 'inhabilitacion_judicial' AND COALESCE(sa.vigente, TRUE)) AS judicial_vigente
      FROM sanciones sa
      WHERE sa.ruc = o2.ruc_contratista
    ) s ON TRUE
    -- señales de avance de obra
    LEFT JOIN avance_obra a ON a.codigo = o2.codigo_obra
    LEFT JOIN _recurrente r ON r.ruc_contratista = o2.ruc_contratista
  ) sub
  WHERE o.id_contrato = sub.id_contrato;
END;
$$;
