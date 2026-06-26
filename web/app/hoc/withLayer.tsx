'use client';

import type { ComponentType } from 'react';
import type { MapLayer } from '@/lib/types';
import { useLayerContext } from '@/app/context/LayerContext';

export interface LayerInjectedProps {
  activeLayer: MapLayer;
  changeLayer: (l: MapLayer) => void;
}

export function withLayer<P extends LayerInjectedProps>(
  Component: ComponentType<P>
) {
  type ExternalProps = Omit<P, keyof LayerInjectedProps>;

  const LayeredComponent = (props: ExternalProps) => {
    const { activeLayer, changeLayer } = useLayerContext();
    return <Component {...(props as unknown as P)} activeLayer={activeLayer} changeLayer={changeLayer} />;
  };

  LayeredComponent.displayName = `withLayer(${Component.displayName ?? Component.name ?? 'Component'})`;
  return LayeredComponent;
}
