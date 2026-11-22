import { describe, it, expect } from 'vitest';
import { calcularSobraDoMes, type TotaisDoMes } from './sobra-do-mes';

/**
 * Estes testes exercitam a função REAL que a Visão Geral usa. O helper abaixo
 * só soma uma lista de lançamentos nos totais que a página soma — as
 * categorias que ele separa são as mesmas de `app/page.tsx` (Contas Fixas,
 * gargalo = Variáveis/Cartões/Cartões de Crédito, Investimentos).
 */
interface Tx { type: 'income' | 'expense'; category: string; amount: number }

const GARGALO = ['Variáveis', 'Cartões', 'Cartões de Crédito'];

function totaisDe(txs: Tx[]): TotaisDoMes {
  const soma = (f: (t: Tx) => boolean) => txs.filter(f).reduce((a, t) => a + t.amount, 0);
  return {
    totalIncome: soma(t => t.type === 'income'),
    totalExpense: soma(t => t.type === 'expense'),
    rendaLiquida: soma(t => t.type === 'income' && t.category !== 'Investimentos'),
    custosFixos: soma(t => t.type === 'expense' && t.category === 'Contas Fixas'),
    gargalo: soma(t => t.type === 'expense' && GARGALO.includes(t.category)),
    aportes: soma(t => t.type === 'expense' && t.category === 'Investimentos'),
    resgates: soma(t => t.type === 'income' && t.category === 'Investimentos'),
  };
}

const c = (reais: number) => Math.round(reais * 100);

/** A identidade e o fechamento da divisão, em centavos inteiros. */
function conferir(txs: Tx[]) {
  const r = calcularSobraDoMes(totaisDe(txs));
  expect(c(r.sobra)).toBe(c(r.guardado) + c(r.livre));
  expect(c(r.custosFixos) + c(r.gargalo) + c(r.outros) + c(r.guardado) + c(r.livre)).toBe(c(r.rendaLiquida));
  return r;
}

describe('calcularSobraDoMes', () => {
  it('gasto fora dos dois grupos: o número grande o desconta', () => {
    const r = conferir([
      { type: 'income', category: 'Salário', amount: 5000 },
      { type: 'expense', category: 'Contas Fixas', amount: 1800 },
      { type: 'expense', category: 'Cartões', amount: 900 },
      { type: 'expense', category: 'Academia', amount: 400 },
    ]);
    expect(r.outros).toBe(400);
    expect(r.sobra).toBe(1900);
    expect(r.guardado).toBe(0);
    expect(r.livre).toBe(1900);
  });

  it('sem gasto fora dos dois grupos o número é o de sempre (renda − fixos − gargalo)', () => {
    const r = conferir([
      { type: 'income', category: 'Salário', amount: 5000 },
      { type: 'expense', category: 'Contas Fixas', amount: 1800 },
      { type: 'expense', category: 'Cartões', amount: 900 },
      { type: 'expense', category: 'Investimentos', amount: 500 },
    ]);
    expect(r.outros).toBe(0);
    expect(r.sobra).toBe(5000 - 1800 - 900);
    expect(r.guardado).toBe(500);
    expect(r.livre).toBe(1800);
  });

  it('mês de saldo negativo: sobra negativa e a identidade vale com sinal', () => {
    const r = conferir([
      { type: 'income', category: 'Salário', amount: 3000 },
      { type: 'expense', category: 'Contas Fixas', amount: 1800 },
      { type: 'expense', category: 'Cartões de Crédito', amount: 2000 },
      { type: 'expense', category: 'Academia', amount: 400 },
    ]);
    expect(r.sobra).toBe(-1200);
    expect(r.livre).toBe(-1200);
    expect(r.guardado).toBe(0);
  });

  it('saldo negativo COM aporte: sobra ainda positiva, livre negativo, e fecha', () => {
    const r = conferir([
      { type: 'income', category: 'Salário', amount: 1000 },
      { type: 'expense', category: 'Contas Fixas', amount: 800 },
      { type: 'expense', category: 'Investimentos', amount: 500 },
    ]);
    expect(r.sobra).toBe(200);
    expect(r.guardado).toBe(500);
    expect(r.livre).toBe(-300);
  });

  it('resgate maior que o aporte deixa guardado negativo, e a identidade segue valendo', () => {
    const r = conferir([
      { type: 'income', category: 'Salário', amount: 5000 },
      { type: 'income', category: 'Investimentos', amount: 3800 },
      { type: 'expense', category: 'Investimentos', amount: 500 },
      { type: 'expense', category: 'Contas Fixas', amount: 1800 },
      { type: 'expense', category: 'Academia', amount: 300 },
    ]);
    expect(r.guardado).toBe(-3300);
    expect(r.livre).toBe(6200);
    expect(r.sobra).toBe(2900);
    // O resgate não é renda: a renda líquida segue sendo só o salário.
    expect(r.rendaLiquida).toBe(5000);
  });

  it('resíduo de ponto flutuante não vira "outros" fantasma', () => {
    const r = conferir([
      { type: 'income', category: 'Salário', amount: 1000.1 },
      { type: 'expense', category: 'Contas Fixas', amount: 0.1 },
      { type: 'expense', category: 'Cartões', amount: 0.2 },
      { type: 'expense', category: 'Variáveis', amount: 0.3 },
      { type: 'expense', category: 'Investimentos', amount: 0.7 },
    ]);
    expect(r.outros).toBe(0);
  });

  it('mês vazio e valores não finitos viram zero', () => {
    const vazio = calcularSobraDoMes(totaisDe([]));
    expect(vazio).toEqual({ rendaLiquida: 0, custosFixos: 0, gargalo: 0, outros: 0, guardado: 0, livre: 0, sobra: 0 });
    const ruim = calcularSobraDoMes({ ...totaisDe([]), totalExpense: NaN, rendaLiquida: Infinity });
    expect(Number.isFinite(ruim.sobra)).toBe(true);
  });

  it('a identidade vale em 300 meses sintéticos, de todos os formatos', () => {
    // LCG determinístico: o teste não pode ser flaky.
    let seed = 12345;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const valor = () => Math.round(rnd() * 500000) / 100;
    const categorias = ['Contas Fixas', 'Variáveis', 'Cartões', 'Cartões de Crédito', 'Investimentos', 'Academia', 'Outros'];

    for (let i = 0; i < 300; i++) {
      const txs: Tx[] = [];
      const n = 1 + Math.floor(rnd() * 12);
      for (let j = 0; j < n; j++) {
        const type = rnd() < 0.3 ? 'income' : 'expense';
        const category = type === 'income' && rnd() < 0.7 ? 'Salário' : categorias[Math.floor(rnd() * categorias.length)];
        txs.push({ type, category, amount: valor() });
      }
      conferir(txs);
    }
  });
});
