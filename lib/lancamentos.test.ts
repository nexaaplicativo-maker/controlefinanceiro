import { describe, it, expect } from 'vitest';
import { agruparPorDia } from './lancamentos';

const tx = (id: string, date?: string | null) => ({ id, date });

describe('agruparPorDia', () => {
  it('lista vazia não gera grupo', () => {
    expect(agruparPorDia([])).toEqual([]);
  });

  it('um dia só vira um grupo, com os itens na ordem de entrada', () => {
    const g = agruparPorDia([tx('a', '2026-11-23'), tx('b', '2026-11-23')]);
    expect(g).toHaveLength(1);
    expect(g[0].dia).toBe('2026-11-23');
    expect(g[0].itens.map(i => i.id)).toEqual(['a', 'b']);
  });

  it('dias fora de ordem: cada dia na posição do primeiro item, sem reordenar', () => {
    const g = agruparPorDia([
      tx('a', '2026-11-20'), tx('b', '2026-11-23'), tx('c', '2026-11-20'), tx('d', '2026-11-01'),
    ]);
    expect(g.map(x => x.dia)).toEqual(['2026-11-20', '2026-11-23', '2026-11-01']);
    expect(g[0].itens.map(i => i.id)).toEqual(['a', 'c']);
  });

  it('usa só os 10 primeiros caracteres: timestamp cai no mesmo dia', () => {
    const g = agruparPorDia([tx('a', '2026-11-23T23:59:00Z'), tx('b', '2026-11-23')]);
    expect(g).toHaveLength(1);
    expect(g[0].dia).toBe('2026-11-23');
  });

  it('data ausente ou inválida vai para um grupo próprio, no fim', () => {
    const g = agruparPorDia([
      tx('a', null), tx('b', '2026-11-23'), tx('c', undefined), tx('d', 'lixo'), tx('e', '2026-11-22'),
    ]);
    expect(g.map(x => x.dia)).toEqual(['2026-11-23', '2026-11-22', '']);
    expect(g[2].itens.map(i => i.id)).toEqual(['a', 'c', 'd']);
  });

  it('só itens sem data ainda devolvem a lista inteira', () => {
    const g = agruparPorDia([tx('a'), tx('b', '')]);
    expect(g).toEqual([{ dia: '', itens: [tx('a'), tx('b', '')] }]);
  });

  it('não perde nem duplica itens', () => {
    const entrada = [tx('a', '2026-11-23'), tx('b', null), tx('c', '2026-11-22'), tx('d', '2026-11-23')];
    const total = agruparPorDia(entrada).reduce((n, g) => n + g.itens.length, 0);
    expect(total).toBe(entrada.length);
  });
});
