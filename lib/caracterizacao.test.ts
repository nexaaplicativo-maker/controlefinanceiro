/**
 * Testes de CARACTERIZAÇÃO — Fase 0 da revisão de lógica.
 *
 * Estes testes NÃO afirmam que o comportamento está certo. Eles congelam o
 * comportamento ATUAL, inclusive os defeitos, para que qualquer correção
 * apareça obrigatoriamente no diff dos testes.
 *
 * Cada bloco marcado com [DEFEITO] documenta um comportamento que a revisão
 * pretende mudar. Quando a correção vier, o teste correspondente DEVE falhar —
 * é esse o sinal de que a mudança chegou onde deveria.
 *
 * Nada aqui faz I/O. Todas as funções sob teste são puras.
 */

import { describe, it, expect } from 'vitest';
import {
  getReferenceIncome,
  getMonthlyCost,
  getGargaloThresholds,
  getReserveTargets,
  computeStage,
  getProfileInsights,
  type FinancialProfile,
} from './profile';
import { payoffMonths, simulatePayoff, summarizeDebts, type Debt } from './debt';
import { forecastMonths, upcomingBills, tightWeeks } from './forecast';
import { detectRecurring, breakdownByCategory, detectAnomalies } from './insights-gastos';

const perfil = (over: Partial<FinancialProfile> = {}): FinancialProfile => ({
  monthly_income: null,
  income_type: 'fixa',
  strategy: '50_30_20',
  has_debt: null,
  main_goal: null,
  onboarded_at: '2026-01-01',
  ...over,
});

// ===========================================================================
// A1 — Independência em 92× o custo mensal
// ===========================================================================

describe('[DEFEITO A1] independência dispara em 92x o custo mensal', () => {
  const base = {
    profile: perfil(),
    referenceIncome: 10_000,
    monthlyCost: 4_000,
    monthIncome: 10_000,
    monthExpense: 5_000,
    gargaloPercent: 10,
    reserveIdeal: 24_000,
    hasRegisteredDebts: false,
  };

  it('368.000 (= 92 x 4.000) já é classificado como Independência', () => {
    // Pela regra dos 4% o alvo seria 300 x 4.000 = 1.200.000.
    const stage = computeStage({ ...base, reserveAmount: 368_000, investedTotal: 0 });
    expect(stage.id).toBe('independencia');
  });

  it('um real abaixo de 92x cai para Acumulação', () => {
    const stage = computeStage({ ...base, reserveAmount: 367_999, investedTotal: 0 });
    expect(stage.id).toBe('acumulacao');
  });

  it('o patrimônio é a soma de reserva + investido', () => {
    const stage = computeStage({ ...base, reserveAmount: 200_000, investedTotal: 168_000 });
    expect(stage.id).toBe('independencia');
  });
});

// ===========================================================================
// A2 — Mediana ignora meses sem movimento e inclui o mês corrente
// ===========================================================================

describe('[DEFEITO A2] a mediana da renda pula os meses sem receita', () => {
  it('junho sem receita não vira zero: a mediana sai de 4 meses, não de 5', () => {
    const txs = [
      { type: 'income', category: 'Salário', amount: 3_000, date: '2026-05-10' },
      // Junho teve movimento, mas só despesa — hoje some do cálculo da renda.
      { type: 'expense', category: 'Variáveis', amount: 800, date: '2026-06-10' },
      { type: 'income', category: 'Salário', amount: 4_000, date: '2026-08-10' },
      { type: 'income', category: 'Salário', amount: 5_000, date: '2026-09-10' },
      { type: 'income', category: 'Salário', amount: 3_500, date: '2026-10-10' },
    ];

    // Série usada hoje: [3000, 4000, 5000, 3500] -> mediana 3.750.
    // Contando junho como 0 seriam [0, 3000, 3500, 4000, 5000] -> 3.500.
    expect(getReferenceIncome(perfil(), txs)).toBe(3_750);
  });

  it('o mês corrente parcial entra na mediana como se estivesse fechado', () => {
    const txs = [
      { type: 'income', category: 'Salário', amount: 4_000, date: '2026-09-05' },
      { type: 'income', category: 'Salário', amount: 4_000, date: '2026-10-05' },
      // Mês em andamento, só o adiantamento lançado.
      { type: 'income', category: 'Salário', amount: 500, date: '2026-11-03' },
    ];
    expect(getReferenceIncome(perfil(), txs)).toBe(4_000);
  });

  it('resgate de investimento não conta como renda', () => {
    const txs = [
      { type: 'income', category: 'Salário', amount: 3_000, date: '2026-10-10' },
      { type: 'income', category: 'Investimentos', amount: 50_000, date: '2026-10-11' },
    ];
    expect(getReferenceIncome(perfil(), txs)).toBe(3_000);
  });
});

// ===========================================================================
// A8 — Fallback de 70% no custo de vida
// ===========================================================================

describe('[DEFEITO A8] sem histórico, o custo de vida é chutado em 70% da renda', () => {
  it('renda declarada de 5.000 vira custo de 3.500', () => {
    expect(getMonthlyCost([], 5_000)).toBe(3_500);
  });

  it('a meta de reserva herda o chute', () => {
    const custo = getMonthlyCost([], 5_000);
    expect(getReserveTargets(perfil(), custo)).toEqual({ minimum: 10_500, ideal: 21_000 });
  });
});

// ===========================================================================
// A4 — A estratégia 80/20 recebe o teto mais frouxo
// ===========================================================================

describe('[DEFEITO A4] 80/20 ganha teto de consumo maior que o Equilibrado', () => {
  it('80_20 cai no fallback de 40%', () => {
    expect(getGargaloThresholds(perfil({ strategy: '80_20' }))).toEqual({ warn: 40, critical: 60 });
  });

  it('o Equilibrado, mais folgado por desenho, recebe teto MENOR', () => {
    expect(getGargaloThresholds(perfil({ strategy: '50_30_20' }))).toEqual({ warn: 30, critical: 50 });
  });

  it('FIRE recebe o teto mais apertado', () => {
    expect(getGargaloThresholds(perfil({ strategy: '40_20_40' }))).toEqual({ warn: 20, critical: 40 });
  });
});

// ===========================================================================
// B5 — Renda variável recebe limite mais frouxo
// ===========================================================================

describe('[DEFEITO B5] renda variável afrouxa o limite em vez de estabilizar a base', () => {
  it('soma 5 pontos ao aviso e ao crítico', () => {
    expect(getGargaloThresholds(perfil({ income_type: 'variavel' }))).toEqual({ warn: 35, critical: 55 });
  });

  it('a reserva exigida dobra — esta parte está correta', () => {
    expect(getReserveTargets(perfil({ income_type: 'variavel' }), 3_000))
      .toEqual({ minimum: 18_000, ideal: 36_000 });
  });
});

// ===========================================================================
// A3 — Gargalo fixo em 50% no estágio, e mês corrente parcial
// ===========================================================================

describe('[DEFEITO A3] o estágio usa 50% fixo, não o crítico do perfil', () => {
  const base = {
    profile: perfil({ strategy: '40_20_40' }),   // crítico do perfil = 40
    referenceIncome: 10_000,
    monthlyCost: 4_000,
    monthIncome: 10_000,
    monthExpense: 5_000,
    reserveAmount: 50_000,
    investedTotal: 0,
    reserveIdeal: 24_000,
    hasRegisteredDebts: false,
  };

  it('gargalo de 45% é crítico pelo perfil, mas NÃO leva a Emergência', () => {
    expect(computeStage({ ...base, gargaloPercent: 45 }).id).toBe('acumulacao');
  });

  it('gargalo de 51% leva a Emergência, independentemente do perfil', () => {
    expect(computeStage({ ...base, gargaloPercent: 51 }).id).toBe('emergencia');
  });

  it('um único mês com despesa >= receita já leva a Emergência', () => {
    // Sem olhar histórico: basta o mês em andamento estar assim.
    const stage = computeStage({ ...base, gargaloPercent: 10, monthIncome: 1_000, monthExpense: 1_000 });
    expect(stage.id).toBe('emergencia');
  });
});

// ===========================================================================
// B8 — has_debt declarado vale como dívida cara
// ===========================================================================

describe('[DEFEITO B8] "tenho dívida" declarado prende em Emergência', () => {
  const base = {
    profile: perfil({ has_debt: true }),
    referenceIncome: 10_000,
    monthlyCost: 4_000,
    monthIncome: 10_000,
    monthExpense: 5_000,
    gargaloPercent: 10,
    reserveAmount: 50_000,
    investedTotal: 0,
    reserveIdeal: 24_000,
  };

  it('sem nenhuma dívida cadastrada, o booleano manda', () => {
    expect(computeStage({ ...base, hasRegisteredDebts: false }).id).toBe('emergencia');
  });

  it('com dívida cadastrada e barata, o booleano é ignorado', () => {
    const stage = computeStage({ ...base, hasRegisteredDebts: true, expensiveDebtTotal: 0 });
    expect(stage.id).toBe('acumulacao');
  });
});

// ===========================================================================
// B4 — Aporte na reserva contado duas vezes no patrimônio
// ===========================================================================

describe('[DEFEITO B4] o aporte feito pelo botão Poupar entra duas vezes', () => {
  it('a mesma transação de Investimentos vira reserva E investido', () => {
    // É exatamente o que PayYourselfFirstModal grava: uma despesa em
    // Investimentos mais a soma na meta "Reserva de Emergência".
    const insights = getProfileInsights({
      profile: perfil(),
      allTransactions: [
        { type: 'income', category: 'Salário', amount: 5_000, date: '2026-10-05' },
        { type: 'expense', category: 'Investimentos', amount: 1_000, date: '2026-10-06' },
      ],
      monthIncome: 5_000,
      monthExpense: 1_000,
      monthGargalo: 0,
      reserveAmount: 1_000,     // a meta, atualizada pelo mesmo aporte
    });

    expect(insights.contributedTotal).toBe(1_000);
    expect(insights.investedTotal).toBe(1_000);
    expect(insights.reserveAmount).toBe(1_000);
    // O patrimônio usado pelo estágio soma os dois: R$ 2.000 de R$ 1.000.
  });

  it('posição cadastrada substitui os aportes, sem somar', () => {
    const insights = getProfileInsights({
      profile: perfil(),
      allTransactions: [
        { type: 'expense', category: 'Investimentos', amount: 10_000, date: '2026-10-06' },
      ],
      monthIncome: 0,
      monthExpense: 10_000,
      monthGargalo: 0,
      reserveAmount: 0,
      positions: [{ invested_amount: 10_000, current_value: 3_000 }],
    });

    // Cadastrar UMA posição de várias derruba o patrimônio de 10.000 para 3.000.
    expect(insights.investedTotal).toBe(3_000);
    expect(insights.contributedTotal).toBe(10_000);
  });
});

// ===========================================================================
// A6 — Aporte sugerido ignora a capacidade real
// ===========================================================================

describe('[DEFEITO A6] o aporte sugerido sai da renda, não do que sobra', () => {
  it('sugere 20% da renda mesmo com o mês fechando no zero', () => {
    const insights = getProfileInsights({
      profile: perfil(),
      allTransactions: [
        { type: 'income', category: 'Salário', amount: 5_000, date: '2026-10-05' },
        { type: 'expense', category: 'Contas Fixas', amount: 5_000, date: '2026-10-06' },
      ],
      monthIncome: 5_000,
      monthExpense: 5_000,
      monthGargalo: 0,
      reserveAmount: 0,
    });

    expect(insights.suggestedContribution).toBe(1_000);
  });
});

// ===========================================================================
// A7 — Confiança da recorrência sem piso e com pesos frouxos
// ===========================================================================

describe('[CARACTERIZAÇÃO A7] confiança da recorrência', () => {
  // A hipótese de confiança negativa NÃO se confirma: a linha 216 descarta
  // tudo com desvio acima de 0.25 antes de calcular a confiança. O piso
  // max(0, ...) continua ausente, mas é inalcançável com o teto atual.

  it('valores muito dispersos são DESCARTADOS, não recebem confiança baixa', () => {
    const txs = [
      { type: 'expense', category: 'Variáveis', title: 'Loja X', amount: 100, date: '2026-01-10' },
      { type: 'expense', category: 'Variáveis', title: 'Loja X', amount: 100, date: '2026-02-10' },
      { type: 'expense', category: 'Variáveis', title: 'Loja X', amount: 1_000, date: '2026-05-10' },
    ];
    expect(detectRecurring(txs)).toEqual([]);
  });

  it('supermercado todo mês com valor oscilante NÃO vira assinatura', () => {
    const txs = Array.from({ length: 12 }, (_, i) => ({
      type: 'expense',
      category: 'Variáveis',
      title: 'Supermercado',
      amount: i % 2 === 0 ? 60 : 140,   // desvio 0.4, acima do teto de 0.25
      date: `2026-${String(i + 1).padStart(2, '0')}-10`,
    }));
    expect(detectRecurring(txs)).toEqual([]);
  });

  it('assinatura de valor fixo todo mês recebe confiança máxima', () => {
    const txs = Array.from({ length: 12 }, (_, i) => ({
      type: 'expense',
      category: 'Contas Fixas',
      title: 'Netflix',
      amount: 55,
      date: `2026-${String(i + 1).padStart(2, '0')}-10`,
    }));
    expect(detectRecurring(txs)[0].confidence).toBe(1);
  });

  it('um reajuste no último mês quase não derruba a confiança', () => {
    const txs = Array.from({ length: 12 }, (_, i) => ({
      type: 'expense',
      category: 'Contas Fixas',
      title: 'Netflix',
      amount: i === 11 ? 66 : 55,
      date: `2026-${String(i + 1).padStart(2, '0')}-10`,
    }));
    expect(detectRecurring(txs)[0].confidence).toBeGreaterThan(0.95);
  });

  it('dois meses bastam para entrar na lista', () => {
    const txs = [
      { type: 'expense', category: 'Contas Fixas', title: 'Netflix', amount: 55, date: '2026-09-10' },
      { type: 'expense', category: 'Contas Fixas', title: 'Netflix', amount: 55, date: '2026-10-10' },
    ];
    expect(detectRecurring(txs)).toHaveLength(1);
  });
});

// ===========================================================================
// B9 — Piso fixo de R$ 50 e ausência de alerta para gasto novo
// ===========================================================================

describe('[DEFEITO B9] anomalias usam piso fixo e ignoram gasto novo', () => {
  const comum = { currentMonth: '2026-11', income: 10_000 };

  it('categoria sem histórico não gera alerta, por maior que seja', () => {
    const r = breakdownByCategory({
      ...comum,
      monthTransactions: [{ type: 'expense', category: 'Viagem', amount: 8_000, date: '2026-11-05' }],
      allTransactions: [{ type: 'expense', category: 'Viagem', amount: 8_000, date: '2026-11-05' }],
    });
    expect(r[0].variationPercent).toBeNull();
    expect(detectAnomalies(r)).toHaveLength(0);
  });

  it('o piso de R$ 50 não acompanha a renda', () => {
    const r = breakdownByCategory({
      ...comum,
      monthTransactions: [{ type: 'expense', category: 'Lazer', amount: 160, date: '2026-11-05' }],
      allTransactions: [
        { type: 'expense', category: 'Lazer', amount: 160, date: '2026-11-05' },
        { type: 'expense', category: 'Lazer', amount: 100, date: '2026-10-05' },
        { type: 'expense', category: 'Lazer', amount: 100, date: '2026-09-05' },
      ],
    });
    // +60% e +R$ 60 sobre uma renda de 10.000: alerta de severidade alta.
    expect(detectAnomalies(r)[0].severity).toBe('alta');
  });
});

// ===========================================================================
// B3 — Previsão de caixa
// ===========================================================================

describe('[CARACTERIZAÇÃO B3] previsão de caixa', () => {
  it('projeta só meses FUTUROS, nunca o mês corrente', () => {
    const r = forecastMonths({
      allTransactions: [],
      fromPeriod: '2026-11',
      monthlyCost: 4_000,
      medianIncome: 6_000,
      months: 3,
    });
    expect(r.map(m => m.period)).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('o saldo projetado é renda menos o MAIOR entre comprometido e custo', () => {
    const r = forecastMonths({
      allTransactions: [
        { type: 'expense', category: 'Cartões', amount: 1_500, date: '2026-12-10' },
      ],
      fromPeriod: '2026-11',
      monthlyCost: 4_000,
      medianIncome: 6_000,
      months: 1,
    });
    expect(r[0]).toMatchObject({ committed: 1_500, estimatedRecurring: 2_500, projectedBalance: 2_000 });
  });

  it('comprometido acima do custo mediano zera a estimativa de recorrente', () => {
    const r = forecastMonths({
      allTransactions: [
        { type: 'expense', category: 'Cartões', amount: 5_000, date: '2026-12-10' },
      ],
      fromPeriod: '2026-11',
      monthlyCost: 4_000,
      medianIncome: 6_000,
      months: 1,
    });
    expect(r[0]).toMatchObject({ estimatedRecurring: 0, projectedBalance: 1_000 });
  });

  it('contas a vencer ignoram is_paid nulo — só "=== false" entra', () => {
    const hoje = new Date('2026-11-10T12:00:00Z');
    const txs = [
      { type: 'expense', category: 'Contas Fixas', amount: 100, date: '2026-11-20', is_paid: false, title: 'Luz' },
      { type: 'expense', category: 'Contas Fixas', amount: 200, date: '2026-11-21', title: 'Água' }, // is_paid ausente
    ];
    const bills = upcomingBills(txs, hoje);
    expect(bills.map(b => b.title)).toEqual(['Luz']);
  });

  it('contas vencidas ENTRAM na mesma lista, marcadas como atrasadas', () => {
    const hoje = new Date('2026-11-10T12:00:00Z');
    const txs = [
      { type: 'expense', category: 'Contas Fixas', amount: 100, date: '2026-10-02', is_paid: false, title: 'Antiga' },
    ];
    const bills = upcomingBills(txs, hoje);
    expect(bills).toHaveLength(1);
    expect(bills[0].overdue).toBe(true);
  });

  it('semana apertada usa limite absoluto em reais', () => {
    const bills = [
      { title: 'A', amount: 900, date: '2026-11-10', category: 'x', daysUntil: 0, overdue: false },
      { title: 'B', amount: 200, date: '2026-11-11', category: 'x', daysUntil: 1, overdue: false },
    ];
    expect(tightWeeks(bills, 1_000)).toHaveLength(1);
    expect(tightWeeks(bills, 1_200)).toHaveLength(0);
  });
});

// ===========================================================================
// B8 — Dívidas: o que já está correto e o que não está
// ===========================================================================

describe('[CARACTERIZAÇÃO B8] dívidas', () => {
  it('dívida sem juros já é tratada: não há divisão 0/0', () => {
    expect(payoffMonths(1_000, 0, 100)).toBe(10);
  });

  it('pagamento igual ao juro nunca quita', () => {
    expect(payoffMonths(10_000, 0.03, 300)).toBeNull();
  });

  it('a fórmula fechada bate com a simulação mês a mês', () => {
    expect(payoffMonths(10_000, 0.03, 500)).toBe(31);
    expect(simulatePayoff(10_000, 0.03, 500).months).toBe(31);
  });

  it('saldo zero quita em zero meses', () => {
    expect(payoffMonths(0, 0.03, 500)).toBe(0);
  });

  it('o resumo só conta dívida ativa', () => {
    const debts: Debt[] = [
      { id: '1', name: 'Rotativo', kind: 'rotativo_cartao', current_balance: 5_000, monthly_rate: 0.14, minimum_payment: 700, status: 'ativa' },
      { id: '2', name: 'Paga', kind: 'outro', current_balance: 9_999, monthly_rate: 0.5, minimum_payment: 0, status: 'quitada' },
    ];
    const r = summarizeDebts(debts);
    expect(r.total).toBe(5_000);
    expect(r.monthlyInterest).toBe(700);
    expect(r.count).toBe(1);
  });

  it('taxa nula é tratada como zero, não como desconhecida', () => {
    const debts = [
      { id: '1', name: 'Sem taxa', kind: 'outro', current_balance: 1_000, monthly_rate: null, minimum_payment: 100, status: 'ativa' },
    ] as unknown as Debt[];
    expect(summarizeDebts(debts).monthlyInterest).toBe(0);
  });
});
