'use client';

import { useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import Icon from './Icon';

gsap.registerPlugin(useGSAP);

interface Msg {
  role: 'user' | 'agent';
  text: string;
  sql?: string | null;
  rowCount?: number;
}

const SUGGESTIONS = [
  'Contratistas sancionados que ganaron obras en Cusco',
  'Las 5 obras paralizadas con mayor monto',
  '¿Qué región tiene más obras en riesgo?',
  'Contratistas con más obras marcadas',
];

export default function AgentChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (open && panelRef.current) {
      gsap.from(panelRef.current, { y: 24, autoAlpha: 0, duration: 0.4, ease: 'power3.out' });
    }
  }, { dependencies: [open] });

  const scrollDown = () => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setLoading(true);
    scrollDown();
    // Delay "pensando": los puntitos se ven al menos ~1s aunque la BD responda al instante.
    const thinking = new Promise((r) => setTimeout(r, 900 + Math.random() * 700));
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      await thinking;
      if (!res.ok) throw new Error(data?.error ?? 'Error');
      setMsgs((m) => [...m, { role: 'agent', text: data.answer, sql: data.sql, rowCount: data.rowCount }]);
    } catch (err) {
      await thinking;
      setMsgs((m) => [...m, { role: 'agent', text: `⚠️ ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
      scrollDown();
    }
  }

  return (
    <>
      {/* Launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="absolute bottom-5 right-5 z-30 flex items-center gap-2 rounded-2xl px-4 py-3 text-white shadow-float transition-transform hover:scale-[1.03] active:scale-95"
          style={{ background: 'linear-gradient(135deg,#818cf8,#f43f5e)' }}
        >
          <Icon name="search" size={16} />
          <span className="font-display text-[13px] font-semibold tracking-tight">Pregúntale a Vigía</span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute z-30 flex flex-col glass-strong shadow-float overflow-hidden
                     bottom-2 left-2 right-2 h-[82%] rounded-[22px]
                     sm:bottom-5 sm:right-5 sm:left-auto sm:h-[clamp(360px,70vh,560px)] sm:w-[400px] sm:rounded-[24px]"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 p-4 border-b border-black/5">
            <span className="grid place-items-center w-7 h-7 rounded-xl text-white" style={{ background: 'linear-gradient(135deg,#818cf8,#f43f5e)' }}>
              <Icon name="shield" size={15} />
            </span>
            <div className="flex-1 leading-none">
              <div className="font-display text-[13px] font-bold tracking-tight text-ink">Agente Vigía</div>
              <div className="text-[10px] text-inksoft mt-0.5">Pregunta en español · datos reales</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" className="grid place-items-center w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-black/[0.06] text-inksoft hover:text-ink hover:bg-black/10 active:scale-95 transition shrink-0">
              <Icon name="close" size={18} />
            </button>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-[12.5px] text-inksoft leading-relaxed">
                  Interrogá los <span className="font-semibold text-ink">468 mil registros</span> del Estado en lenguaje natural. Probá:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left glass rounded-xl px-3 py-2 text-[12px] text-ink hover:bg-black/[0.04] transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-[12.5px] text-white'
                      : 'max-w-[92%] rounded-2xl rounded-bl-md glass px-3.5 py-2.5 text-[12.5px] text-ink leading-relaxed'
                  }
                  style={m.role === 'user' ? { background: 'linear-gradient(135deg,#6366f1,#f43f5e)' } : undefined}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.role === 'agent' && m.sql && (
                    <details className="mt-2 group">
                      <summary className="cursor-pointer text-[10.5px] text-inkfaint hover:text-inksoft select-none">
                        ver consulta · {m.rowCount} fila{m.rowCount === 1 ? '' : 's'}
                      </summary>
                      <pre className="mt-1.5 overflow-x-auto rounded-lg bg-black/[0.04] p-2 text-[10px] leading-snug text-inksoft no-scrollbar">{m.sql}</pre>
                    </details>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="glass rounded-2xl rounded-bl-md px-3.5 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-inksoft animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-inksoft animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-inksoft animate-bounce" style={{ animationDelay: '240ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 p-3 border-t border-black/5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe tu pregunta…"
              enterKeyHint="send"
              autoComplete="off"
              className="flex-1 min-w-0 bg-black/[0.04] rounded-xl px-3 py-2.5 text-[16px] text-ink placeholder:text-inkfaint outline-none focus:bg-black/[0.06] transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar"
              className="grid place-items-center w-10 h-10 sm:w-9 sm:h-9 rounded-xl text-white shrink-0 disabled:opacity-40 transition-opacity"
              style={{ background: 'linear-gradient(135deg,#818cf8,#f43f5e)' }}
            >
              <Icon name="chevron" size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
