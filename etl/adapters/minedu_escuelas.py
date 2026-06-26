"""
Adapter Bronze — MINEDU: Padrón de Instituciones Educativas
Fuente: https://datos.gob.pe/dataset/instituciones-educativas  (ESCALE MINEDU)
Descarga el padrón de IIEE y lo inserta en `servicios_basicos` (Silver).

Correr: python -m etl.adapters.minedu_escuelas
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

# Dataset Padrón IIEE — datos.gob.pe (actualizado anualmente por MINEDU)
MINEDU_URL = (
    "https://datos.gob.pe/dataset/padron-de-instituciones-educativas/"
    "resource/download/padron_iiee.csv"
)

UPSERT_SQL = """
INSERT INTO servicios_basicos
    (tipo, nombre, codigo, region, provincia, distrito, ubigeo,
     estado, nivel, n_alumnos, n_docentes, lat, lng, fuente)
VALUES %s
ON CONFLICT DO NOTHING
"""

TIPO = "escuela"
FUENTE = "minedu"

# ──────────────────────────────────────────────────────────────────────────────
# Scraping
# ──────────────────────────────────────────────────────────────────────────────

def fetch() -> pd.DataFrame:
    log.info("Descargando padrón MINEDU …")
    try:
        resp = requests.get(MINEDU_URL, timeout=60)
        resp.raise_for_status()
        return pd.read_csv(io.StringIO(resp.text), encoding="latin-1",
                           low_memory=False)
    except Exception as exc:
        log.warning("Fallo descarga: %s — intentando fallback local", exc)
        local = "etl/data/bronze/minedu_iiee.csv"
        if os.path.exists(local):
            return pd.read_csv(local, encoding="latin-1", low_memory=False)
        raise RuntimeError(
            f"Descarga MINEDU fallida. Guarda el CSV manualmente en {local}"
        ) from exc


def transform(df: pd.DataFrame) -> list[tuple]:
    """
    Columnas esperadas del padrón MINEDU:
        COD_MOD, DRE, UGEL, CCDD, CCPP, CCDI, CODOOII, COD_NIVEL, NIV_MOD,
        NUM_ALUMNOS, NUM_DOCENTES, LATITUD, LONGITUD, ESTADO, NOMBRE
    """
    col_map = {
        "COD_MOD":      "codigo",
        "NOMBRE":       "nombre",
        "CCDD":         "region",
        "CCPP":         "provincia",
        "CCDI":         "distrito",
        "CODOOII":      "ubigeo",
        "ESTADO":       "estado",
        "NIV_MOD":      "nivel",
        "NUM_ALUMNOS":  "n_alumnos",
        "NUM_DOCENTES": "n_docentes",
        "LATITUD":      "lat",
        "LONGITUD":     "lng",
        # Nombre alternativo usado en algunas versiones del dataset
        "LATIT":        "lat",
        "LONGIT":       "lng",
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    for col in ("lat", "lng"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df["tipo"]   = TIPO
    df["fuente"] = FUENTE

    # Normalizar región a mayúsculas
    if "region" in df.columns:
        df["region"] = df["region"].astype(str).str.strip().str.upper()

    cols = [
        "tipo", "nombre", "codigo", "region", "provincia", "distrito",
        "ubigeo", "estado", "nivel", "n_alumnos", "n_docentes",
        "lat", "lng", "fuente",
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
        log.info("Insertadas %d escuelas en servicios_basicos.", len(rows))
    finally:
        conn.close()


def run() -> None:
    logging.basicConfig(level=logging.INFO)
    df   = fetch()
    rows = transform(df)
    load(rows)


if __name__ == "__main__":
    run()
