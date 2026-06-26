import Icon from './Icon';

interface Props {
  glyph: 'budget' | 'health' | 'people' | 'build';
  gradient: [string, string];
  size?: number;
  className?: string;
}

/** Cuadrito redondeado con degradado + glifo blanco (estilo "app icon"). */
export default function GlyphChip({ glyph, gradient, size = 30, className = '' }: Props) {
  return (
    <span
      className={`grid place-items-center rounded-[9px] text-white shadow-pill ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
      }}
    >
      <Icon name={glyph} size={size * 0.56} strokeWidth={2.1} />
    </span>
  );
}
