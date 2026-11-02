import { describe, it, expect } from 'vitest';
import {
  detectarParcela,
  tituloBase,
  parcelaValida,
  somarMeses,
  chaveParcela,
  expandirParcelamento,
} from './parcelas';

describe('detectarParcela', () => {
  it('lê o formato que a fatura usa', () => {
    expect(detectarParcela('AMERICANAS 03/10')).toEqual({ numero: 3, total: 10 });
    expect(detectarParcela('MERCADOLIVRE*LOJA 2/6')).toEqual({ numero: 2, total: 6 });
  });

  it('aceita as variações com marcador e parênteses', () => {
    expect(detectarParcela('NETSHOES PARC 04/12')).toEqual({ numero: 4, total: 12 });
    expect(detectarParcela('MAGALU (1/3)')).toEqual({ numero: 1, total: 3 });
    expect(detectarParcela('CASAS BAHIA 2 de 5')).toEqual({ numero: 2, total: 5 });
  });

  it('ignora compra à vista', () => {
    expect(detectarParcela('IFOOD')).toBeNull();
    expect(detectarParcela('UBER TRIP')).toBeNull();
  });

  it('não trata 1/1 como parcelamento', () => {
    expect(detectarParcela('PADARIA 1/1')).toBeNull();
  });

  it('recusa número maior que o total', () => {
    expect(detectarParcela('LOJA 15/03')).toBeNull();
  });

  it('recusa parcelamento maior que o teto', () => {
    expect(detectarParcela('LOJA 02/99')).toBeNull();
  });

  it('exige o marcador no fim, para não ler data como parcela', () => {
    // Aqui o "03/10" é data de compra no meio da linha, não parcela.
    expect(detectarParcela('UBER 03/10 SAO PAULO')).toBeNull();
  });

  it('aguenta entrada vazia', () => {
    expect(detectarParcela(null)).toBeNull();
    expect(detectarParcela(undefined)).toBeNull();
    expect(detectarParcela('')).toBeNull();
  });
});

describe('tituloBase', () => {
  it('tira o marcador do fim', () => {
    expect(tituloBase('AMERICANAS 03/10')).toBe('AMERICANAS');
    expect(tituloBase('MAGALU (1/3)')).toBe('MAGALU');
  });

  it('deixa intacto o que não tem marcador', () => {
    expect(tituloBase('IFOOD')).toBe('IFOOD');
  });
});

describe('parcelaValida', () => {
  it('recusa não-inteiro', () => {
    expect(parcelaValida(1.5, 10)).toBe(false);
    expect(parcelaValida('3', 10)).toBe(false);
    expect(parcelaValida(null, 10)).toBe(false);
  });

  it('aceita o caso normal', () => {
    expect(parcelaValida(1, 2)).toBe(true);
    expect(parcelaValida(36, 36)).toBe(true);
  });

  it('recusa zero e negativo', () => {
    expect(parcelaValida(0, 10)).toBe(false);
    expect(parcelaValida(-1, 10)).toBe(false);
  });
});

describe('somarMeses', () => {
  it('anda os meses', () => {
    expect(somarMeses('2026-11-02', 1)).toBe('2026-12-02');
    expect(somarMeses('2026-11-02', 0)).toBe('2026-11-02');
  });

  it('vira o ano', () => {
    expect(somarMeses('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('prende no último dia quando o mês de destino é mais curto', () => {
    // Sem isso, 31/01 + 1 mês viraria 03/03 e a parcela cairia no mês errado.
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2026-03-31', 1)).toBe('2026-04-30');
  });

  it('não acumula o encurtamento nas parcelas seguintes', () => {
    expect(somarMeses('2026-01-31', 2)).toBe('2026-03-31');
  });
});

describe('chaveParcela', () => {
  it('iguala a mesma cobrança escrita de formas diferentes', () => {
    expect(chaveParcela('Americanas', '4/10', '2026-12-05'))
      .toBe(chaveParcela('AMERICANAS', '4/10', '2026-12-22'));
  });

  it('ignora acento e espaço repetido', () => {
    expect(chaveParcela('Farmácia  São  João', '2/3', '2026-11-01'))
      .toBe(chaveParcela('FARMACIA SAO JOAO', '2/3', '2026-11-30'));
  });

  it('separa parcelas diferentes da mesma compra', () => {
    expect(chaveParcela('Americanas', '4/10', '2026-12-05'))
      .not.toBe(chaveParcela('Americanas', '5/10', '2026-12-05'));
  });

  it('separa meses diferentes', () => {
    expect(chaveParcela('Americanas', '4/10', '2026-12-05'))
      .not.toBe(chaveParcela('Americanas', '4/10', '2027-01-05'));
  });
});

describe('expandirParcelamento', () => {
  it('devolve a cobrança atual e as futuras', () => {
    const linhas = expandirParcelamento('AMERICANAS 03/10', '2026-11-02', { numero: 3, total: 10 });

    expect(linhas).toHaveLength(8);
    expect(linhas[0]).toEqual({
      titulo: 'AMERICANAS (3/10)',
      data: '2026-11-02',
      installment_info: '3/10',
      futura: false,
    });
    expect(linhas[1].data).toBe('2026-12-02');
    expect(linhas[7]).toEqual({
      titulo: 'AMERICANAS (10/10)',
      data: '2027-06-02',
      installment_info: '10/10',
      futura: true,
    });
  });

  it('marca só a primeira como cobrança deste mês', () => {
    const linhas = expandirParcelamento('LOJA 1/3', '2026-11-02', { numero: 1, total: 3 });
    expect(linhas.map(l => l.futura)).toEqual([false, true, true]);
  });

  it('na última parcela não projeta nada à frente', () => {
    const linhas = expandirParcelamento('LOJA 10/10', '2026-11-02', { numero: 10, total: 10 });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].futura).toBe(false);
  });

  it('sem parcelamento devolve lista vazia', () => {
    expect(expandirParcelamento('IFOOD', '2026-11-02', null)).toEqual([]);
  });

  it('recusa parcela inválida vinda do modelo', () => {
    expect(expandirParcelamento('LOJA', '2026-11-02', { numero: 0, total: 10 })).toEqual([]);
    expect(expandirParcelamento('LOJA', '2026-11-02', { numero: 5, total: 2 })).toEqual([]);
  });

  it('dá nome à compra quando a descrição é só o marcador', () => {
    const linhas = expandirParcelamento('2/3', '2026-11-02', { numero: 2, total: 3 });
    expect(linhas[0].titulo).toBe('Compra parcelada (2/3)');
  });
});
