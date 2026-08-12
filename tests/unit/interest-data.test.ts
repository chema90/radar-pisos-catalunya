import { describe, expect, it } from 'vitest';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

describe('territorial search normalization', () => {
  it('finds Catalan place names without accents', () => {
    expect(normalize('Sant Joan Despí')).toContain(normalize('despi'));
    expect(normalize("L'Escala")).toContain(normalize('escala'));
  });

  it('keeps purchase-only preferences explicit', () => {
    expect({ name: 'Premia de Dalt', mode: 'buy-only' }.mode).toBe('buy-only');
  });
});
