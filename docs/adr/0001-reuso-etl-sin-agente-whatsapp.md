# ADR 0001 — Reusar ETL + esquema, empezar limpio, sin agente de WhatsApp

- **Estado:** Aceptado
- **Fecha:** 2026-06-26

## Contexto

Partimos de una solución previa ([transparentape](https://github.com/victorgalvez56/transparentape),
hack@latam 2026) que ya resolvía la parte más difícil del reto "scrapear datos del
Estado peruano": un ETL en Python que descarga/scrapea **OCDS**, **OECE** e
**INFOBRAS** y los carga en Postgres. Esa solución incluía además un agente
conversacional de WhatsApp (Kapso + Groq) con una superficie de código grande
(`lib/agent-kapso`, webhooks, tablas `agent_sessions`).

Para esta hackathon (cierre 19:00, dos hitos) tenemos 3 personas y poco tiempo.

## Decisión

1. **Reusar** el ETL y el esquema de datos núcleo (`obras`, `red_flags`,
   `infobras_full`) tal cual — es el activo más caro de reconstruir.
2. **Empezar limpio**: repo nuevo, UI rehecha, sin arrastrar deuda.
3. **Eliminar el agente de WhatsApp** y todo su footprint (dependencia
   `@kapso/whatsapp-cloud-api`, tablas `agent_sessions*`, webhooks). La consulta
   en lenguaje natural, si se hace, será un chat embebido en la web (decisión
   diferida — ver ADR futuro).

## Consecuencias

- **+** Arrancamos con datos reales el día 1; el equipo se enfoca en UX y en la
  mejora de detección de irregularidades, no en plomería de ingesta.
- **+** Menor superficie = menos secretos que gestionar (sin Kapso/WhatsApp) y
  despliegue más simple en Vercel.
- **−** Perdemos el canal de WhatsApp como gancho de demo. Se compensa con mejor
  storytelling en la web (cold open) y consulta NL embebida si da tiempo.
- Migraciones renumeradas 01–06; las `agent_*` de la v1 quedan fuera.
