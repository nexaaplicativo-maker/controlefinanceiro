/**
 * F1 — O aporte à reserva não pode ser contado duas vezes.
 *
 * O botão "Poupar" grava a mesma quantia em dois lugares, e os dois estão
 * CERTOS isoladamente:
 *   - uma despesa em Investimentos, que faz o saldo em conta cair;
 *   - a soma em goals.current_amount, que faz a reserva subir.
 *
 * O erro estava em `patrimonio = reserveAmount + investedTotal`, com
 * `investedTotal` derivado daquela mesma transação. O dinheiro aparecia
 * inteiro nos dois termos da soma.
 */

import { describe, it, expect } from 'vitest';
import { getProfileInsights, type FinancialProfile } from './profile';
import { TITULO_APORTE_RESERVA } from './constantes-financeiras';

const perfil = (over: Partial<FinancialProfile> = {}): FinancialProfile => ({
  monthly_income: null,
  income_type: 'fixa',
  strategy: '50_30_20',
  has_debt: null,
  main_goal: null,
  onboarded_at: '2026-01-01',
  ...over,
});

const chamar = (over: Partial<Parameters<typeof getProfileInsights>[0]> = {}) =>
  getProfileInsights({
    hoje: "2026-11-15",
    profile: perfil(),
    allTransactions: [],
    monthIncome: 5_000,
    monthExpense: 1_000,
    monthGargalo: 0,
    reserveAmount: 0,
    ...over,
  });

describe('aporte à reserva no patrimônio', () => {
  it('o aporte do botão Poupar não entra em investido', () => {
    const r = chamar({
      allTransactions: [
        { type: 'expense', category: 'Investimentos', amount: 1_000, date: '2026-10-06', title: TITULO_APORTE_RESERVA },
      ],
      reserveAmount: 1_000,
    });

    // O dinheiro está na reserva, e só lá.
    expect(r.reserveAmount).toBe(1_000);
    expect(r.contributedTotal).toBe(0);
    expect(r.investedTotal).toBe(0);
    expect(r.patrimonio).toBe(1_000);
  });

  it('cinco aportes de 1.000 dão 5.000 de patrimônio, não 10.000', () => {
    const txs = Array.from({ length: 5 }, (_, i) => ({
      type: 'expense',
      category: 'Investimentos',
      amount: 1_000,
      date: `2026-0${i + 1}-06`,
      title: TITULO_APORTE_RESERVA,
    }));

    expect(chamar({ allTransactions: txs, reserveAmount: 5_000 }).patrimonio).toBe(5_000);
  });

  it('aporte de investimento comum continua contando', () => {
    const r = chamar({
      allTransactions: [
        { type: 'expense', category: 'Investimentos', amount: 2_000, date: '2026-10-06', title: 'Compra de CDB' },
      ],
      reserveAmount: 0,
    });

    expect(r.contributedTotal).toBe(2_000);
    expect(r.patrimonio).toBe(2_000);
  });

  it('separa os dois quando existem juntos', () => {
    const r = chamar({
      allTransactions: [
        { type: 'expense', category: 'Investimentos', amount: 1_000, date: '2026-10-06', title: TITULO_APORTE_RESERVA },
        { type: 'expense', category: 'Investimentos', amount: 3_000, date: '2026-10-07', title: 'Tesouro Selic' },
      ],
      reserveAmount: 1_000,
    });

    expect(r.contributedTotal).toBe(3_000);
    expect(r.patrimonio).toBe(4_000);
  });

  it('resgate de investimento continua reduzindo o patrimônio', () => {
    const r = chamar({
      allTransactions: [
        { type: 'expense', category: 'Investimentos', amount: 5_000, date: '2026-09-06', title: 'Tesouro Selic' },
        { type: 'income', category: 'Investimentos', amount: 2_000, date: '2026-10-06', title: 'Resgate' },
      ],
      reserveAmount: 0,
    });

    expect(r.contributedTotal).toBe(3_000);
  });

  it('a comparação do título ignora acento e caixa', () => {
    const r = chamar({
      allTransactions: [
        { type: 'expense', category: 'Investimentos', amount: 1_000, date: '2026-10-06', title: 'APORTE - RESERVA DE EMERGENCIA' },
      ],
      reserveAmount: 1_000,
    });

    expect(r.contributedTotal).toBe(0);
  });

  it('posição cadastrada segue substituindo os aportes, sem somar', () => {
    const r = chamar({
      allTransactions: [
        { type: 'expense', category: 'Investimentos', amount: 10_000, date: '2026-10-06', title: 'Ações' },
      ],
      reserveAmount: 2_000,
      positions: [{ invested_amount: 10_000, current_value: 13_000 }],
    });

    expect(r.investedTotal).toBe(13_000);
    expect(r.patrimonio).toBe(15_000);   // reserva + valor de mercado
  });
});
