// Tests unitarios de los formateadores compartidos (es-PE).
// Funciones puras, sin dependencias externas → rápidos y deterministas.
import { describe, it, expect } from 'vitest';
import {
  formatPENCompact,
  formatPEN,
  formatNumCompact,
  formatInt,
  titleCase,
} from './format';

describe('formatPENCompact', () => {
  it('formatea miles de millones con sufijo B', () => {
    expect(formatPENCompact(1_500_000_000)).toBe('S/ 1.5 B');
  });

  it('formatea millones con sufijo M', () => {
    expect(formatPENCompact(340_000_000)).toBe('S/ 340.0 M');
  });

  it('formatea miles con sufijo K (sin decimales)', () => {
    expect(formatPENCompact(12_000)).toBe('S/ 12 K');
  });

  it('deja los montos chicos sin sufijo y redondeados', () => {
    expect(formatPENCompact(500)).toBe('S/ 500');
    expect(formatPENCompact(499.6)).toBe('S/ 500');
  });
});

describe('formatPEN', () => {
  it('devuelve un guion largo cuando el valor es null', () => {
    expect(formatPEN(null)).toBe('—');
  });

  it('incluye el símbolo de soles para un monto válido', () => {
    expect(formatPEN(15_800_000)).toContain('S/');
  });
});

describe('formatNumCompact', () => {
  it('formatea millones con un decimal', () => {
    expect(formatNumCompact(2_400_000)).toBe('2.4 M');
  });

  it('formatea miles con un decimal', () => {
    expect(formatNumCompact(340_000)).toBe('340.0 K');
  });
});

describe('formatInt', () => {
  it('redondea al entero más cercano', () => {
    expect(formatInt(12.4)).toBe('12');
    expect(formatInt(12.6)).toBe('13');
  });

  it('mantiene los números chicos sin separadores', () => {
    expect(formatInt(999)).toBe('999');
  });
});

describe('titleCase', () => {
  it('convierte MAYÚSCULAS a Capitalizado', () => {
    expect(titleCase('AMAZONAS')).toBe('Amazonas');
  });

  it('capitaliza la primera palabra aunque sea corta (LA LIBERTAD)', () => {
    expect(titleCase('LA LIBERTAD')).toBe('La Libertad');
  });

  it('devuelve cadena vacía para null o cadena vacía', () => {
    expect(titleCase(null)).toBe('');
    expect(titleCase('')).toBe('');
  });
});
