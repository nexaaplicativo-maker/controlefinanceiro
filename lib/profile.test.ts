import { describe, it, expect } from 'vitest';
import {
  getReferenceIncome,
  getMonthlyCost,
  getGargaloThresholds,
  getReserveTargets,
  computeStage,
  getProfileInsights,
  getStageLadder,
  STAGES,
  type FinancialProfile,
} from './profile';

/**
 * Estes testes TRAVAM o comportamento atual dos cálculos financeiros.
 *
 * Não são exploratórios: cada um corresponde a uma decisão de produto que
 * custou caro para chegar até aqui, e várias delas nasceram de bug real em
 * produção. Se uma destas expectativas quebrar numa fase futura, a mudança
 * precisa ser intencional e declarada — não efeito colateral.
 */

const perfilBase: FinancialProfile = {
  monthly_income: 5000,
  income_type: 'fixa',
  strategy: '50_30_20',
  has_debt: false,
  main_goal: 'reserva',
  onboarded_at: '2026-01-01T00:00:00Z',
};

/** Gera N meses de lançamentos iguais, do mês mais recente para trás. */
function meses(n: number, tx: { type: string; category: string; amount: number }) {
  return Array.from({ length: n }, (_, i) => ({
    ...tx,
    date: `2026-0${9 - i}-10`,
  }));
}

describe('getReferenceIncome', () => {
  it('usa a mediana das receitas observadas, não a média', () => {
    // Mediana ignora o 13º atípico; média seria 7.000 e superestimaria a renda.
    const tx = [
      { type: 'income', category: 'Salário', amount: 5000, date: '2026-07-05' },
      { type: 'income', category: 'Salário', amount: 5000, date: '2026-08-05' },
      { type: 'income', category: 'Salário', amount: 11000, date: '2026-09-05' },
    ];
    expect(getReferenceIncome(perfilBase, tx)).toBe(5000);
  });

  it('exclui resgate de investimento da renda', () => {
    // Venda de ativo é patrimônio mudando de lugar, não renda recorrente.
    // Incluí-la inflava o denominador de todos os percentuais do app.
    const tx = [
      { type: 'income', category: 'Salário', amount: 3000, date: '2026-09-05' },
      { type: 'income', category: 'Investimentos', amount: 50000, date: '2026-09-06' },
    ];
    expect(getReferenceIncome(perfilBase, tx)).toBe(3000);
  });

  it('cai no valor declarado quando não há histórico', () => {
    expect(getReferenceIncome(perfilBase, [])).toBe(5000);
  });

  it('devolve 0 sem histórico e sem perfil', () => {
    expect(getReferenceIncome(null, [])).toBe(0);
  });
});

describe('getMonthlyCost', () => {
  it('exclui aporte do custo de vida', () => {
    // Aporte sai da conta, mas não é consumo: contá-lo inflaria a meta de
    // reserva, que é calculada em múltiplos do custo de vida.
    const tx = [
      { type: 'expense', category: 'Contas Fixas', amount: 2000, date: '2026-09-05' },
      { type: 'expense', category: 'Investimentos', amount: 8000, date: '2026-09-06' },
    ];
    expect(getMonthlyCost(tx, 5000)).toBe(2000);
  });

  it('estima 70% da renda quando não há despesa lançada', () => {
    expect(getMonthlyCost([], 5000)).toBe(3500);
  });
});

describe('getGargaloThresholds', () => {
  it('deriva o limite da estratégia escolhida', () => {
    expect(getGargaloThresholds({ ...perfilBase, strategy: '50_30_20' }).warn).toBe(30);
    expect(getGargaloThresholds({ ...perfilBase, strategy: '40_20_40' }).warn).toBe(20);
  });

  it('dá folga para renda variável', () => {
    const fixa = getGargaloThresholds({ ...perfilBase, income_type: 'fixa' });
    const variavel = getGargaloThresholds({ ...perfilBase, income_type: 'variavel' });
    expect(variavel.warn).toBe(fixa.warn + 5);
  });

  it('usa o padrão conservador sem perfil', () => {
    expect(getGargaloThresholds(null).warn).toBe(30);
  });
});

describe('getReserveTargets', () => {
  it('calcula sobre custo de vida, não sobre renda', () => {
    // Quem ganha muito e gasta pouco precisa de reserva menor.
    const { minimum, ideal } = getReserveTargets(perfilBase, 4000);
    expect(minimum).toBe(12000); // 3 meses
    expect(ideal).toBe(24000);   // 6 meses
  });

  it('dobra os múltiplos para renda variável', () => {
    const { minimum, ideal } = getReserveTargets(
      { ...perfilBase, income_type: 'variavel' }, 4000,
    );
    expect(minimum).toBe(24000); // 6 meses
    expect(ideal).toBe(48000);   // 12 meses
  });

  it('não inventa meta sem custo de vida apurado', () => {
    expect(getReserveTargets(perfilBase, 0)).toEqual({ minimum: 0, ideal: 0 });
  });
});

describe('computeStage', () => {
  const base = {
    profile: perfilBase,
    referenceIncome: 5000,
    monthlyCost: 3000,
    monthIncome: 5000,
    monthExpense: 3000,
    gargaloPercent: 20,
    reserveAmount: 0,
    investedTotal: 0,
    reserveIdeal: 18000,
  };

  it('emergência tem precedência sobre reserva formada', () => {
    // Não adianta parabenizar quem tem reserva mas paga 15% a.m. de rotativo.
    const stage = computeStage({
      ...base,
      profile: { ...perfilBase, has_debt: true },
      reserveAmount: 999999,
    });
    expect(stage.id).toBe('emergencia');
  });

  it('entra em emergência gastando mais do que ganha', () => {
    expect(computeStage({ ...base, monthExpense: 5000 }).id).toBe('emergencia');
  });

  it('entra em emergência com gargalo acima de 50%', () => {
    expect(computeStage({ ...base, gargaloPercent: 51 }).id).toBe('emergencia');
  });

  it('estabilidade quando falta o primeiro mês de colchão', () => {
    expect(computeStage({ ...base, reserveAmount: 500 }).id).toBe('estabilidade');
  });

  it('reserva quando tem colchão mas não completou', () => {
    expect(computeStage({ ...base, reserveAmount: 9000 }).id).toBe('reserva');
  });

  it('acumulação com a reserva ideal completa', () => {
    expect(computeStage({ ...base, reserveAmount: 18000 }).id).toBe('acumulacao');
  });

  // ATUALIZADO em F2: o alvo era 92x o custo mensal, com o código dizendo que
  // isso era a regra dos 4%. Não era — 4% ao ano pede 12/0,04 = 300 meses de
  // despesa. 92 meses equivalem a sacar 13% ao ano. O teste antigo congelava
  // o número errado, então mudou junto com a regra.
  it('independência com patrimônio de 300x o custo mensal', () => {
    const stage = computeStage({
      ...base, reserveAmount: 18000, investedTotal: 3000 * 300,
    });
    expect(stage.id).toBe('independencia');
  });

  it('o antigo alvo de 92x agora é apenas acumulação', () => {
    // Reserva completa (18.000) para o fluxo passar de "estabilidade"; o
    // patrimônio total fecha em 276.000, que é 92 × 3.000.
    const stage = computeStage({
      ...base, reserveAmount: 18000, investedTotal: 3000 * 92 - 18000,
    });
    expect(stage.id).toBe('acumulacao');
  });
});

describe('getProfileInsights', () => {
  const chamar = (over: Partial<Parameters<typeof getProfileInsights>[0]> = {}) =>
    getProfileInsights({
      profile: perfilBase,
      allTransactions: meses(3, { type: 'expense', category: 'Contas Fixas', amount: 3000 }),
      monthIncome: 5000,
      monthExpense: 3000,
      monthGargalo: 1000,
      reserveAmount: 0,
      ...over,
    });

  it('não sugere aporte em Modo Emergência', () => {
    const i = chamar({ profile: { ...perfilBase, has_debt: true } });
    expect(i.stage.id).toBe('emergencia');
    expect(i.shouldSuggestContribution).toBe(false);
  });

  it('sugere aporte conforme a estratégia', () => {
    // 50/30/20 sobre renda de referência 5.000 = 1.000
    expect(chamar().suggestedContribution).toBe(1000);
  });

  it('prefere o valor de mercado das posições à soma dos aportes', () => {
    const i = chamar({
      allTransactions: [
        { type: 'expense', category: 'Investimentos', amount: 3800, date: '2026-09-10' },
      ],
      positions: [{ invested_amount: 3800, current_value: 4200 }],
    });
    expect(i.positionsValue).toBe(4200);
    expect(i.investedTotal).toBe(4200);   // mercado, não aporte
    expect(i.contributedTotal).toBe(3800);
    expect(i.positionsReturn).toBe(400);
  });

  it('cai nos aportes quando não há posição cadastrada', () => {
    const i = chamar({
      allTransactions: [
        { type: 'expense', category: 'Investimentos', amount: 3800, date: '2026-09-10' },
      ],
    });
    expect(i.positionsValue).toBeNull();
    expect(i.investedTotal).toBe(3800);
  });

  it('trata resgate como redução do patrimônio, não como renda', () => {
    const i = chamar({
      allTransactions: [
        { type: 'expense', category: 'Investimentos', amount: 5000, date: '2026-08-10' },
        { type: 'income', category: 'Investimentos', amount: 2000, date: '2026-09-10' },
      ],
    });
    expect(i.contributedTotal).toBe(3000); // 5000 aportado - 2000 resgatado
  });

  it('marca onboarding pendente sem onboarded_at', () => {
    expect(chamar({ profile: { ...perfilBase, onboarded_at: null } }).needsOnboarding).toBe(true);
  });
});

describe('transição has_debt -> tabela debts', () => {
  const comDivida = { ...perfilBase, has_debt: true };
  const semDivida = { ...perfilBase, has_debt: false };

  const chamar = (profile: FinancialProfile, debts?: any[]) =>
    getProfileInsights({
      profile,
      allTransactions: meses(3, { type: 'expense', category: 'Contas Fixas', amount: 3000 }),
      monthIncome: 5000,
      monthExpense: 3000,
      monthGargalo: 500,
      reserveAmount: 20000,
      debts,
    });

  it('sem dívida cadastrada, o booleano do onboarding ainda manda', () => {
    // Senão quem respondeu "sim" e nunca cadastrou sairia da emergência sozinho.
    expect(chamar(comDivida).stage.id).toBe('emergencia');
    expect(chamar(comDivida, []).stage.id).toBe('emergencia');
  });

  it('com dívida cara cadastrada, o saldo manda', () => {
    const i = chamar(semDivida, [
      { current_balance: 5000, monthly_rate: 0.14, status: 'ativa' },
    ]);
    // Respondeu "não tenho" no onboarding, mas cadastrou rotativo: emergência.
    expect(i.stage.id).toBe('emergencia');
  });

  it('dívida barata cadastrada não prende no Estágio 1', () => {
    // Consignado a 1,8% a.m. não compete com investimento: não bloqueia.
    const i = chamar(comDivida, [
      { current_balance: 20000, monthly_rate: 0.018, status: 'ativa' },
    ]);
    expect(i.stage.id).not.toBe('emergencia');
  });

  it('dívida quitada não conta', () => {
    const i = chamar(comDivida, [
      { current_balance: 5000, monthly_rate: 0.14, status: 'quitada' },
    ]);
    // Só há dívida quitada: cai de volta no booleano, que ainda diz "sim".
    expect(i.stage.id).toBe('emergencia');
  });

  it('zerar a dívida cara cadastrada libera o estágio', () => {
    const i = chamar(comDivida, [
      { current_balance: 0, monthly_rate: 0.14, status: 'ativa' },
    ]);
    expect(i.stage.id).not.toBe('emergencia');
    expect(i.shouldSuggestContribution).toBe(true);
  });
});

describe('getStageLadder', () => {
  it('marca anteriores como concluídos, atual e bloqueados', () => {
    const insights = getProfileInsights({
      profile: perfilBase,
      allTransactions: meses(3, { type: 'expense', category: 'Contas Fixas', amount: 3000 }),
      monthIncome: 5000,
      monthExpense: 3000,
      monthGargalo: 500,
      reserveAmount: 5000,
    });
    const ladder = getStageLadder(insights);

    expect(ladder).toHaveLength(5);
    const atual = ladder.find(s => s.status === 'current');
    expect(atual?.stage.id).toBe(insights.stage.id);

    const niveis = ladder.map(s => s.stage.level);
    expect(niveis).toEqual([1, 2, 3, 4, 5]);

    for (const step of ladder) {
      if (step.stage.level < insights.stage.level) expect(step.status).toBe('done');
      if (step.stage.level > insights.stage.level) expect(step.status).toBe('locked');
    }
  });

  it('não promete valores quando não há custo de vida apurado', () => {
    // Conta nova: a escada mostrava "faltam R$ 0,00" em todos os degraus.
    const insights = getProfileInsights({
      profile: { ...perfilBase, monthly_income: 0 },
      allTransactions: [],
      monthIncome: 0,
      monthExpense: 0,
      monthGargalo: 0,
      reserveAmount: 0,
    });
    const ladder = getStageLadder(insights);
    for (const step of ladder) {
      expect(step.target).toBeNull();
      expect(step.remaining).toBeNull();
    }
  });
});

describe('STAGES', () => {
  it('tem os 5 estágios em ordem, sem texto vazio', () => {
    const ids = Object.values(STAGES).sort((a, b) => a.level - b.level).map(s => s.id);
    expect(ids).toEqual(['emergencia', 'estabilidade', 'reserva', 'acumulacao', 'independencia']);
    for (const s of Object.values(STAGES)) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.priority.length).toBeGreaterThan(0);
    }
  });
});
