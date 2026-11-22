import { describe, it, expect } from 'vitest';
import { dividirRenda } from './divisao-renda';

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('dividirRenda', () => {
  it('o mês do mockup soma 100% e usa os rótulos da legenda', () => {
    const d = dividirRenda({ rendaLiquida: 5123, custosFixos: 810.52, gargalo: 3515.46, outros: 0, guardado: 120, livre: 677.02 });
    expect(d.estourou).toBe(false);
    expect(d.normalizado).toBe(false);
    expect(d.segmentos.map(s => s.id)).toEqual(['fixos', 'gargalo', 'guardado', 'livre']);
    expect(d.segmentos.map(s => s.percentual)).toEqual([16, 69, 2, 13]);
    expect(soma(d.segmentos.map(s => s.percentual))).toBe(100);
    expect(d.segmentos.map(s => s.rotulo)).toEqual(['Contas fixas', 'Cartões e variáveis', 'Já guardado', 'Livre na conta']);
  });

  it('mantém o valor exato de cada segmento, sem arredondar para real', () => {
    const d = dividirRenda({ rendaLiquida: 5123, custosFixos: 810.52, gargalo: 3515.46, outros: 0, guardado: 120, livre: 677.02 });
    expect(d.segmentos.map(s => s.valor)).toEqual([810.52, 3515.46, 120, 677.02]);
  });

  it('estouro: o segmento "livre" não existe e a base vira o total das saídas', () => {
    const d = dividirRenda({ rendaLiquida: 3000, custosFixos: 1000, gargalo: 3000, outros: 0, guardado: 0, livre: -1000 });
    expect(d.estourou).toBe(true);
    expect(d.normalizado).toBe(true);
    expect(d.segmentos.some(s => s.id === 'livre')).toBe(false);
    expect(d.segmentos.map(s => s.percentual)).toEqual([25, 75, 0]);
    expect(soma(d.segmentos.map(s => s.percentual))).toBe(100);
  });

  it('saldo negativo sozinho já é estouro, mesmo com as saídas listadas abaixo da renda', () => {
    // O buraco veio de uma categoria própria, fora das quatro fatias.
    const d = dividirRenda({ rendaLiquida: 3000, custosFixos: 1000, gargalo: 1000, outros: 0, guardado: 0, livre: -200 });
    expect(d.estourou).toBe(true);
    expect(d.segmentos.some(s => s.id === 'livre')).toBe(false);
  });

  it('estouro sem nenhuma saída listada não desenha fatia nenhuma', () => {
    const d = dividirRenda({ rendaLiquida: 3000, custosFixos: 0, gargalo: 0, outros: 0, guardado: 0, livre: -500 });
    expect(d).toEqual({ segmentos: [], estourou: true, normalizado: false, base: 0 });
  });

  it('renda zero ou negativa não tem divisão', () => {
    expect(dividirRenda({ rendaLiquida: 0, custosFixos: 100, gargalo: 100, outros: 0, guardado: 0, livre: -200 }))
      .toEqual({ segmentos: [], estourou: false, normalizado: false, base: 0 });
    expect(dividirRenda({ rendaLiquida: -50, custosFixos: 0, gargalo: 0, outros: 0, guardado: 0, livre: 0 }).segmentos).toEqual([]);
  });

  it('valores negativos viram zero na fatia: resgate não cria fatia negativa', () => {
    const d = dividirRenda({ rendaLiquida: 1000, custosFixos: 500, gargalo: 0, outros: 0, guardado: -300, livre: 500 });
    const guardado = d.segmentos.find(s => s.id === 'guardado');
    expect(guardado?.valor).toBe(0);
    expect(guardado?.percentual).toBe(0);
    expect(d.estourou).toBe(false);
  });

  it('NaN e infinito não contaminam o resultado', () => {
    const d = dividirRenda({ rendaLiquida: 1000, custosFixos: NaN, gargalo: Infinity, outros: 0, guardado: 0, livre: 1000 });
    for (const s of d.segmentos) expect(Number.isFinite(s.percentual)).toBe(true);
  });

  it('arredondamento: três terços não passam de 100%', () => {
    const d = dividirRenda({ rendaLiquida: 3, custosFixos: 1, gargalo: 1, outros: 0, guardado: 0, livre: 1 });
    // Arredondar cada fatia sozinha daria 33 + 33 + 0 + 33 = 99; o ponto é que
    // a soma nunca passa de 100 e nenhuma fatia sai negativa.
    expect(soma(d.segmentos.map(s => s.percentual))).toBeLessThanOrEqual(100);
    expect(d.segmentos.every(s => s.percentual >= 0)).toBe(true);
  });

  it('arredondamento: seis sextos e outras divisões feias nunca passam de 100%', () => {
    const casos = [
      { rendaLiquida: 7, custosFixos: 1, gargalo: 2, outros: 0, guardado: 1, livre: 3 },
      { rendaLiquida: 100, custosFixos: 33.33, gargalo: 33.33, outros: 0, guardado: 33.33, livre: 0.01 },
      { rendaLiquida: 9, custosFixos: 3, gargalo: 3, outros: 0, guardado: 3, livre: 0 },
      { rendaLiquida: 3, custosFixos: 3, gargalo: 3, outros: 0, guardado: 3, livre: -6 },
    ];
    for (const c of casos) {
      const total = soma(dividirRenda(c).segmentos.map(s => s.percentual));
      expect(total).toBeLessThanOrEqual(100);
    }
  });

  it('quando as fatias cobrem a renda toda, a soma é exatamente 100', () => {
    const d = dividirRenda({ rendaLiquida: 7, custosFixos: 1, gargalo: 2, outros: 0, guardado: 1, livre: 3 });
    expect(soma(d.segmentos.map(s => s.percentual))).toBe(100);
  });

  it('livre maior que a renda (resgate lançado como receita): a base cresce e nada passa de 100%', () => {
    const d = dividirRenda({ rendaLiquida: 1000, custosFixos: 500, gargalo: 0, outros: 0, guardado: 0, livre: 1500 });
    expect(d.estourou).toBe(false);
    expect(d.normalizado).toBe(true);
    expect(d.base).toBe(2000);
    expect(d.segmentos.map(s => s.percentual)).toEqual([25, 0, 0, 75]);
    expect(soma(d.segmentos.map(s => s.percentual))).toBe(100);
  });

  it('a base é a renda quando as fatias não a passam, e a barra pode ficar com resto vazio', () => {
    const d = dividirRenda({ rendaLiquida: 1000, custosFixos: 200, gargalo: 200, outros: 0, guardado: 0, livre: 100 });
    expect(d.base).toBe(1000);
    expect(d.normalizado).toBe(false);
    expect(soma(d.segmentos.map(s => s.percentual))).toBe(50);
  });

  it('no estouro a base é o total das saídas', () => {
    const d = dividirRenda({ rendaLiquida: 3000, custosFixos: 1000, gargalo: 3000, outros: 0, guardado: 0, livre: -1000 });
    expect(d.base).toBe(4000);
  });

  it('outros gastos viram a terceira fatia, e a divisão fecha a renda', () => {
    const d = dividirRenda({ rendaLiquida: 5000, custosFixos: 1800, gargalo: 900, outros: 400, guardado: 0, livre: 1900 });
    expect(d.segmentos.map(s => s.id)).toEqual(['fixos', 'gargalo', 'outros', 'guardado', 'livre']);
    expect(d.segmentos.map(s => s.valor)).toEqual([1800, 900, 400, 0, 1900]);
    expect(d.segmentos.map(s => s.percentual)).toEqual([36, 18, 8, 0, 38]);
    expect(soma(d.segmentos.map(s => s.percentual))).toBe(100);
    expect(d.base).toBe(5000);
  });

  it('sem gasto fora dos dois grupos não existe a fatia "outros"', () => {
    const d = dividirRenda({ rendaLiquida: 5000, custosFixos: 1800, gargalo: 900, outros: 0, guardado: 500, livre: 1800 });
    expect(d.segmentos.some(s => s.id === 'outros')).toBe(false);
  });

  it('guardado negativo (resgate): a fatia é zero, a base cresce e nada passa de 100%', () => {
    // Salário 5.000, resgate 3.800, aporte 500, fixas 1.800: guardado −3.300, livre 6.500.
    const d = dividirRenda({ rendaLiquida: 5000, custosFixos: 1800, gargalo: 0, outros: 0, guardado: -3300, livre: 6500 });
    expect(d.estourou).toBe(false);
    expect(d.segmentos.find(s => s.id === 'guardado')?.valor).toBe(0);
    expect(d.base).toBe(8300);
    expect(d.normalizado).toBe(true);
    expect(soma(d.segmentos.map(s => s.percentual))).toBeLessThanOrEqual(100);
  });

  it('renda gasta até o último centavo não é estouro, mesmo com resíduo de ponto flutuante', () => {
    const d = dividirRenda({ rendaLiquida: 0.3, custosFixos: 0.1, gargalo: 0.1, outros: 0.1, guardado: 0, livre: 0 });
    expect(d.estourou).toBe(false);
  });

  it('o estouro conta os outros gastos nas saídas', () => {
    const d = dividirRenda({ rendaLiquida: 1000, custosFixos: 500, gargalo: 200, outros: 600, guardado: 0, livre: -300 });
    expect(d.estourou).toBe(true);
    expect(d.base).toBe(1300);
    expect(d.segmentos.some(s => s.id === 'livre')).toBe(false);
    expect(soma(d.segmentos.map(s => s.percentual))).toBe(100);
  });
});
