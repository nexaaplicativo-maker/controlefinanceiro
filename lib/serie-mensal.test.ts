/**
 * F4 — A série mensal que sustenta renda e custo de referência.
 *
 * Dois defeitos corrigidos aqui:
 *   1. mês ativo sem o valor procurado sumia da série, em vez de contar zero;
 *   2. o mês corrente, pela metade, entrava como se estivesse fechado.
 */

import { describe, it, expect } from 'vitest';
import {
  serieMensalFechada, getReferenceIncome, getMonthlyCost, temDeficitRecorrente, getProfileInsights,
  type FinancialProfile,
} from './profile';

const HOJE = '2026-11-15';
const receita = (t: { type?: string; category?: string }) =>
  t.type === 'income' && t.category !== 'Investimentos';

const perfil = (over: Partial<FinancialProfile> = {}): FinancialProfile => ({
  monthly_income: null,
  income_type: 'fixa',
  strategy: '50_30_20',
  has_debt: null,
  main_goal: null,
  onboarded_at: '2026-01-01',
  ...over,
});

describe('mês ativo sem o valor procurado conta zero', () => {
  it('o caso do relatório: mediana 3.500, não 3.750', () => {
    const txs = [
      { type: 'income', category: 'Salário', amount: 3_000, date: '2026-05-10' },
      { type: 'expense', category: 'Variáveis', amount: 800, date: '2026-06-10' },  // junho ativo, sem receita
      { type: 'income', category: 'Salário', amount: 4_000, date: '2026-08-10' },
      { type: 'income', category: 'Salário', amount: 5_000, date: '2026-09-10' },
      { type: 'income', category: 'Salário', amount: 3_500, date: '2026-10-10' },
    ];

    const s = serieMensalFechada({ transacoes: txs, predicado: receita, hoje: HOJE });
    expect(s.meses).toEqual(['2026-05', '2026-06', '2026-08', '2026-09', '2026-10']);
    expect(s.valores).toEqual([3_000, 0, 4_000, 5_000, 3_500]);
    expect(s.mediana).toBe(3_500);
  });

  it('julho, sem lançamento nenhum, NÃO entra como zero', () => {
    // Mês em que a pessoa não usou o app não é mês sem renda: é mês sem dado.
    const txs = [
      { type: 'income', category: 'Salário', amount: 3_000, date: '2026-05-10' },
      { type: 'income', category: 'Salário', amount: 3_000, date: '2026-09-10' },
    ];
    const s = serieMensalFechada({ transacoes: txs, predicado: receita, hoje: HOJE });
    expect(s.meses).toEqual(['2026-05', '2026-09']);
    expect(s.valores).toEqual([3_000, 3_000]);
  });
});

describe('o mês corrente fica de fora', () => {
  it('lançamento de hoje não entra na série', () => {
    const txs = [
      { type: 'income', category: 'Salário', amount: 4_000, date: '2026-09-05' },
      { type: 'income', category: 'Salário', amount: 4_000, date: '2026-10-05' },
      { type: 'income', category: 'Salário', amount: 500, date: '2026-11-03' },
    ];
    const s = serieMensalFechada({ transacoes: txs, predicado: receita, hoje: HOJE });
    expect(s.meses).not.toContain('2026-11');
    expect(s.mediana).toBe(4_000);
  });

  it('mês futuro, de parcela projetada, também fica de fora', () => {
    const txs = [
      { type: 'expense', category: 'Cartões', amount: 1_000, date: '2026-10-05' },
      { type: 'expense', category: 'Cartões', amount: 1_000, date: '2027-03-05' },
    ];
    const s = serieMensalFechada({
      transacoes: txs,
      predicado: t => t.type === 'expense',
      hoje: HOJE,
    });
    expect(s.meses).toEqual(['2026-10']);
  });

  it('no dia 1º do mês, a série é toda do mês anterior para trás', () => {
    const txs = [
      { type: 'income', category: 'Salário', amount: 4_000, date: '2026-10-28' },
      { type: 'income', category: 'Salário', amount: 9_999, date: '2026-11-01' },
    ];
    const s = serieMensalFechada({ transacoes: txs, predicado: receita, hoje: '2026-11-01' });
    expect(s.valores).toEqual([4_000]);
  });
});

describe('janela e fonte', () => {
  const doze = Array.from({ length: 12 }, (_, i) => ({
    type: 'income',
    category: 'Salário',
    amount: 1_000 * (i + 1),
    date: `2026-${String(i + 1).padStart(2, '0')}-10`,
  }));

  it('usa no máximo os 6 meses fechados mais recentes', () => {
    const s = serieMensalFechada({ transacoes: doze, predicado: receita, hoje: '2027-01-15' });
    expect(s.mesesNaBase).toBe(6);
    expect(s.meses).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12']);
  });

  it('3 meses ou mais é histórico', () => {
    const s = serieMensalFechada({ transacoes: doze.slice(0, 3), predicado: receita, hoje: HOJE });
    expect(s.fonte).toBe('historico');
  });

  it('1 ou 2 meses é parcial', () => {
    const s = serieMensalFechada({ transacoes: doze.slice(0, 2), predicado: receita, hoje: HOJE });
    expect(s.fonte).toBe('parcial');
    expect(s.mesesNaBase).toBe(2);
  });

  it('nenhum mês fechado é vazio', () => {
    const s = serieMensalFechada({ transacoes: [], predicado: receita, hoje: HOJE });
    expect(s.fonte).toBe('vazio');
    expect(s.mediana).toBe(0);
    expect(s.coeficienteDeVariacao).toBeNull();
  });

  it('mediana de quantidade par é a média dos dois centrais', () => {
    const txs = [
      { type: 'income', category: 'Salário', amount: 1_000, date: '2026-07-10' },
      { type: 'income', category: 'Salário', amount: 2_000, date: '2026-08-10' },
      { type: 'income', category: 'Salário', amount: 3_000, date: '2026-09-10' },
      { type: 'income', category: 'Salário', amount: 4_000, date: '2026-10-10' },
    ];
    const s = serieMensalFechada({ transacoes: txs, predicado: receita, hoje: HOJE });
    expect(s.mediana).toBe(2_500);
  });
});

describe('volatilidade da renda', () => {
  it('renda constante tem coeficiente zero', () => {
    const txs = Array.from({ length: 6 }, (_, i) => ({
      type: 'income', category: 'Salário', amount: 5_000,
      date: `2026-0${i + 2}-10`,
    }));
    expect(serieMensalFechada({ transacoes: txs, predicado: receita, hoje: HOJE }).coeficienteDeVariacao).toBe(0);
  });

  it('renda que oscila muito tem coeficiente alto', () => {
    const txs = [
      { type: 'income', category: 'Salário', amount: 1_000, date: '2026-06-10' },
      { type: 'income', category: 'Salário', amount: 9_000, date: '2026-07-10' },
      { type: 'income', category: 'Salário', amount: 1_000, date: '2026-08-10' },
      { type: 'income', category: 'Salário', amount: 9_000, date: '2026-09-10' },
    ];
    const cv = serieMensalFechada({ transacoes: txs, predicado: receita, hoje: HOJE }).coeficienteDeVariacao;
    expect(cv).toBeGreaterThan(0.7);
  });

  it('um mês só não permite medir oscilação', () => {
    const txs = [{ type: 'income', category: 'Salário', amount: 5_000, date: '2026-10-10' }];
    expect(serieMensalFechada({ transacoes: txs, predicado: receita, hoje: HOJE }).coeficienteDeVariacao).toBeNull();
  });
});

describe('renda e custo de referência usam a série', () => {
  it('renda cai no declarado quando não há mês fechado', () => {
    expect(getReferenceIncome(perfil({ monthly_income: 4_200 }), [], HOJE).valor).toBe(4_200);
  });

  it('resgate de investimento continua fora da renda', () => {
    const txs = [
      { type: 'income', category: 'Salário', amount: 3_000, date: '2026-09-10' },
      { type: 'income', category: 'Salário', amount: 3_000, date: '2026-10-10' },
      { type: 'income', category: 'Investimentos', amount: 50_000, date: '2026-10-11' },
    ];
    expect(getReferenceIncome(perfil(), txs, HOJE).valor).toBe(3_000);
  });

  it('o custo também ignora o mês corrente', () => {
    const txs = [
      { type: 'expense', category: 'Contas Fixas', amount: 2_000, date: '2026-09-10' },
      { type: 'expense', category: 'Contas Fixas', amount: 2_000, date: '2026-10-10' },
      { type: 'expense', category: 'Contas Fixas', amount: 50, date: '2026-11-02' },
    ];
    expect(getMonthlyCost(txs, 5_000, HOJE).valor).toBe(2_000);
  });
});

describe('F6 — cascata do custo de vida e a trava do estágio 5', () => {
  const doisMeses = [
    { type: 'expense', category: 'Contas Fixas', amount: 2_000, date: '2026-09-10' },
    { type: 'expense', category: 'Contas Fixas', amount: 2_000, date: '2026-10-10' },
  ];

  it('1 ou 2 meses de despesa já valem como observação parcial', () => {
    const r = getMonthlyCost(doisMeses, 9_999, HOJE, perfil());
    expect(r.valor).toBe(2_000);
    expect(r.fonte).toBe('parcial');
  });

  it('sem nenhuma despesa, estima pela estratégia', () => {
    expect(getMonthlyCost([], 5_000, HOJE, perfil()).fonte).toBe('estimado');
  });

  it('a estratégia simplista também planeja consumir 80%', () => {
    expect(getMonthlyCost([], 5_000, HOJE, perfil({ strategy: '80_20' })).valor).toBe(4_000);
  });

  it('sem perfil, assume a estratégia padrão', () => {
    expect(getMonthlyCost([], 5_000, HOJE).valor).toBe(4_000);
  });
});

describe('F5 — déficit recorrente', () => {
  /** Monta meses com receita e despesa dadas. */
  const meses = (pares: Array<[string, number, number]>) =>
    pares.flatMap(([mes, entrou, saiu]) => [
      ...(entrou > 0 ? [{ type: 'income', category: 'Salário', amount: entrou, date: `${mes}-05` }] : []),
      ...(saiu > 0 ? [{ type: 'expense', category: 'Variáveis', amount: saiu, date: `${mes}-10` }] : []),
    ]);

  it('dois dos três últimos meses no vermelho é déficit recorrente', () => {
    const txs = meses([['2026-08', 3_000, 3_500], ['2026-09', 3_000, 3_200], ['2026-10', 3_000, 2_000]]);
    expect(temDeficitRecorrente({ transacoes: txs, hoje: HOJE })).toBe(true);
  });

  it('um mês ruim só não é déficit recorrente', () => {
    // Conserto de carro, dentista, matrícula. Acontece.
    const txs = meses([['2026-08', 3_000, 1_000], ['2026-09', 3_000, 5_000], ['2026-10', 3_000, 1_000]]);
    expect(temDeficitRecorrente({ transacoes: txs, hoje: HOJE })).toBe(false);
  });

  it('o mês corrente não entra na conta', () => {
    // No dia 3, com aluguel pago e salário ainda não creditado, todo mundo
    // parece estar gastando mais do que ganha.
    const txs = [
      ...meses([['2026-09', 3_000, 1_000], ['2026-10', 3_000, 1_000]]),
      { type: 'expense', category: 'Contas Fixas', amount: 2_500, date: '2026-11-03' },
    ];
    expect(temDeficitRecorrente({ transacoes: txs, hoje: HOJE })).toBe(false);
  });

  it('quem só lança despesa NÃO é dado como deficitário', () => {
    // Mês sem receita lançada é dado faltando, não prova de déficit. Tratar
    // como vermelho prenderia no Modo Emergência quem usa o app só para
    // acompanhar gasto — sem caminho de saída.
    const txs = meses([['2026-08', 0, 3_000], ['2026-09', 0, 3_000], ['2026-10', 0, 3_000]]);
    expect(temDeficitRecorrente({ transacoes: txs, hoje: HOJE })).toBe(false);
  });

  it('empate conta como vermelho: gastou tudo o que ganhou', () => {
    const txs = meses([['2026-09', 3_000, 3_000], ['2026-10', 3_000, 3_000]]);
    expect(temDeficitRecorrente({ transacoes: txs, hoje: HOJE })).toBe(true);
  });

  it('aporte não inventa déficit, resgate não esconde', () => {
    // Investimentos sai dos dois lados, simetricamente.
    const txs = [
      ...meses([['2026-09', 3_000, 1_000], ['2026-10', 3_000, 1_000]]),
      { type: 'expense', category: 'Investimentos', amount: 5_000, date: '2026-09-20' },
      { type: 'income', category: 'Investimentos', amount: 9_000, date: '2026-10-20' },
    ];
    expect(temDeficitRecorrente({ transacoes: txs, hoje: HOJE })).toBe(false);
  });

  it('sem histórico nenhum, não há déficit a declarar', () => {
    expect(temDeficitRecorrente({ transacoes: [], hoje: HOJE })).toBe(false);
  });
});

describe('F7 — aporte sugerido e destino', () => {
  const comMeses = (entrou: number, saiu: number) =>
    ['2026-08', '2026-09', '2026-10'].flatMap(m => [
      { type: 'income', category: 'Salário', amount: entrou, date: `${m}-05` },
      { type: 'expense', category: 'Contas Fixas', amount: saiu, date: `${m}-10` },
    ]);

  const insights = (txs: any[], over: any = {}) => getProfileInsights({
    hoje: HOJE,
    profile: perfil({ monthly_income: 5_000 }),
    allTransactions: txs,
    monthIncome: 5_000,
    monthExpense: 3_000,
    monthGargalo: 500,
    reserveAmount: 0,
    ...over,
  });

  it('os três casos do relatório', () => {
    // sobra 200 -> sugere 200 (menor que a meta de 1.000)
    expect(insights(comMeses(5_000, 4_800)).suggestedContribution).toBe(200);
    // sobra 1.800 -> sugere 1.000 (a meta é o teto)
    expect(insights(comMeses(5_000, 3_200)).suggestedContribution).toBe(1_000);
    // sobra negativa -> 0
    expect(insights(comMeses(5_000, 5_300)).suggestedContribution).toBe(0);
  });

  it('a poupança típica pode ser negativa, e é exposta como tal', () => {
    expect(insights(comMeses(5_000, 5_300)).poupancaTipica).toBe(-300);
  });

  it('destino em Emergência por dívida é quitar a dívida', () => {
    const i = insights(comMeses(5_000, 3_000), {
      profile: perfil({ monthly_income: 5_000, has_debt: true }),
    });
    expect(i.stage.id).toBe('emergencia');
    expect(i.destinoDoAporte).toBe('quitar-divida');
  });

  it('destino em Emergência por déficit é ajustar gastos', () => {
    const i = insights(comMeses(5_000, 5_300));
    expect(i.stage.id).toBe('emergencia');
    expect(i.destinoDoAporte).toBe('ajustar-gastos');
  });

  it('destino sem reserva formada é a reserva', () => {
    expect(insights(comMeses(5_000, 3_000)).destinoDoAporte).toBe('reserva');
  });

  it('destino com reserva completa é investimento', () => {
    // 50.000 passa do ideal (6 × 3.000) sem chegar aos 300× da independência.
    const i = insights(comMeses(5_000, 3_000), { reserveAmount: 50_000 });
    expect(i.stage.id).toBe('acumulacao');
    expect(i.destinoDoAporte).toBe('investimentos');
  });
});
