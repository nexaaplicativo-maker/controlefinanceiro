/**
 * F2 — Independência financeira pela regra dos 4%.
 *
 * O código classificava como independente quem cobria 92 meses de custo de
 * vida, com o comentário dizendo "regra dos 4%". A regra dos 4% pede 25 anos
 * de despesa, ou seja 300 meses. 92 meses equivalem a sacar 13% ao ano.
 */

import { describe, it, expect } from 'vitest';
import {
  TAXA_RETIRADA_SEGURA,
  MESES_PARA_INDEPENDENCIA,
  MESES_INDEPENDENCIA_CONSERVADOR,
} from './constantes-financeiras';
import { computeStage, getProfileInsights, type FinancialProfile } from './profile';

const perfil = (over: Partial<FinancialProfile> = {}): FinancialProfile => ({
  monthly_income: null,
  income_type: 'fixa',
  strategy: '50_30_20',
  has_debt: null,
  main_goal: null,
  onboarded_at: '2026-01-01',
  ...over,
});

describe('constantes da independência', () => {
  it('300 meses = 25 anos de despesa, que é a regra dos 4%', () => {
    expect(TAXA_RETIRADA_SEGURA).toBe(0.04);
    expect(MESES_PARA_INDEPENDENCIA).toBe(300);
  });

  it('o cenário conservador de 3,5% pede 343 meses', () => {
    expect(MESES_INDEPENDENCIA_CONSERVADOR).toBe(343);
  });
});

describe('computeStage: alvo da independência', () => {
  const base = {
    profile: perfil(),
    referenceIncome: 10_000,
    monthlyCost: 4_000,
    monthIncome: 10_000,
    monthExpense: 5_000,
    gargaloPercent: 10,
    reserveIdeal: 24_000,
    hasRegisteredDebts: false,
    investedTotal: 0,
  };

  it('368.000 (o antigo 92x) NÃO é mais independência', () => {
    expect(computeStage({ ...base, reserveAmount: 368_000 }).id).toBe('acumulacao');
  });

  it('1.200.000 (= 300 x 4.000) é independência', () => {
    expect(computeStage({ ...base, reserveAmount: 1_200_000 }).id).toBe('independencia');
  });

  it('um real abaixo do alvo ainda é acumulação', () => {
    expect(computeStage({ ...base, reserveAmount: 1_199_999 }).id).toBe('acumulacao');
  });

  it('sem custo de vida conhecido, não classifica independência', () => {
    // Patrimônio alto não basta: sem custo não há alvo, e 0 × 300 = 0 faria
    // qualquer pessoa passar.
    expect(computeStage({ ...base, monthlyCost: 0, reserveAmount: 5_000_000 }).id)
      .not.toBe('independencia');
  });
});

describe('progresso e renda passiva', () => {
  const comum = {
    hoje: "2026-11-15",
    profile: perfil(),
    monthIncome: 10_000,
    monthExpense: 4_000,
    monthGargalo: 1_000,
  };

  /** Doze meses de custo 4.000 e renda 10.000, para a mediana ser estável. */
  const historico = Array.from({ length: 12 }, (_, i) => {
    const mes = String(i + 1).padStart(2, '0');
    return [
      { type: 'income', category: 'Salário', amount: 10_000, date: `2026-${mes}-05` },
      { type: 'expense', category: 'Contas Fixas', amount: 4_000, date: `2026-${mes}-10` },
    ];
  }).flat();

  it('368.000 com custo de 4.000 é 30,7% do caminho', () => {
    const r = getProfileInsights({ ...comum, allTransactions: historico, reserveAmount: 368_000 });
    expect(r.independenciaAlvo).toBe(1_200_000);
    expect(r.independenciaProgresso).toBeCloseTo(0.3067, 4);
  });

  it('a renda passiva estimada é o patrimônio x 4% ao ano, por mês', () => {
    const r = getProfileInsights({ ...comum, allTransactions: historico, reserveAmount: 368_000 });
    // 368.000 × 0,04 / 12 = 1.226,67
    expect(r.rendaPassivaEstimada).toBeCloseTo(1_226.67, 2);
  });

  it('no alvo, a renda passiva cobre o custo de vida', () => {
    const r = getProfileInsights({ ...comum, allTransactions: historico, reserveAmount: 1_200_000 });
    expect(r.independenciaProgresso).toBe(1);
    expect(r.rendaPassivaEstimada).toBeCloseTo(4_000, 2);
  });

  it('sem custo de vida, o progresso é null em vez de dividir por zero', () => {
    const r = getProfileInsights({
      ...comum,
      allTransactions: [],
      monthIncome: 0,
      monthExpense: 0,
      monthGargalo: 0,
      reserveAmount: 1_000,
    });
    expect(r.independenciaAlvo).toBeNull();
    expect(r.independenciaProgresso).toBeNull();
  });
});
