# Vigía

> El Estado peruano gestiona más de S/ 220 mil millones al año.
> **Vigía** integra cuatro fuentes de datos abiertos del Estado en un único mapa
> interactivo y responde una pregunta que hoy no tiene respuesta accesible:
> **¿cómo está funcionando el Estado en tu región?**

Hackathon **DSC PUCP · Vibecoding 2026** — Reto: *sistema / datos del Estado peruano (scraping)*.

---

## Cuatro capas, una plataforma

| Capa | Fuente | Pregunta |
|---|---|---|
| 💰 **Presupuesto** | MEF Consulta Amigable | ¿Qué regiones y ministerios no ejecutan su asignación? |
| 🏥 **Servicios** | MINSA (RENIPRESS) + MINEDU | ¿Qué distritos carecen de postas, escuelas y hospitales? |
| 👥 **Planilla** | SERVIR / datos abiertos | ¿Dónde se concentra el empleo público? ¿Qué regímenes dominan? |
| 🏗️ **Obras** | OCDS + INFOBRAS + OECE | ¿Qué obras tienen señales de riesgo? (score explicable 0–100) |

El usuario no es solo el auditor que busca fraude — es el ciudadano, la ONG,
el periodista y el planificador regional que necesitan entender **el desempeño
del Estado** en su totalidad.

---

## Arquitectura

**Lakehouse Medallion + Postgres analítico** (por capas).
Ingesta desacoplada del serving, lógica centralizada en la base de datos,
API delgada y frontera server/client clara en el front.

```
Bronze (crudo) → Silver (normalizado) → Gold (cruzado + agregado) → API → Mapa 4 capas
```

- 🏛️ **Arquitectura detallada:** [`docs/architecture.md`](docs/architecture.md)
- 📑 **ADRs:** [`docs/adr/`](docs/adr/)
- 📋 **Bases de la hackathon:** [`docs/bases.md`](docs/bases.md)

---

## Estructura del repositorio

```
.
├── docs/
│   ├── architecture.md              # diagramas y estilo arquitectónico
│   ├── bases.md                     # bases de la hackathon
│   └── adr/                         # decisiones de arquitectura
│       ├── 0001-medallion-postgres-analitico.md
│       ├── 0002-ports-adapters-solo-ingesta.md
│       └── 0003-vigia-cuatro-capas.md
├── etl/                             # Bronze — 1 adapter por fuente del Estado
│   └── adapters/
│       ├── ocds_contratos.py        # contratación pública (OCDS)
│       ├── oece_sanciones.py        # sanciones e inhabilitaciones
│       ├── infobras_avance.py       # avance físico de obra (Contraloría)
│       ├── mef_presupuesto.py       # ejecución presupuestal (MEF)
│       ├── minedu_escuelas.py       # padrón de IIEE (MINEDU)
│       └── minsa_establecimientos.py # establecimientos de salud (RENIPRESS)
├── supabase/
│   └── migrations/                  # esquema Silver + Gold + scoring
│       ├── 01_obras.sql
│       ├── 02_sanciones.sql
│       ├── 03_avance_obra.sql
│       ├── 04_red_flag_scoring.sql
│       ├── 05_gold_obras_riesgo.sql
│       ├── 06_presupuesto.sql
│       ├── 07_servicios_basicos.sql
│       ├── 08_planilla.sql
│       └── 09_gold_performance_regional.sql
└── web/                             # Next.js — API route handlers + mapa interactivo
    ├── app/
    │   ├── api/
    │   │   ├── obras/               # GET obras con red_flag_score > 0
    │   │   ├── obra/[id]/           # GET detalle de una obra
    │   │   ├── stats/               # GET KPIs globales
    │   │   ├── performance/         # GET performance_regional (4 capas)
    │   │   └── servicios/           # GET servicios_basicos (mapa)
    │   └── components/
    │       ├── MapClient.tsx        # mapa multi-capa (MapLibre GL)
    │       └── ForensicPanel.tsx    # panel forense de obras en riesgo
    └── lib/
        ├── db.ts                    # pool pg singleton
        └── types.ts                 # interfaces TypeScript del contrato de datos

```

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Ingesta (Bronze) | Python · requests · BeautifulSoup · pandas · psycopg2 |
| Base de datos | PostgreSQL (Supabase) · pg_trgm · vistas materializadas |
| API | Next.js 14 Route Handlers · pg (SQL directo, sin ORM) |
| Frontend | Next.js App Router · React 18 · MapLibre GL · Tailwind CSS |
| Despliegue | Vercel + Supabase |

## Integrantes y roles

| Rol | Responsabilidad |
|---|---|
| **datos-etl** | Adapters Bronze → tablas Silver (6 fuentes del Estado) |
| **backend-db** | Esquema Silver/Gold, función de scoring SQL, API, despliegue Vercel |
| **frontend-pitch** | Mapa multi-capa, paneles forenses, KPIs, pitch y caso de negocio |

## Correr localmente

```bash
# 1. Variables de entorno
cp web/.env.local.example web/.env.local
# Editar web/.env.local con DATABASE_URL (Supabase pooler puerto 6543)

# 2. Aplicar migraciones en Supabase SQL Editor (en orden: 01 → 09)

# 3. Poblar datos (ETL)
cd etl && pip install -r requirements.txt
python -m adapters.mef_presupuesto
python -m adapters.minedu_escuelas
python -m adapters.minsa_establecimientos
# ... resto de adapters

# 4. Calcular scores y refrescar vistas Gold
# En Supabase SQL Editor:
#   SELECT compute_red_flag_scores();
#   REFRESH MATERIALIZED VIEW obras_riesgo;
#   REFRESH MATERIALIZED VIEW performance_regional;

# 5. Web
cd web && npm install && npm run dev
```
