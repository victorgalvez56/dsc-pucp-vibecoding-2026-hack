'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { MapLayer } from '@/lib/types';

interface LayerContextValue {
  activeLayer: MapLayer;
  changeLayer: (l: MapLayer) => void;
}

const LayerContext = createContext<LayerContextValue | null>(null);

export function useLayerContext(): LayerContextValue {
  const ctx = useContext(LayerContext);
  if (!ctx) throw new Error('useLayerContext must be used inside LayerProvider');
  return ctx;
}

interface LayerProviderProps {
  children: ReactNode;
  activeLayer: MapLayer;
  changeLayer: (l: MapLayer) => void;
}

export function LayerProvider({ children, activeLayer, changeLayer }: LayerProviderProps) {
  return (
    <LayerContext.Provider value={{ activeLayer, changeLayer }}>
      {children}
    </LayerContext.Provider>
  );
}
