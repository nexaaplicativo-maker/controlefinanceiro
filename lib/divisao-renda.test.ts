import { describe, it, expect } from 'vitest';
import { dividirRenda } from './divisao-renda';

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('dividirRenda', () => {
  it('o mês do mockup soma 100% e usa os rótulos da legenda', () => {
    const d = dividirRenda({ rendaLiquida: 5123, custosFixos: 810.52, gargalo: 3515.46, guardado: 120, livre: 677.02 });
    expect(d.estourou).toBe(false);
    expect(d.normalizado).toBe(false);
    expect(d.segmentos.map(s => s.id)).toEqual(['fixos', 'gargalo', 'guardado', 'livre']);
    expect(d.segmentos.map(s => s.percentual)).toEqual([16, 69, 2, 13]);
    expect(soma(d.segmentos.map(s => s.percentual))).toBe(100);
    expect(d.segmentos.map(s => s.rotulo)).toEqual(['Contas fixas', 'Cartões e variáveis', 'Já guardado', 'Livre na conta']);
  });

  it('mantém o valor exato de cada segmento, sem arredondar para real', () => {
    const d = dividirRenda({ rendaLiquida: 5123, custosFixos: 810.52, gargalo: 3515.46, guardado: 120, livre: 677.02 });
    expect(d.segmentos.map(s => s.valor)).toEqual([810.52, 3515.46, 120, 677.02]);
  });

  it('estouro: o segmento "livre" não existe e a base vira o total das saídas', () => {
    const d = dividirRenda({ rendaLiquida: 3000, custosFixos: 1000, gargalo: 3000, guardado: 0, livre: -1000 });
    expect(d.estourou).toBe(true);
    expect(d.normalizado).toBe(true);
    expect(d.segmentos.some(s => s.id === 'livre')).toBe(false);
    expect(d.segmentos.map(s => s.percentual)).toEqual([25, 75, 0]);
    expect(soma(d.segmentos.map(s => s.percentual))).toBe(100);
  });

  it('saldo negativo sozinho já é estouro, mesmo com as saídas listadas abaixo da renda', () => {
    // O buraco veio de uma categoria própria, fora das quatro fatias.
    const d = dividirRenda({ rendaLiquida: 3000, custosFixos: 1000, gargalo: 1000, guardado: 0, livre: -200 });
    expect(d.estourou).toBe(true);
    expect(d.segmentos.some(s => s.id === 'livre')).toBe(false);
  });

  it('estouro sem nenhuma saída listada não desenha fatia nenhuma', () => {
    const d = dividirRenda({ rendaLiquida: 3000, custosFixos: 0, gargalo: 0, guardado: 0, livre: -500 });
    expect(d).toEqual({ segmentos: [], estourou: true, normalizado: false });
  });

  it('renda zero ou negativa não tem divisão', () => {
    expect(dividirRenda({ rendaLiquida: 0, custosFixos: 100, gargalo: 100, guardado: 0, livre: -200 }))
      .toEqual({ segmentos: [], estourou: false, normalizado: false });
    expect(dividirRenda({ rendaLiquida: -50, custosFixos: 0, gargalo: 0, guardado: 0, livre: 0 }).segmentos).toEqual([]);
  });

  it('valores negativos viram zero na fatia: resgate não cria fatia negativa', () => {
    const d = dividirRenda({ rendaLiquida: 1000, custosFixos: 500, gargalo: 0, guardado: -300, livre: 500 });
    const guardado = d.segmentos.find(s => s.id === 'guardado');
    expect(guardado?.valor).toBe(0);
    expect(guardado?.percentual).toBe(0);
    expect(d.estourou).toBe(false);
  });

  it('NaN e infinito não contaminam o resultado', () => {
    const d = dividirRenda({ rendaLiquida: 1000, custosFixos: NaN, gargalo: Infinity, guardado: 0, livre: 1000 });
    for (const s of d.segmentos) expect(Number.isFinite(s.percentual)).toBe(true);
  });

  it('arredondamento: três terços não passam de 100%', () => {
    const d = dividirRenda({ rendaLiquida: 3, custosFixos: 1, gargalo: 1, guardado: 0, livre: 1 });
    // Arredondar cada fatia sozinha daria 33 + 33 + 0 + 33 = 99; o ponto é que
    // a soma nunca passa de 100 e nenhuma fatia sai negativa.
    expect(soma(d.segmentos.map(s => s.percentual))).toBeLessThanOrEqual(100);
    expect(d.segmentos.every(s => s.percentual >= 0)).toBe(true);
  });

  it('arredondamento: seis sextos e outras divisões feias nunca passam de 100%', () => {
    const casos = [
      { rendaLiquida: 7, custosFixos: 1, gargalo: 2, guardado: 1, livre: 3 },
      { rendaLiquida: 100, custosFixos: 33.33, gargalo: 33.33, guardado: 33.33, livre: 0.01 },
      { rendaLiquida: 9, custosFixos: 3, gargalo: 3, guardado: 3, livre: 0 },
      { rendaLiquida: 3, custosFixos: 3, gargalo: 3, guardado: 3, livre: -6 },
    ];
    for (const c of casos) {
      const total = soma(dividirRenda(c).segmentos.map(s => s.percentual));
      expect(total).toBeLessThanOrEqual(100);
    }
  });

  it('quando as fatias cobrem a renda toda, a soma é exatamente 100', () => {
    const d = dividirRenda({ rendaLiquida: 7, custosFixos: 1, gargalo: 2, guardado: 1, livre: 3 });
    expect(soma(d.segmentos.map(s => s.percentual))).toBe(100);
  });
});
