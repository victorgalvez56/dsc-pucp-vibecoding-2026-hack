'use client';

import Image from 'next/image';
import Icon from './Icon';

const NAV = [
  { name: 'dashboard' as const, label: 'Panel', active: true },
  { name: 'layers' as const, label: 'Capas', active: false },
  { name: 'map' as const, label: 'Mapa', active: false },
  { name: 'settings' as const, label: 'Ajustes', active: false },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-[72px] shrink-0 flex-col items-center py-5 glass-strong rounded-r-[28px] z-30">
      {/* Marca */}
      <div className="flex flex-col items-center gap-1.5 mb-8" title="Vigía">
        <Image src="/icons/vigia-logo.png" alt="Vigía" width={70} height={70} priority />
      </div>

      {/* Navegación */}
      <nav className="flex flex-col gap-2.5 flex-1">
        {NAV.map((item) => (
          <button
            key={item.name}
            title={item.label}
            className={`grid place-items-center w-11 h-11 rounded-2xl transition-all ${
              item.active
                ? 'bg-ink text-white shadow-pill'
                : 'text-inkfaint hover:text-ink hover:bg-white/60'
            }`}
          >
            <Icon name={item.name} size={20} />
          </button>
        ))}
      </nav>

      {/* Pie */}
      <div className="flex flex-col items-center gap-3 mt-auto">
        <button className="relative grid place-items-center w-11 h-11 rounded-2xl text-inkfaint hover:text-ink hover:bg-white/60 transition-all" title="Alertas">
          <Icon name="bell" size={20} />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-obras ring-2 ring-white" />
        </button>
        <div
          className="w-9 h-9 rounded-full ring-2 ring-white shadow-pill"
          style={{ background: 'linear-gradient(135deg, #6366f1, #14b8a6)' }}
          title="Equipo Vigía"
        />
      </div>
    </aside>
  );
}
