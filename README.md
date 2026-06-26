# Transparentape

> **El billete deja huella. Lo grabamos.**
> Mapa abierto de obras públicas del Estado peruano que cruza datos abiertos
> fragmentados (OCDS · OECE · INFOBRAS) y marca automáticamente las obras con
> señales de riesgo de corrupción.

Hackathon **DSC PUCP · Vibecoding 2026** — Reto: *sistema / datos del Estado peruano (scraping)*.

---

## Problemática y usuario

En el Perú la plata pública existe en datos abiertos, pero está **fragmentada, en
formatos crudos y sin cruzar**. Un ciudadano no puede saber en segundos *a quién
se le pagó, cuánto, si la obra existe y si el contratista tiene sanciones*. La
corrupción se esconde en la fricción de buscar.

**Transparentape** scrapea y cruza esas fuentes y las pone sobre un mapa que
cualquiera entiende: cada punto es un contrato real con monto, entidad,
contratista y RUC, y un **score de riesgo explicable**.

- **Usuario principal:** ciudadanía, periodistas de datos y veedurías.
- **Usuario secundario:** funcionarios de control / transparencia.

## Stack tecnológico

- **Frontend:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · GSAP
- **3D / Mapas:** three.js · react-three-fiber · MapLibre GL · cobe
- **Backend:** Next.js API routes · PostgreSQL (Supabase) · `pg`
- **ETL / Scraping:** Python · psycopg · ijson · requests · BeautifulSoup
- **Infra:** Vercel · Vercel Cron Jobs

## Modelos y herramientas de IA

- **Anthropic Claude** (`@anthropic-ai/sdk`) — síntesis y descripción de obras.
- **Groq (Llama 3.x)** — consultas en lenguaje natural sobre la data *(opcional, fase 2)*.
- **Claude Code** — desarrollo asistido durante la hackathon.

## Fuentes de datos (scraping del Estado)

| Fuente | Qué aporta |
|---|---|
| **OCDS** — Open Contracting (Perú 2019–2026) | Contratos: entidad, monto, contratista, RUC |
| **OECE** — datosabiertos.gob.pe | Sancionados, penalidades e inhabilitaciones judiciales |
| **INFOBRAS** — Contraloría | Avance físico real, fotos, coordenadas, ejecución mensual |

## Correr el proyecto localmente

```bash
git clone <este-repo>
cd dsc-pucp-vibecoding-2026-hack

# 1) Base de datos (Supabase / Postgres): aplicar migraciones en orden
#    supabase/migrations/01..06  (psql, Supabase SQL editor o supabase db push)

# 2) ETL — poblar la base (opcional; necesita DATABASE_URL)
cd etl
pip install -r requirements.txt
cp .env.example .env            # completar DATABASE_URL de Supabase
python run_pipeline.py          # descarga OCDS + carga + red flags + geocode
python 09_infobras_scrape.py    # scrape INFOBRAS
python 10_infobras_crossref.py  # cruce OCDS ↔ INFOBRAS

# 3) Frontend
cd ../web
cp .env.local.example .env.local  # SUPABASE / GOOGLE_MAPS / (ANTHROPIC opcional)
npm install
npm run dev                       # http://localhost:3000
```

Tras cada ingesta, recalcular el score de riesgo:

```sql
SELECT compute_red_flag_scores();
```

## Documentación adicional

- 🏛️ **Arquitectura y diagramas:** [`docs/architecture.md`](docs/architecture.md)
- 📑 **Decisiones (ADRs):** [`docs/adr/`](docs/adr/)
- 🗃️ **Esquema y migraciones:** [`supabase/migrations/`](supabase/migrations/)
- 🚩 **Scoring de red flags:** [`supabase/migrations/06_red_flag_score.sql`](supabase/migrations/06_red_flag_score.sql)
- 📋 **Bases de la hackathon:** [`docs/bases.md`](docs/bases.md)

## Equipo

| Integrante | Rol |
|---|---|
| **Victor Galvez** — [@victorgalvez56](https://github.com/victorgalvez56) | Producto · Frontend · Arquitectura |
| _(completar)_ | Backend · ETL · Datos |
| _(completar)_ | Frontend · Integración · UX |

---

_Proyecto open source. Datos públicos bajo sus respectivas licencias de datos abiertos (OCDS / OECE / INFOBRAS)._
