"""
Adapter Bronze — MEF Consulta Amigable
Fuente: https://datosabiertos.mineco.gob.pe/
Descarga el dataset de ejecución presupuestal del año en curso y lo
inserta (o actualiza) en la tabla `presupuesto` (Silver).

Correr: python -m etl.adapters.mef_presupuesto
"""

from __future__ import annotations

import io
import logging
import os
from datetime import date

import pandas as pd
import psycopg2
import requests
from psycopg2.extras import execute_values

log = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Configuración
# ──────────────────────────────────────────────────────────────────────────────

ANO = date.today().year

# Dataset de Ejecución del Gasto por Pliego — datos.gob.pe
# Actualizado mensualmente por el MEF
MEF_DATASET_URL = (
    "https://datosabiertos.mineco.gob.pe/datastore/dump/"
    "ejecucion-del-gasto-{ano}"
).format(ano=ANO)

# Alternativa: Consulta Amigable (endpoint no oficial, devuelve JSON)
MEF_CONSULTA_URL = (
    "https://apps5.mineco.gob.pe/transparencia/Navegador/"
    "aspx_GeneradorReportes/gen_xls.aspx"
)

UPSERT_SQL = """
INSERT INTO presupuesto
    (ano, nivel_gobierno, sector, pliego, pliego_codigo, entidad,
     entidad_codigo, region, funcion, programa, tipo_gasto,
     pim, devengado, pct_ejecucion)
VALUES %s
ON CONFLICT DO NOTHING
"""

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _pct(devengado: float, pim: float) -> float:
    if pim and pim > 0:
        return round(devengado / pim * 100, 1)
    return 0.0


def _normalizar_region(raw: str | None) -> str | None:
    """Normaliza el nombre de región al formato usado en region_centroide."""
    if not raw:
        return None
    return raw.strip().upper()


# ──────────────────────────────────────────────────────────────────────────────
# Scraping / descarga
# ──────────────────────────────────────────────────────────────────────────────

def fetch_presupuesto() -> pd.DataFrame:
    """
    Descarga el CSV de ejecución presupuestal del MEF.
    Columnas esperadas (datos abiertos MEF):
        ANO_EJE, NIVEL_GOBIERNO, SECTOR, PLIEGO, COD_PLIEGO, EJECUTORA,
        COD_EJECUTORA, DEPARTAMENTO, FUNCION, PROGRAMA_PPTO, TIPO_GASTO,
        PIM, DEVENGADO
    """
    log.info("Descargando dataset MEF %d …", ANO)
    try:
        resp = requests.get(MEF_DATASET_URL, timeout=60)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), sep=";", encoding="latin-1",
                         low_memory=False)
    except Exception as exc:
        log.warning("Fallo descarga directa: %s — intentando fallback", exc)
        # Fallback: leer archivo local si fue descargado manualmente
        local = f"etl/data/bronze/mef_presupuesto_{ANO}.csv"
        if os.path.exists(local):
            df = pd.read_csv(local, sep=";", encoding="latin-1", low_memory=False)
        else:
            raise RuntimeError(
                f"No se pudo obtener datos del MEF. "
                f"Descarga manualmente desde datosabiertos.mineco.gob.pe "
                f"y guarda en {local}"
            ) from exc

    log.info("Filas descargadas: %d", len(df))
    return df


def transform(df: pd.DataFrame) -> list[tuple]:
    """Normaliza columnas y calcula pct_ejecucion."""
    # Mapeo flexible de columnas (el MEF cambia nombres entre años)
    col_map = {
        "ANO_EJE":        "ano",
        "NIVEL_GOBIERNO": "nivel_gobierno",
        "SECTOR":         "sector",
        "PLIEGO":         "pliego",
        "COD_PLIEGO":     "pliego_codigo",
        "EJECUTORA":      "entidad",
        "COD_EJECUTORA":  "entidad_codigo",
        "DEPARTAMENTO":   "region",
        "FUNCION":        "funcion",
        "PROGRAMA_PPTO":  "programa",
        "TIPO_GASTO":     "tipo_gasto",
        "PIM":            "pim",
        "DEVENGADO":      "devengado",
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    # Limpiar montos
    for col in ("pim", "devengado"):
        if col in df.columns:
            df[col] = (
                df[col].astype(str)
                .str.replace(",", ".", regex=False)
                .str.replace(" ", "", regex=False)
            )
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df["region"] = df.get("region", pd.Series()).apply(_normalizar_region)
    df["pct_ejecucion"] = df.apply(
        lambda r: _pct(r.get("devengado", 0), r.get("pim", 0)), axis=1
    )
    df["ano"] = df.get("ano", ANO)

    cols = [
        "ano", "nivel_gobierno", "sector", "pliego", "pliego_codigo",
        "entidad", "entidad_codigo", "region", "funcion", "programa",
        "tipo_gasto", "pim", "devengado", "pct_ejecucion",
    ]
    # Asegurar que todas las columnas existan
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
        log.info("Insertadas %d filas en presupuesto.", len(rows))
    finally:
        conn.close()


# ──────────────────────────────────────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────────────────────────────────────

def run() -> None:
    logging.basicConfig(level=logging.INFO)
    df   = fetch_presupuesto()
    rows = transform(df)
    load(rows)


if __name__ == "__main__":
    run()
