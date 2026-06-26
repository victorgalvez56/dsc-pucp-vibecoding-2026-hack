'use client';

import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ObraRiesgo, RedFlagReason } from '@/lib/types';
import { formatPEN, titleCase } from '@/lib/format';
import Icon from './Icon';

gsap.registerPlugin(useGSAP);

const FLAG_META: Record<string, { label: string; dot: string }> = {
  contratista_sancionado:  { label: 'Contratista sancionado (OECE)',      dot: '#e11d48' },
  inhabilitacion_judicial: { label: 'Inhabilitación judicial vigente',    dot: '#be123c' },
  sobrecosto:              { label: 'Sobrecosto > 15% sobre adjudicado',  dot: '#ea580c' },
  obra_paralizada:         { label: 'Obra paralizada',                    dot: '#f97316' },
  obra_vencida:            { label: 'Obra vencida de plazo',              dot: '#d97706' },
  adjudicacion_directa:    { label: 'Adjudicación directa',               dot: '#ca8a04' },
  modificaciones_plazo:    { label: '≥ 3 ampliaciones de plazo',          dot: '#b45309' },
  contratista_recurrente:  { label: 'Contratista con ≥ 10 contratos',     dot: '#9a3412' },
};

function scoreColor(s: number) {
  if (s >= 70) return '#e11d48';
  if (s >= 40) return '#ea580c';
  return '#ca8a04';
}

function Row({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null;
  return (
    <div className="flex gap-3 text-[12.5px] leading-snug">
      <span className="text-inkfaint w-32 shrink-0">{label}</span>
      <span className="text-ink font-medium break-words">{value}</span>
    </div>
  );
}

interface Props {
  obra: ObraRiesgo;
  onClose: () => void;
}

export default function ForensicPanel({ obra, onClose }: Props) {
  const ref = useRef<HTMLElement>(null);
  const reasons: RedFlagReason[] = Array.isArray(obra.red_flag_reasons) ? obra.red_flag_reasons : [];
  const color = scoreColor(obra.red_flag_score);

  useGSAP(() => {
    gsap.from(ref.current, { x: 60, autoAlpha: 0, duration: 0.5, ease: 'power3.out' });
    gsap.from('.forensic-block', { x: 24, autoAlpha: 0, duration: 0.45, ease: 'power2.out', stagger: 0.07, delay: 0.12 });
  }, { dependencies: [obra.id_contrato], scope: ref });

  return (
    <aside ref={ref} className="absolute right-0 top-0 h-full w-[370px] max-w-[88vw] glass-strong rounded-l-[28px] flex flex-col z-30 shadow-float">
      {/* Header */}
      <div className="forensic-block flex items-start gap-3 p-5 border-b border-black/5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="grid place-items-center w-5 h-5 rounded-md bg-obras/10 text-obras"><Icon name="alert" size={12} /></span>
            <p className="text-[10px] uppercase tracking-[0.15em] text-obras font-bold">Panel Forense</p>
          </div>
          <h2 className="font-display text-[15px] font-semibold text-ink leading-snug line-clamp-3">
            {obra.objeto ?? obra.id_contrato}
          </h2>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="shrink-0 grid place-items-center w-8 h-8 rounded-xl text-inksoft hover:text-ink hover:bg-black/5 transition-colors">
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Score */}
        <section className="forensic-block">
          <p className="text-[10px] uppercase tracking-[0.14em] text-inkfaint font-semibold mb-2">Score de riesgo</p>
          <div className="flex items-end gap-3">
            <span className="font-display text-[52px] leading-none font-semibold nums" style={{ color }}>{obra.red_flag_score}</span>
            <div className="flex-1 pb-2">
              <div className="text-[10px] text-inkfaint mb-1.5">de 100</div>
              <div className="h-2.5 rounded-full bg-black/[0.06] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${obra.red_flag_score}%`, background: `linear-gradient(90deg, ${color}aa, ${color})` }} />
              </div>
            </div>
          </div>
        </section>

        {/* Señales */}
        <section className="forensic-block">
          <p className="text-[10px] uppercase tracking-[0.14em] text-inkfaint font-semibold mb-2">Señales detectadas</p>
          {reasons.length === 0 ? (
            <p className="text-[13px] text-inksoft">Sin señales registradas</p>
          ) : (
            <ul className="space-y-1.5">
              {reasons.map((r) => {
                const meta = FLAG_META[r.code];
                return (
                  <li key={r.code} className="flex items-center gap-2.5 glass rounded-xl px-3 py-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta?.dot ?? '#64748b' }} />
                    <span className="text-[12px] font-medium text-ink flex-1">{meta?.label ?? r.code}</span>
                    <span className="text-[11px] font-bold nums shrink-0" style={{ color: meta?.dot ?? '#64748b' }}>+{r.weight}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Contrato */}
        <section className="forensic-block space-y-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-inkfaint font-semibold mb-1">Contrato</p>
          <Row label="ID contrato" value={obra.id_contrato} />
          <Row label="Entidad" value={obra.entidad} />
          <Row label="Región" value={titleCase(obra.region)} />
          <Row label="Contratista" value={obra.contratista} />
          <Row label="RUC" value={obra.ruc_contratista} />
          <Row label="Adjudicado" value={formatPEN(obra.monto_adjudicado, obra.moneda ?? 'PEN')} />
          <Row label="Contrato" value={formatPEN(obra.monto_contrato, obra.moneda ?? 'PEN')} />
          <Row label="Método" value={obra.metodo_adjudicacion} />
          <Row label="Fecha adj." value={obra.fecha_adjudicacion} />
        </section>

        {/* Avance */}
        {(obra.avance_fisico_pct != null || obra.estado_obra) && (
          <section className="forensic-block space-y-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-inkfaint font-semibold mb-1">Avance de obra · INFOBRAS</p>
            {obra.avance_fisico_pct != null && (
              <div className="mb-2">
                <div className="flex justify-between text-[11px] text-inksoft mb-1">
                  <span>Avance físico</span>
                  <span className="font-semibold text-ink nums">{obra.avance_fisico_pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-black/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-presupuesto" style={{ width: `${Math.min(100, obra.avance_fisico_pct ?? 0)}%` }} />
                </div>
              </div>
            )}
            <Row label="Estado" value={obra.estado_obra} />
            <Row label="Ampl. plazo" value={obra.n_modificaciones_plazo} />
            <Row label="Fin programado" value={obra.fecha_fin_programada} />
            <Row label="Fin real" value={obra.fecha_fin_real} />
          </section>
        )}
      </div>
    </aside>
  );
}
