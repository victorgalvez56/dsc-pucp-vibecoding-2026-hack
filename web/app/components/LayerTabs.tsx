'use client';

import { LAYERS, LAYER_ORDER } from '@/lib/layers';
import Icon from './Icon';
import { withLayer, type LayerInjectedProps } from '@/app/hoc/withLayer';

function LayerTabs({ activeLayer, changeLayer }: LayerInjectedProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-2xl glass-strong">
      {LAYER_ORDER.map((id) => {
        const cfg = LAYERS[id];
        const isActive = id === activeLayer;
        return (
          <button
            key={id}
            onClick={() => changeLayer(id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all ${
              isActive ? 'text-white shadow-pill' : 'text-inksoft hover:text-ink'
            }`}
            style={isActive
              ? { background: `linear-gradient(135deg, ${cfg.gradient[0]}, ${cfg.gradient[1]})` }
              : {
                  border: '1.5px solid transparent',
                  background: `linear-gradient(rgba(255,253,250,0.9), rgba(255,253,250,0.9)) padding-box,
                               linear-gradient(135deg, ${cfg.gradient[0]}, ${cfg.gradient[1]}) border-box`,
                }
            }
          >
            <Icon name={cfg.glyph} size={16} />
            <span className="hidden sm:inline">{cfg.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default withLayer(LayerTabs);
