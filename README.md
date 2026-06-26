# Vigía

> En un mar de datos públicos opacos, **Vigía** otea desde lo alto y avista los
> arrecifes ocultos —las irregularidades en la contratación del Estado— antes de
> que el ciudadano naufrague en la burocracia.

Plataforma que scrapea, cruza y vuelve legibles los datos abiertos del Estado
peruano sobre contratación y obras públicas, marcando automáticamente las obras
con señales de riesgo.

Hackathon **DSC PUCP · Vibecoding 2026** — Reto: *sistema / datos del Estado peruano (scraping)*.

## Arquitectura

**Lakehouse Medallion + Postgres analítico** (por capas). Ingesta desacoplada del
serving, lógica de riesgo auditable en la base, API delgada y front con frontera
server/client clara.

```
Bronze (crudo) → Silver (normalizado) → Gold (cruzado + scoreado) → API → Mapa + forense
```

Detalle, diagramas y decisiones:

- 🏛️ **Arquitectura:** [`docs/architecture.md`](docs/architecture.md)
- 📑 **ADRs:** [`docs/adr/`](docs/adr/)
- 📋 **Bases de la hackathon:** [`docs/bases.md`](docs/bases.md)

## Estructura del repositorio

```
.
├── docs/
│   ├── architecture.md      # diagramas y estilo arquitectónico
│   ├── bases.md             # bases de la hackathon
│   └── adr/                 # decisiones de arquitectura
├── etl/                     # Bronze — adapters de ingesta (1 por fuente del Estado)
├── supabase/
│   └── migrations/          # esquema Silver/Gold + función de scoring
└── web/                     # Next.js — API (route handlers + SQL) y presentación
```

## Estado

🚧 Esqueleto inicial: estructura de carpetas y arquitectura definidas. La
implementación de cada capa se irá llenando sobre esta base.
