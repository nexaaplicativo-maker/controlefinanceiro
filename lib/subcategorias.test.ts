import { describe, it, expect } from 'vitest';
import {
  SUBCATEGORIAS,
  normalizarSubcategoria,
  subcategoriaSugerida,
  vocabularioParaPrompt,
  resumoPorSubcategoria,
  NAO_CLASSIFICADO,
} from './subcategorias';

/**
 * O que estes testes protegem: a subcategoria existe para filtrar uma fatura
 * importada. Se o valor gravado variar ("Uber", "uber", "Transporte/App"), o
 * filtro não agrupa nada e o recurso não serve para o que foi pedido.
 */

describe('normalizarSubcategoria', () => {
  it('aceita o valor canônico como está', () => {
    for (const s of SUBCATEGORIAS) {
      expect(normalizarSubcategoria(s)).toBe(s);
    }
  });

  it('ignora caixa e acento, que é como a IA erra mais', () => {
    expect(normalizarSubcategoria('alimentacao')).toBe('Alimentação');
    expect(normalizarSubcategoria('ALIMENTAÇÃO')).toBe('Alimentação');
    expect(normalizarSubcategoria('Combustivel')).toBe('Combustível');
    expect(normalizarSubcategoria('vestuario')).toBe('Vestuário');
  });

  it('resolve sinônimo de estabelecimento', () => {
    expect(normalizarSubcategoria('Uber')).toBe('Transporte');
    expect(normalizarSubcategoria('iFood')).toBe('Alimentação');
    expect(normalizarSubcategoria('Netflix')).toBe('Assinaturas');
    expect(normalizarSubcategoria('posto')).toBe('Combustível');
    expect(normalizarSubcategoria('farmácia')).toBe('Saúde');
  });

  it('resolve termo em inglês', () => {
    expect(normalizarSubcategoria('groceries')).toBe('Mercado');
    expect(normalizarSubcategoria('transport')).toBe('Transporte');
  });

  it('resolve por palavra quando vem frase', () => {
    expect(normalizarSubcategoria('Transporte urbano')).toBe('Transporte');
    expect(normalizarSubcategoria('conta de luz')).toBe('Moradia');
  });

  it('casa palavra inteira, não pedaço', () => {
    // 'gas' é sinônimo de Moradia, mas não deve casar dentro de 'gasto'.
    expect(normalizarSubcategoria('gasto')).toBeNull();
  });

  it('devolve null quando não reconhece, em vez de chutar Outros', () => {
    // A distinção importa: null = não classificado, e quem chama decide se
    // tenta o palpite local. Chutar 'Outros' aqui apagaria essa informação.
    expect(normalizarSubcategoria('xyzabc')).toBeNull();
    expect(normalizarSubcategoria('')).toBeNull();
    expect(normalizarSubcategoria('   ')).toBeNull();
    expect(normalizarSubcategoria(null)).toBeNull();
    expect(normalizarSubcategoria(undefined)).toBeNull();
  });

  it('não quebra com pontuação ou barra', () => {
    expect(normalizarSubcategoria('Transporte/App')).toBe('Transporte');
    expect(normalizarSubcategoria('  Mercado.  ')).toBe('Mercado');
  });

  it('devolve Outros apenas quando o valor realmente diz isso', () => {
    expect(normalizarSubcategoria('diversos')).toBe('Outros');
    expect(normalizarSubcategoria('Outros')).toBe('Outros');
  });
});

describe('subcategoriaSugerida', () => {
  it('acerta descrições típicas de fatura de cartão', () => {
    expect(subcategoriaSugerida('UBER *TRIP 123')).toBe('Transporte');
    expect(subcategoriaSugerida('IFOOD CLUB')).toBe('Alimentação');
    expect(subcategoriaSugerida('NETFLIX.COM')).toBe('Assinaturas');
    expect(subcategoriaSugerida('DROGARIA SP FARMACIA')).toBe('Saúde');
  });

  it('cai em Outros quando não há pista, em vez de inventar', () => {
    expect(subcategoriaSugerida('PAG*ABC12345')).toBe('Outros');
    expect(subcategoriaSugerida('')).toBe('Outros');
    expect(subcategoriaSugerida(null)).toBe('Outros');
  });
});

describe('resumoPorSubcategoria', () => {
  const tx = (p: any) => ({ type: 'expense', amount: 100, ...p });

  it('soma por subcategoria, do maior para o menor', () => {
    const r = resumoPorSubcategoria([
      tx({ subcategoria: 'Transporte', amount: 30 }),
      tx({ subcategoria: 'Mercado', amount: 200 }),
      tx({ subcategoria: 'Transporte', amount: 20 }),
    ]);
    expect(r.map((x) => x.rotulo)).toEqual(['Mercado', 'Transporte']);
    expect(r[0].total).toBe(200);
    expect(r[1].total).toBe(50);
    expect(r[1].itens).toBe(2);
  });

  it('calcula percentual sobre o total de despesa', () => {
    const r = resumoPorSubcategoria([
      tx({ subcategoria: 'Mercado', amount: 75 }),
      tx({ subcategoria: 'Lazer', amount: 25 }),
    ]);
    expect(r[0].percentual).toBe(75);
    expect(r[1].percentual).toBe(25);
  });

  it('ignora receita: ela não tem onde foi gasto', () => {
    const r = resumoPorSubcategoria([
      tx({ subcategoria: 'Mercado', amount: 100 }),
      { type: 'income', amount: 5000, subcategoria: 'Mercado' },
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].total).toBe(100);
    expect(r[0].percentual).toBe(100);
  });

  it('agrupa o que não tem subcategoria em vez de esconder', () => {
    const r = resumoPorSubcategoria([
      tx({ subcategoria: null, amount: 40 }),
      tx({ subcategoria: undefined, amount: 10 }),
      tx({ subcategoria: 'Mercado', amount: 50 }),
    ]);
    const naoClass = r.find((x) => x.rotulo === NAO_CLASSIFICADO);
    expect(naoClass?.total).toBe(50);
    expect(naoClass?.itens).toBe(2);
  });

  it('normaliza antes de agrupar: Uber e Transporte são o mesmo grupo', () => {
    const r = resumoPorSubcategoria([
      tx({ subcategoria: 'Uber', amount: 30 }),
      tx({ subcategoria: 'transporte', amount: 70 }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].rotulo).toBe('Transporte');
    expect(r[0].total).toBe(100);
  });

  it('descarta valor inválido ou não positivo', () => {
    const r = resumoPorSubcategoria([
      tx({ subcategoria: 'Mercado', amount: 0 }),
      tx({ subcategoria: 'Mercado', amount: -5 }),
      tx({ subcategoria: 'Mercado', amount: NaN }),
      tx({ subcategoria: 'Mercado', amount: 'abc' }),
      tx({ subcategoria: 'Mercado', amount: 10 }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].total).toBe(10);
    expect(r[0].itens).toBe(1);
  });

  it('devolve lista vazia sem despesa, sem dividir por zero', () => {
    expect(resumoPorSubcategoria([])).toEqual([]);
    expect(resumoPorSubcategoria([{ type: 'income', amount: 10 }])).toEqual([]);
  });
});

describe('vocabularioParaPrompt', () => {
  it('lista todas as subcategorias entre aspas', () => {
    const texto = vocabularioParaPrompt();
    for (const s of SUBCATEGORIAS) {
      expect(texto).toContain(`"${s}"`);
    }
  });
});
