import { describe, it, expect } from 'vitest';
import { normalizarItensExtraidos } from './extracao';

/**
 * O que estes testes protegem: a IA desobedece o prompt. Se uma compra de
 * fatura entrar como "Contas Fixas", ela some do controle do cartão e infla o
 * custo fixo do mês — o número que diz quanto a pessoa precisa ganhar.
 */

describe('normalizarItensExtraidos — fatura', () => {
  const fatura = [
    { description: 'UBER TRIP', amount: 24.9, category: 'Variáveis', subcategoria: 'Transporte', type: 'expense', origem: 'fatura' },
    { description: 'NETFLIX', amount: 44.9, category: 'Contas Fixas', subcategoria: 'Assinaturas', type: 'expense', origem: 'fatura' },
  ];

  it('força Cartões em toda linha, mesmo na que a IA chamou de fixa', () => {
    const r = normalizarItensExtraidos(fatura);
    expect(r.map((i) => i.category)).toEqual(['Cartões', 'Cartões']);
  });

  it('preserva o que cada compra é na subcategoria', () => {
    const r = normalizarItensExtraidos(fatura);
    expect(r.map((i) => i.subcategoria)).toEqual(['Transporte', 'Assinaturas']);
  });

  it('basta um item marcado como fatura para valer no documento todo', () => {
    // O modelo às vezes só marca as primeiras linhas.
    const r = normalizarItensExtraidos([
      { description: 'UBER', amount: 20, category: 'Variáveis', type: 'expense', origem: 'fatura' },
      { description: 'ALUGUEL', amount: 1500, category: 'Contas Fixas', type: 'expense' },
    ]);
    expect(r.map((i) => i.category)).toEqual(['Cartões', 'Cartões']);
  });

  it('não transforma receita em gasto de cartão', () => {
    const r = normalizarItensExtraidos([
      { description: 'ESTORNO', amount: 50, category: 'Renda Extra', type: 'income', origem: 'fatura' },
    ]);
    expect(r[0].category).toBe('Renda Extra');
  });
});

describe('normalizarItensExtraidos — documento avulso', () => {
  it('mantém a categoria que a IA escolheu', () => {
    const r = normalizarItensExtraidos([
      { description: 'Conta de luz', amount: 200, category: 'Contas Fixas', type: 'expense', origem: 'avulso' },
    ]);
    expect(r[0].category).toBe('Contas Fixas');
  });

  it('troca categoria inventada por Variáveis', () => {
    const r = normalizarItensExtraidos([
      { description: 'Padaria', amount: 20, category: 'Supermercado', type: 'expense' },
    ]);
    expect(r[0].category).toBe('Variáveis');
  });

  it('deduz a subcategoria pela descrição quando a IA não manda', () => {
    const r = normalizarItensExtraidos([
      { description: 'POSTO IPIRANGA', amount: 150, category: 'Variáveis', type: 'expense' },
    ]);
    expect(r[0].subcategoria).toBe('Combustível');
  });

  it('normaliza subcategoria fora do vocabulário', () => {
    const r = normalizarItensExtraidos([
      { description: 'Corrida', amount: 20, category: 'Variáveis', subcategoria: 'Uber', type: 'expense' },
    ]);
    expect(r[0].subcategoria).toBe('Transporte');
  });

  it('receita não recebe subcategoria de gasto', () => {
    const r = normalizarItensExtraidos([
      { description: 'PIX Recebido - Mercado Silva', amount: 500, category: 'Renda Extra', type: 'income' },
    ]);
    expect(r[0].subcategoria).toBe('Outros');
  });
});

describe('normalizarItensExtraidos — entradas estranhas', () => {
  it('aceita objeto único, não só lista', () => {
    const r = normalizarItensExtraidos({ description: 'UBER', amount: 20, type: 'expense' });
    expect(r).toHaveLength(1);
    expect(r[0].subcategoria).toBe('Transporte');
  });

  it('devolve lista vazia para null, string e número', () => {
    expect(normalizarItensExtraidos(null)).toEqual([]);
    expect(normalizarItensExtraidos('erro')).toEqual([]);
    expect(normalizarItensExtraidos(42)).toEqual([]);
  });

  it('não deixa passar o campo origem para o banco', () => {
    const r: any = normalizarItensExtraidos([
      { description: 'UBER', amount: 20, type: 'expense', origem: 'fatura' },
    ]);
    expect(r[0].origem).toBeUndefined();
  });
});
