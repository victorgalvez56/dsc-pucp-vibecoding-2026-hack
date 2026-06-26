# Arquitectura — Transparentape v2

> Mapa abierto de obras públicas del Estado peruano con detección automática de
> irregularidades. Cruza datos abiertos fragmentados (OCDS, OECE, INFOBRAS) y los
> pone sobre un mapa que cualquier ciudadano entiende, marcando automáticamente
> las obras con señales de riesgo.

## 1. Vista de módulos

```mermaid
flowchart LR
    subgraph Fuentes["Fuentes abiertas del Estado"]
        OCDS["OCDS\nOpen Contracting\n(contratos, RUC, montos)"]
        OECE["OECE\ndatosabiertos.gob.pe\n(sanciones / inhabilitaciones)"]
        INFOBRAS["INFOBRAS\nContraloría\n(avance físico, fotos, coords)"]
    end

    subgraph ETL["ETL (Python)"]
        DL["download_ocds"]
        FILTER["filter_lima"]
        LOAD["load_supabase"]
        FLAGS["load_red_flags"]
        GEO["geocode"]
        SCRAPE["infobras_scrape"]
        XREF["infobras_crossref"]
        SCORE["compute_red_flag_scores()"]
    end

    subgraph DB["PostgreSQL (Supabase)"]
        T_OBRAS[("obras")]
        T_FLAGS[("red_flags")]
        T_INFO[("infobras_full")]
        V_RIESGO[["VIEW obras_riesgo"]]
    end

    subgraph Web["App web (Next.js 16 / React 19)"]
        API["API routes\n/api/obras, /api/forensics, /api/stats"]
        GLOBE["Globo 3D + mapa\n(three.js / MapLibre)"]
        FORENSE["Panel forense\n(score + razones + timeline)"]
        STREET["Street View antes/después"]
    end

    OCDS --> DL --> FILTER --> LOAD --> T_OBRAS
    OECE --> FLAGS --> T_FLAGS
    INFOBRAS --> SCRAPE --> T_INFO
    T_OBRAS --> GEO --> T_OBRAS
    T_INFO --> XREF --> T_OBRAS
    T_FLAGS --> SCORE
    T_INFO --> SCORE
    T_OBRAS --> SCORE --> T_OBRAS
    T_OBRAS --> V_RIESGO

    DB --> API --> GLOBE
    API --> FORENSE
    API --> STREET
```

## 2. Flujo de datos (ingesta → riesgo → ciudadano)

```mermaid
sequenceDiagram
    participant C as CronJob / run_pipeline.py
    participant S as Fuentes (OCDS/OECE/INFOBRAS)
    participant DB as Postgres (Supabase)
    participant API as Next.js API
    participant U as Ciudadano

    C->>S: descarga / scrape periódico
    C->>DB: UPSERT obras, red_flags, infobras_full
    C->>DB: SELECT compute_red_flag_scores()
    Note over DB: cruce RUC↔sanciones,<br/>sobrecosto, paralización,<br/>adjudicación directa → score [0-100]
    U->>API: abre el mapa / filtra por riesgo
    API->>DB: SELECT * FROM obras_riesgo
    DB-->>API: obras + red_flag_score + reasons
    API-->>U: globo 3D + panel forense explicable
```

## 3. Modelo de datos (núcleo)

```mermaid
erDiagram
    obras ||--o{ red_flags : "supplier_ruc = ruc"
    obras ||--o| infobras_full : "infobras_code = codigo_infobras"

    obras {
        text ocid PK
        text country
        text buyer_name
        text supplier_name
        text supplier_ruc
        numeric award_amount
        numeric contract_amount
        text procurement_method
        numeric lat
        numeric lng
        text infobras_code
        boolean is_red_flag
        int red_flag_score
        jsonb red_flag_reasons
    }
    red_flags {
        text ruc
        text tipo
        text descripcion
        boolean vigente
    }
    infobras_full {
        int codigo_infobras PK
        numeric avance_fisico_pct
        text estado
        int n_modificaciones_plazo
        numeric monto_aprobacion
    }
```

## 4. Detección de irregularidades (scoring)

El corazón del proyecto. `compute_red_flag_scores()` (ver
[`supabase/migrations/06_red_flag_score.sql`](../supabase/migrations/06_red_flag_score.sql))
calcula un score ponderado y **explicable** por obra:

| Señal | Peso | Fuente |
|---|---|---|
| Contratista sancionado (RUC en OECE) | 35 | OECE |
| Inhabilitación judicial vigente | +15 | OECE |
| Sobrecosto (contrato > adjudicado +15%) | 25 | OCDS |
| Obra paralizada (avance bajo + estado) | 20 | INFOBRAS |
| Obra vencida (fin programado pasó, avance < 100%) | 15 | INFOBRAS |
| Adjudicación directa (sin competencia) | 10 | OCDS |
| ≥3 modificaciones de plazo | 10 | INFOBRAS |
| Contratista recurrente (≥10 adjudicaciones) | 10 | OCDS |

> Cada obra guarda `red_flag_reasons` (JSONB) con el desglose, para mostrarle al
> ciudadano **por qué** está marcada — no es una caja negra.

## 5. Despliegue

```mermaid
flowchart LR
    GH["GitHub repo"] --> VERCEL["Vercel\n(Next.js + API routes)"]
    SUPA["Supabase\n(Postgres gestionado)"] --> VERCEL
    CRON["Vercel Cron"] --> ETL["run_pipeline.py / re-ingesta"]
    ETL --> SUPA
    VERCEL --> USER["Ciudadano (navegador)"]
```
