# ADR 0002 — Ports & Adapters solo en la ingesta (no "hexagonal full")

- **Estado:** Aceptado
- **Fecha:** 2026-06-26

## Contexto

Se evaluó aplicar arquitectura hexagonal (ports & adapters) a todo el sistema.
El jurado preguntará "¿por qué esa arquitectura?", así que la respuesta debe ser
honesta y sostenible bajo escrutinio.

## Decisión

Aplicar ports & adapters **solo en la capa de ingesta**, y **no** etiquetar la
aplicación entera como hexagonal.

- **Ingesta = ports & adapters honesto:** cada fuente del Estado (contratación,
  sanciones, avance de obra) es un *adapter* que traduce un formato externo sucio
  a un modelo canónico (el "port" de entrada). Esto mapea 1:1 con Bronze→Silver.
- **App = capas, no hexagonal:** la lógica de dominio fuerte (scoring, cruce por
  RUC) vive a propósito en Postgres por auditabilidad y rendimiento; eso es lo
  *opuesto* al principio hexagonal de "dominio independiente de la infraestructura".
  La web es una capa de lectura delgada sobre SQL — envolverla en puertos/use-cases/
  DTOs sería ceremonia sobre `SELECT`s, sin comportamiento real que proteger.

## Consecuencias

- **+** Honestidad técnica defendible: si preguntan "muéstrame un puerto que
  intercambies", existe uno real (los adapters de fuente), y no se vende
  "hexagonal" donde no lo es.
- **+** Agregar una fuente nueva del Estado = escribir un adapter, sin tocar el
  resto del sistema.
- **−** No hay aislamiento formal de dominio en la app; aceptado porque la lógica
  está deliberadamente en la base.
