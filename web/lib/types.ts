export interface RedFlagReason {
  code: string;
  weight: number;
}

export interface ObraRiesgo {
  id_contrato: string;
  entidad: string | null;
  entidad_ruc: string | null;
  region: string | null;
  objeto: string | null;
  metodo_adjudicacion: string | null;
  contratista: string | null;
  ruc_contratista: string | null;
  monto_adjudicado: number | null;
  monto_contrato: number | null;
  moneda: string | null;
  fecha_adjudicacion: string | null;   // ISO date string
  codigo_obra: string | null;
  lat: number | null;
  lng: number | null;
  red_flag_score: number;
  red_flag_reasons: RedFlagReason[];
  // de avance_obra (nullable — no toda obra tiene INFOBRAS)
  avance_fisico_pct: number | null;
  estado_obra: string | null;
  n_modificaciones_plazo: number | null;
  fecha_fin_programada: string | null; // ISO date string
  fecha_fin_real: string | null;       // ISO date string
}

export interface StatsResponse {
  total_obras: number;
  total_obras_riesgo: number;
  monto_total_riesgo: number;
  por_region: RegionStat[];
  top_contratistas: ContratistaStat[];
}

export interface RegionStat {
  region: string;
  n_obras: number;
  avg_score: number;
}

export interface ContratistaStat {
  contratista: string;
  ruc: string;
  n_obras: number;
  score_max: number;
}
