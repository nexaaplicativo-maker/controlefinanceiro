import { describe, it, expect } from 'vitest';
import {
  SUBCATEGORIAS,
  normalizarSubcategoria,
  subcategoriaSugerida,
  vocabularioParaPrompt,
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

describe('vocabularioParaPrompt', () => {
  it('lista todas as subcategorias entre aspas', () => {
    const texto = vocabularioParaPrompt();
    for (const s of SUBCATEGORIAS) {
      expect(texto).toContain(`"${s}"`);
    }
  });
});
