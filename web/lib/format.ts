// Formateadores compartidos (es-PE)

/** Soles en formato compacto: S/ 1.2 B / S/ 340 M / S/ 12 K */
export function formatPENCompact(n: number): string {
  if (n >= 1_000_000_000) return `S/ ${(n / 1_000_000_000).toFixed(1)} B`;
  if (n >= 1_000_000)     return `S/ ${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)         return `S/ ${(n / 1_000).toFixed(0)} K`;
  return `S/ ${Math.round(n)}`;
}

/** Soles completos: S/ 15,800,000 */
export function formatPEN(n: number | null, moneda = 'PEN'): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: moneda || 'PEN',
    maximumFractionDigits: 0,
  }).format(n);
}

/** Número compacto: 2.4 M / 340 K / 1,240 */
export function formatNumCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} K`;
  return n.toLocaleString('es-PE');
}

/** Entero con separadores de miles */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('es-PE');
}

/** Convierte AMAZONAS → Amazonas, LA LIBERTAD → La Libertad */
export function titleCase(s: string | null): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}
