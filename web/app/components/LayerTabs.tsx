'use client';

import type { MapLayer } from '@/lib/types';
import { LAYERS, LAYER_ORDER } from '@/lib/layers';
import Icon from './Icon';

interface Props {
  active: MapLayer;
  onChange: (l: MapLayer) => void;
}

export default function LayerTabs({ active, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-2xl glass-strong">
      {LAYER_ORDER.map((id) => {
        const cfg = LAYERS[id];
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all ${
              isActive ? 'text-white shadow-pill' : 'text-inksoft hover:text-ink'
            }`}
            style={isActive ? { background: `linear-gradient(135deg, ${cfg.gradient[0]}, ${cfg.gradient[1]})` } : undefined}
          >
            <Icon name={cfg.glyph} size={16} />
            <span className="hidden sm:inline">{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
