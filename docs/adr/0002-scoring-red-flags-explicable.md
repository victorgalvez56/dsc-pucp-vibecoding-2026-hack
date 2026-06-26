# ADR 0002 — Scoring de red flags ponderado y explicable (en la base de datos)

- **Estado:** Aceptado
- **Fecha:** 2026-06-26

## Contexto

La v1 marcaba una obra como sospechosa con un booleano `is_red_flag`: verdadero
si el RUC del contratista aparecía en alguna sanción OECE. Es una señal binaria y
de una sola fuente; no distingue una obra con un sobrecosto del 200% y contratista
inhabilitado de otra apenas marcada por una penalidad menor.

## Decisión

Calcular un **score de severidad [0-100]** que combina varias señales de riesgo
con pesos, en una función SQL (`compute_red_flag_scores()`), y guardar el desglose
en `red_flag_reasons` (JSONB) para que sea **explicable** al ciudadano.

Señales: contratista sancionado, inhabilitación judicial vigente, sobrecosto
(contrato vs adjudicado), obra paralizada, obra vencida, adjudicación directa,
modificaciones de plazo, contratista recurrente. (Pesos en la migración 06.)

## Consecuencias

- **+** El ranking forense del front ordena por riesgo real, no por un booleano.
- **+** Transparencia: cada marca viene con su "por qué" — clave para credibilidad
  y para el pitch (caso de negocio anticorrupción).
- **+** La lógica vive en la base (una función idempotente que se corre tras cada
  ingesta), no dispersa en el front; fácil de auditar y ajustar pesos.
- **−** Los pesos son heurísticos, no calibrados con datos etiquetados. Se
  documentan como configurables y se aclara en el pitch que son señales, no
  acusaciones.
