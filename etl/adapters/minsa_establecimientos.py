"""
Adapter Bronze — MINSA: Establecimientos de Salud (RENIPRESS)
Fuente: https://datos.gob.pe/dataset/registros-de-establecimientos-de-salud
Descarga el registro RENIPRESS y lo inserta en `servicios_basicos` (Silver).

Correr: python -m etl.adapters.minsa_establecimientos
"""

from __future__ import annotations

import io
import logging
import os

import pandas as pd
import psycopg2
import requests
from psycopg2.extras import execute_values

log = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Configuración
# ──────────────────────────────────────────────────────────────────────────────

# RENIPRESS — MINSA (actualizado trimestralmente)
RENIPRESS_URL = (
    "https://datos.gob.pe/dataset/registros-de-establecimientos-de-salud/"
    "resource/download/renipress.csv"
)

UPSERT_SQL = """
INSERT INTO servicios_basicos
    (tipo, nombre, codigo, region, provincia, distrito, ubigeo,
     estado, nivel, n_camas, lat, lng, fuente)
VALUES %s
ON CONFLICT DO NOTHING
"""

FUENTE = "minsa"

CATEGORIA_TIPO = {
    "I-1": "posta_salud",
    "I-2": "posta_salud",
    "I-3": "posta_salud",
    "I-4": "posta_salud",
    "II-1": "hospital",
    "II-2": "hospital",
    "III-1": "hospital",
    "III-2": "hospital",
    "III-E": "hospital",
}

# ──────────────────────────────────────────────────────────────────────────────
# Scraping
# ──────────────────────────────────────────────────────────────────────────────

def fetch() -> pd.DataFrame:
    log.info("Descargando RENIPRESS (MINSA) …")
    try:
        resp = requests.get(RENIPRESS_URL, timeout=60)
        resp.raise_for_status()
        return pd.read_csv(io.StringIO(resp.text), encoding="latin-1",
                           low_memory=False)
    except Exception as exc:
        log.warning("Fallo descarga RENIPRESS: %s", exc)
        local = "etl/data/bronze/minsa_renipress.csv"
        if os.path.exists(local):
            return pd.read_csv(local, encoding="latin-1", low_memory=False)
        raise RuntimeError(
            f"Descarga MINSA fallida. Guarda el CSV en {local}"
        ) from exc


def _tipo_establecimiento(categoria: str | None) -> str:
    if not categoria:
        return "posta_salud"
    cat = str(categoria).strip().upper()
    return CATEGORIA_TIPO.get(cat, "posta_salud")


def transform(df: pd.DataFrame) -> list[tuple]:
    """
    Columnas esperadas del RENIPRESS:
        CODIGO, NOMBRE, CATEGORIA, DEPARTAMENTO, PROVINCIA, DISTRITO,
        UBIGEO, ESTADO, N_CAMAS, LATITUD, LONGITUD
    """
    col_map = {
        "CODIGO":       "codigo",
        "NOMBRE":       "nombre",
        "CATEGORIA":    "categoria",
        "DEPARTAMENTO": "region",
        "PROVINCIA":    "provincia",
        "DISTRITO":     "distrito",
        "UBIGEO":       "ubigeo",
        "ESTADO":       "estado",
        "N_CAMAS":      "n_camas",
        "LATITUD":      "lat",
        "LONGITUD":     "lng",
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    df["tipo"]   = df.get("categoria", pd.Series()).apply(_tipo_establecimiento)
    df["nivel"]  = None
    df["fuente"] = FUENTE

    for col in ("lat", "lng"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    if "region" in df.columns:
        df["region"] = df["region"].astype(str).str.strip().str.upper()

    cols = [
        "tipo", "nombre", "codigo", "region", "provincia", "distrito",
        "ubigeo", "estado", "nivel", "n_camas", "lat", "lng", "fuente",
    ]
    for c in cols:
        if c not in df.columns:
            df[c] = None

    return [tuple(row) for row in df[cols].itertuples(index=False)]


# ──────────────────────────────────────────────────────────────────────────────
# Carga
# ──────────────────────────────────────────────────────────────────────────────

def load(rows: list[tuple]) -> None:
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    try:
        with conn.cursor() as cur:
            execute_values(cur, UPSERT_SQL, rows, page_size=500)
        conn.commit()
        log.info("Insertados %d establecimientos en servicios_basicos.", len(rows))
    finally:
        conn.close()


def run() -> None:
    logging.basicConfig(level=logging.INFO)
    df   = fetch()
    rows = transform(df)
    load(rows)


if __name__ == "__main__":
    run()
