# ADR 0001 — Medallion + Postgres analítico como estilo arquitectónico

- **Estado:** Aceptado
- **Fecha:** 2026-06-26

## Contexto

El reto exige scrapear datos del Estado peruano. Las fuentes son heterogéneas y
sucias (contratación en JSON masivo, sanciones en CSV, avance de obra en HTML),
se actualizan en lotes (diaria/semanalmente, no en tiempo real), y hay que
cruzarlas por entidad (mismo RUC/razón social escrito distinto en cada fuente)
para detectar irregularidades. Equipo de 3 personas, un día, despliegue obligatorio.

## Decisión

Adoptar una arquitectura **Lakehouse Medallion** (Bronze → Silver → Gold) sobre
**PostgreSQL como motor analítico**:

- **Bronze:** scrape crudo, tal cual, idempotente y re-ejecutable por cron.
- **Silver:** normalización a un esquema canónico.
- **Gold:** *entity resolution* (`pg_trgm`), **scoring de riesgo como función SQL**
  y una **vista materializada** servible.

La lógica de negocio (el scoring) vive en la base, no en la app. El acceso a datos
desde la web es **`pg` + SQL directo**, no un cliente BaaS.

## Alternativas descartadas

- **API desacoplada (FastAPI):** duplica despliegue y superficie; sube el riesgo
  del despliegue obligatorio sin beneficio visible.
- **Streaming (Kafka/colas):** el dato público no llega por segundo; batch + cron
  es lo honesto. Sería sobre-ingeniería.
- **Supabase BaaS (PostgREST/RLS sin capa propia):** rápido, pero deja poca
  historia de ingeniería propia y menos control para queries forenses pesadas.

## Consecuencias

- **+** Capas desacopladas: un re-scrape roto no afecta lo que ve el ciudadano.
- **+** Lógica auditable y reproducible (cada marca trae su `red_flag_reasons`).
- **+** Un solo despliegue (Next.js en Vercel + Postgres gestionado).
- **−** La lógica en SQL exige disciplina de migraciones; se versiona en
  `supabase/migrations/`.
