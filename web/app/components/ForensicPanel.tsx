'use client';

import type { ObraRiesgo, RedFlagReason } from '@/lib/types';

const FLAG_META: Record<string, { label: string; color: string }> = {
  contratista_sancionado:  { label: 'Contratista sancionado (OECE)',     color: 'text-red-400'    },
  inhabilitacion_judicial: { label: 'Inhabilitación judicial vigente',   color: 'text-red-500'    },
  sobrecosto:              { label: 'Sobrecosto > 15 % sobre adjudicado',color: 'text-orange-400' },
  obra_paralizada:         { label: 'Obra paralizada',                   color: 'text-orange-500' },
  obra_vencida:            { label: 'Obra vencida de plazo',             color: 'text-yellow-400' },
  adjudicacion_directa:    { label: 'Adjudicación directa',              color: 'text-yellow-500' },
  modificaciones_plazo:    { label: '3 + ampliaciones de plazo',         color: 'text-amber-400'  },
  contratista_recurrente:  { label: 'Contratista con ≥ 10 contratos',   color: 'text-amber-500'  },
};

function scoreColor(score: number) {
  if (score >= 70) return '#ef4444';
  if (score >= 40) return '#f97316';
  return '#eab308';
}

function formatPEN(n: number | null, moneda = 'PEN') {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: moneda || 'PEN',
    maximumFractionDigits: 0,
  }).format(n);
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex gap-2 text-sm leading-snug">
      <span className="text-slate-400 w-36 shrink-0">{label}</span>
      <span className="text-white break-words">{value}</span>
    </div>
  );
}

interface Props {
  obra: ObraRiesgo;
  onClose: () => void;
}

export default function ForensicPanel({ obra, onClose }: Props) {
  const reasons: RedFlagReason[] = Array.isArray(obra.red_flag_reasons)
    ? obra.red_flag_reasons
    : [];
  const color = scoreColor(obra.red_flag_score);

  return (
    <aside className="absolute right-0 top-0 h-full w-[360px] bg-slate-900/96 backdrop-blur-sm border-l border-slate-700 flex flex-col z-20 shadow-2xl">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-slate-700">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-red-400 font-semibold mb-1">
            Panel Forense · Vigía
          </p>
          <h2 className="text-sm font-medium text-white leading-snug line-clamp-3">
            {obra.objeto ?? obra.id_contrato}
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Cerrar panel"
          className="text-slate-400 hover:text-white text-xl leading-none shrink-0 mt-0.5"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Score gauge */}
        <section>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Score de riesgo</p>
          <div className="flex items-center gap-3">
            <span className="text-5xl font-bold tabular-nums" style={{ color }}>
              {obra.red_flag_score}
            </span>
            <div className="flex-1">
              <div className="text-[10px] text-slate-500 mb-1">de 100</div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${obra.red_flag_score}%`, backgroundColor: color }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Red flags */}
        <section>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">
            Señales detectadas
          </p>
          {reasons.length === 0 ? (
            <p className="text-sm text-slate-500">Sin señales registradas</p>
          ) : (
            <ul className="space-y-1.5">
              {reasons.map((r) => {
                const meta = FLAG_META[r.code];
                return (
                  <li
                    key={r.code}
                    className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2"
                  >
                    <span className={`text-xs font-medium ${meta?.color ?? 'text-white'}`}>
                      {meta?.label ?? r.code}
                    </span>
                    <span className="ml-2 text-xs font-mono text-slate-300 shrink-0">
                      +{r.weight} pts
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Información del contrato */}
        <section className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Contrato</p>
          <InfoRow label="ID contrato"       value={obra.id_contrato} />
          <InfoRow label="Entidad"           value={obra.entidad} />
          <InfoRow label="RUC entidad"       value={obra.entidad_ruc} />
          <InfoRow label="Región"            value={obra.region} />
          <InfoRow label="Contratista"       value={obra.contratista} />
          <InfoRow label="RUC contratista"   value={obra.ruc_contratista} />
          <InfoRow
            label="Monto adjudicado"
            value={formatPEN(obra.monto_adjudicado, obra.moneda ?? 'PEN')}
          />
          <InfoRow
            label="Monto contrato"
            value={formatPEN(obra.monto_contrato, obra.moneda ?? 'PEN')}
          />
          <InfoRow label="Método adj."      value={obra.metodo_adjudicacion} />
          <InfoRow label="Fecha adj."       value={obra.fecha_adjudicacion} />
        </section>

        {/* Avance (si existe) */}
        {(obra.avance_fisico_pct != null || obra.estado_obra) && (
          <section className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">
              Avance de obra (INFOBRAS)
            </p>
            {obra.avance_fisico_pct != null && (
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Avance físico</span>
                  <span>{obra.avance_fisico_pct} %</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full"
                    style={{ width: `${Math.min(100, obra.avance_fisico_pct ?? 0)}%` }}
                  />
                </div>
              </div>
            )}
            <InfoRow label="Estado"              value={obra.estado_obra} />
            <InfoRow label="Ampl. de plazo"      value={obra.n_modificaciones_plazo} />
            <InfoRow label="Fin programado"      value={obra.fecha_fin_programada} />
            <InfoRow label="Fin real"            value={obra.fecha_fin_real} />
          </section>
        )}
      </div>
    </aside>
  );
}
