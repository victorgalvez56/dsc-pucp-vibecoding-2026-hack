'use client';

import type { ComponentType, ElementType } from 'react';

type GlassVariant = 'glass' | 'glass-strong';

export function withGlass<P extends { className?: string }>(
  Component: ElementType | ComponentType<P>,
  variant: GlassVariant = 'glass'
) {
  const GlassComponent = ({ className, ...props }: P) => {
    const combined = [variant, className].filter(Boolean).join(' ');
    const AnyComp = Component as ElementType;
    return <AnyComp className={combined} {...props} />;
  };
  const name = typeof Component === 'string' ? Component : (Component.displayName ?? Component.name ?? 'Component');
  GlassComponent.displayName = `withGlass(${name})`;
  return GlassComponent;
}

// Componentes listos para usar
export const GlassCard  = withGlass('div');
export const GlassPanel = withGlass('div', 'glass-strong');
