import type { ProfileInsights, StrategyId } from './profile';
import { STRATEGIES, DEFAULT_STRATEGY, GARGALO_CATEGORIES } from './profile';
import { summarizeDebts, compareStrategies, monthlyInterestCost, debtVsInvestment, type Debt } from './debt';

/**
 * Resumo calculado para o Conselheiro IA.
 *
 * Antes a rota recebia `{ income, expense, balance, transactions, strategy }` —
 * três números e cinco transações. A IA tinha que adivinhar do zero tudo que o
 * lib/profile.ts e o lib/debt.ts já calculam bem: estágio, limites do perfil,
 * falta para a reserva, custo dos juros, previsão de quitação, tendência.
 *
 * O ganho de qualidade vem daqui, não de trocar de modelo: a IA passa a
 * interpretar números prontos em vez de recalcular mal.
 *
 * Função pura: recebe o que a tela já tem em mãos e devolve o objeto.
 */

type Tx = {
  type?: string;
  category?: string;
  amount?: number;
  date?: string;
  title?: string;
  is_paid?: boolean;
  installment_group?: string | null;
};

export interface AdvisorContext {
  periodo: string;
  perfil: {
    estagio: string;
    estagioNivel: number;
    prioridade: string;
    estrategia: string;
    tipoRenda: string;
  };
  mes: {
    renda: number;
    despesaTotal: number;
    custosFixos: number;
    cartoesEVariaveis: number;
    aportes: number;
    saldo: number;
  };
  limites: {
    tetoConsumoPercent: number;
    tetoCriticoPercent: number;
    consumoAtualPercent: number;
    acimaDoTeto: boolean;
  };
  reserva: {
    atual: number;
    minima: number;
    ideal: number;
    /** null quando nao ha custo de vida conhecido para dividir. */
    mesesCobertos: number | null;
    faltaParaMinima: number;
  };
  dividas: {
    total: number;
    totalCara: number;
    jurosPorMes: number;
    piorDivida: { nome: string; taxaMensalPercent: number; custoMensal: number } | null;
    parcelasMinimas: number;
    previsaoQuitacaoMeses: number | null;
    vantagemQuitarSobreInvestir: string | null;
  } | null;
  compromissosFuturos: {
    proximosTresMeses: number;
    detalhePorMes: Array<{ mes: string; valor: number }>;
  };
  tendencia: {
    custoVidaMediano: number;
    rendaMediana: number;
    variacaoConsumoPercent: number | null;
  };
  aporte: {
    sugerido: number;
    percentualDaRenda: number;
    deveSugerir: boolean;
    motivoSeNao: string | null;
  };
  conselhoAnterior: { periodo: string; texto: string } | null;
}

export function buildAdvisorContext(params: {
  insights: ProfileInsights;
  allTransactions: Tx[];
  monthTransactions: Tx[];
  debts: Debt[];
  reserveAmount: number;
  activeMonth: number;
  activeYear: number;
  strategyId?: StrategyId | null;
  incomeType?: string | null;
  previousAdvice?: { period: string; advice: string } | null;
}): AdvisorContext {
  const {
    insights, allTransactions, monthTransactions, debts, reserveAmount,
    activeMonth, activeYear, strategyId, incomeType, previousAdvice,
  } = params;

  const periodo = `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}`;
  const strategy = STRATEGIES[strategyId ?? DEFAULT_STRATEGY] ?? STRATEGIES[DEFAULT_STRATEGY];

  const sumWhere = (txs: Tx[], fn: (t: Tx) => boolean) =>
    round2(txs.filter(fn).reduce((a, t) => a + (t.amount ?? 0), 0));

  const renda = sumWhere(monthTransactions, t => t.type === 'income' && t.category !== 'Investimentos');
  const custosFixos = sumWhere(monthTransactions, t => t.type === 'expense' && t.category === 'Contas Fixas');
  const gargalo = sumWhere(monthTransactions, t => t.type === 'expense' && GARGALO_CATEGORIES.includes(t.category ?? ''));
  const aportes = sumWhere(monthTransactions, t => t.type === 'expense' && t.category === 'Investimentos');
  const despesaTotal = sumWhere(monthTransactions, t => t.type === 'expense' && t.category !== 'Investimentos');

  const consumoPercent = renda > 0 ? round2((gargalo / renda) * 100) : 0;

  // Parcelas já lançadas para os próximos meses: renda futura com dono.
  const hoje = `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}`;
  const futuras = allTransactions.filter(t =>
    t.type === 'expense' && (t.date?.slice(0, 7) ?? '') > hoje,
  );
  const porMes = new Map<string, number>();
  for (const t of futuras) {
    const k = t.date!.slice(0, 7);
    porMes.set(k, (porMes.get(k) ?? 0) + (t.amount ?? 0));
  }
  const detalhePorMes = [...porMes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([mes, valor]) => ({ mes, valor: round2(valor) }));

  const debtSummary = summarizeDebts(debts);
  const temDivida = debtSummary.count > 0;

  // Previsão de quitação com a sobra do mês, quando ela existe.
  const sobra = Math.max(0, renda - custosFixos - gargalo);
  const orcamentoDivida = Math.max(debtSummary.requiredMinimum, sobra);
  const plano = temDivida && orcamentoDivida > 0
    ? compareStrategies(debts, orcamentoDivida)
    : null;

  const contraste = temDivida
    ? debtVsInvestment(debtSummary.highestRate)
    : null;

  return {
    periodo,
    perfil: {
      estagio: insights.stage.label,
      estagioNivel: insights.stage.level,
      prioridade: insights.stage.priority,
      estrategia: strategy.name,
      tipoRenda: incomeType === 'variavel' ? 'variável' : 'fixa',
    },
    mes: {
      renda,
      despesaTotal,
      custosFixos,
      cartoesEVariaveis: gargalo,
      aportes,
      saldo: round2(renda - despesaTotal - aportes),
    },
    limites: {
      tetoConsumoPercent: round2(insights.gargaloWarn),
      tetoCriticoPercent: round2(insights.gargaloCritical),
      consumoAtualPercent: consumoPercent,
      acimaDoTeto: consumoPercent > insights.gargaloWarn,
    },
    reserva: {
      atual: round2(reserveAmount),
      minima: insights.reserveMinimum,
      ideal: insights.reserveIdeal,
      // null quando nao ha custo de vida conhecido: a IA precisa saber a
      // diferenca entre "nao tem reserva" e "nao da para medir".
      mesesCobertos: insights.reserveMonths === null ? null : round2(insights.reserveMonths),
      faltaParaMinima: round2(Math.max(0, insights.reserveMinimum - reserveAmount)),
    },
    dividas: temDivida ? {
      total: debtSummary.total,
      totalCara: debtSummary.expensiveTotal,
      jurosPorMes: debtSummary.monthlyInterest,
      piorDivida: debtSummary.mostExpensive ? {
        nome: debtSummary.mostExpensive.name,
        taxaMensalPercent: round2(debtSummary.mostExpensive.monthly_rate * 100),
        custoMensal: monthlyInterestCost(debtSummary.mostExpensive),
      } : null,
      parcelasMinimas: debtSummary.requiredMinimum,
      previsaoQuitacaoMeses: plano?.avalanche.months ?? null,
      vantagemQuitarSobreInvestir: contraste?.debtWins
        ? `A pior dívida cobra ${contraste.gapPercentPoints} pontos percentuais a mais por mês do que um investimento conservador rende. Quitar vence investir.`
        : null,
    } : null,
    compromissosFuturos: {
      proximosTresMeses: round2(detalhePorMes.reduce((a, m) => a + m.valor, 0)),
      detalhePorMes,
    },
    tendencia: {
      custoVidaMediano: round2(insights.monthlyCost),
      rendaMediana: round2(insights.referenceIncome),
      variacaoConsumoPercent: insights.monthlyCost > 0
        ? round2(((despesaTotal - insights.monthlyCost) / insights.monthlyCost) * 100)
        : null,
    },
    aporte: {
      sugerido: insights.suggestedContribution,
      percentualDaRenda: round2(insights.suggestedSavingsRate * 100),
      deveSugerir: insights.shouldSuggestContribution,
      motivoSeNao: insights.shouldSuggestContribution
        ? null
        : 'O usuário está em Modo Emergência: juros de dívida cara superam qualquer rendimento, então a prioridade é quitar, não guardar.',
    },
    conselhoAnterior: previousAdvice
      ? { periodo: previousAdvice.period, texto: previousAdvice.advice }
      : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
