import { describe, it, expect } from 'vitest';
import { repartirPorNatureza, NATUREZA_POR_SUBCATEGORIA } from './essenciais';
import { SUBCATEGORIAS } from './subcategorias';

const gasto = (sub: string | null, amount: number, category = 'Variáveis') =>
  ({ type: 'expense', category, amount, subcategoria: sub });

describe('o mapa cobre o vocabulário inteiro', () => {
  it('toda subcategoria tem uma natureza — nenhuma fica órfã', () => {
    const semNatureza = SUBCATEGORIAS.filter(s => !NATUREZA_POR_SUBCATEGORIA[s]);
    expect(semNatureza).toEqual([]);
  });
});

describe('repartirPorNatureza', () => {
  it('separa necessidade de desejo pela subcategoria', () => {
    const r = repartirPorNatureza([
      gasto('Mercado', 800),
      gasto('Moradia', 1_500),
      gasto('Lazer', 300),
      gasto('Viagem', 2_000),
    ]);

    expect(r.essencial).toBe(2_300);
    expect(r.desejo).toBe(2_300);
    expect(r.total).toBe(4_600);
  });

  it('o meio de pagamento não muda a natureza — é o ponto do F12', () => {
    // Mesmo mercado, um no cartão e outro no Pix. O gargalo trataria o
    // primeiro como consumo discricionário e o segundo não.
    const noCartao = repartirPorNatureza([gasto('Mercado', 500, 'Cartões')]);
    const noPix = repartirPorNatureza([gasto('Mercado', 500, 'Variáveis')]);

    expect(noCartao.essencial).toBe(500);
    expect(noPix.essencial).toBe(500);
  });

  it('comer fora é desejo; mercado é necessidade', () => {
    const r = repartirPorNatureza([gasto('Alimentação', 400), gasto('Mercado', 400)]);
    expect(r.desejo).toBe(400);
    expect(r.essencial).toBe(400);
  });

  it('as três decisões discutíveis ficam onde foram decididas', () => {
    expect(repartirPorNatureza([gasto('Pets', 100)]).essencial).toBe(100);
    expect(repartirPorNatureza([gasto('Serviços', 100)]).essencial).toBe(100);
    expect(repartirPorNatureza([gasto('Outros', 100)]).desejo).toBe(100);
  });

  it('sem subcategoria reconhecível, não chuta', () => {
    const r = repartirPorNatureza([gasto(null, 250), gasto('categoria inventada', 150)]);
    expect(r.naoClassificado).toBe(400);
    expect(r.essencial).toBe(0);
    expect(r.desejo).toBe(0);
  });

  it('aporte não é consumo de nenhum dos dois tipos', () => {
    const r = repartirPorNatureza([
      { type: 'expense', category: 'Investimentos', amount: 1_000, subcategoria: 'Outros' },
      gasto('Mercado', 300),
    ]);
    expect(r.total).toBe(300);
  });

  it('receita não entra', () => {
    const r = repartirPorNatureza([
      { type: 'income', category: 'Salário', amount: 5_000, subcategoria: null },
      gasto('Mercado', 300),
    ]);
    expect(r.total).toBe(300);
  });

  it('os percentuais saem da renda de referência', () => {
    const r = repartirPorNatureza([gasto('Moradia', 2_000), gasto('Lazer', 500)], 5_000);
    expect(r.essencialPercent).toBe(40);
    expect(r.desejoPercent).toBe(10);
  });

  it('sem renda, percentual é null em vez de dividir por zero', () => {
    const r = repartirPorNatureza([gasto('Moradia', 2_000)], 0);
    expect(r.essencialPercent).toBeNull();
  });

  it('subcategoria com acento ou caixa diferente é reconhecida', () => {
    expect(repartirPorNatureza([gasto('MORADIA', 100)]).essencial).toBe(100);
    expect(repartirPorNatureza([gasto('alimentacao', 100)]).desejo).toBe(100);
  });
});
