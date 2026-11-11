/**
 * Previsão e simulação — o que vem pela frente.
 *
 * O app era um retrovisor: mostrava o mês corrente e nada além. Os dados para
 * projetar sempre estiveram lá — parcelas futuras já lançadas, custo fixo
 * mediano, renda mediana — só não eram usados.
 *
 * Funções puras. Toda projeção é ESTIMATIVA e os campos deixam isso explícito:
 * `committed` é o que já está lançado (fato) e `estimated` é o que o padrão
 * sugere (palpite). Misturar os dois seria enganoso.
 */

export type Tx = {
  type?: string;
  category?: string;
  amount?: number;
  date?: string;
  title?: string;
  is_paid?: boolean;
  installment_info?: string | null;
};

import { somarDias, diasEntre, domingoDaSemana } from './data';

const INVESTMENT = 'Investimentos';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 'YYYY-MM' somando `offset` meses. */
export function addMonths(period: string, offset: number): string {
  const [y, m] = period.split('-').map(Number);
  const total = y * 12 + (m - 1) + offset;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

export interface MonthForecast {
  period: string;
  /** Já lançado: parcelas e contas agendadas. É fato, não estimativa. */
  committed: number;
  /** Custo fixo recorrente que o padrão sugere, fora o que já está lançado. */
  estimatedRecurring: number;
  /** Renda esperada, pela mediana */
  estimatedIncome: number;
  /** Renda - (compromissos + recorrente estimado) */
  projectedBalance: number;
  /** true quando o mês fecha no vermelho pela projeção */
  tight: boolean;
}

/**
 * Projeta os próximos meses.
 *
 * `committed` sai só do que já existe no banco com data futura — nada de
 * adivinhação. `estimatedRecurring` é a diferença entre o custo de vida
 * mediano e o que já está comprometido, para não contar duas vezes a mesma
 * conta de luz.
 */
export function forecastMonths(params: {
  allTransactions: Tx[];
  fromPeriod: string;
  monthlyCost: number;
  medianIncome: number;
  months?: number;
}): MonthForecast[] {
  const { allTransactions, fromPeriod, monthlyCost, medianIncome, months = 3 } = params;

  const committedByMonth = new Map<string, number>();
  for (const t of allTransactions) {
    if (t.type !== 'expense' || t.category === INVESTMENT || !t.date) continue;
    const p = t.date.slice(0, 7);
    if (p <= fromPeriod) continue;
    committedByMonth.set(p, (committedByMonth.get(p) ?? 0) + (t.amount ?? 0));
  }

  const out: MonthForecast[] = [];
  for (let i = 1; i <= months; i++) {
    const period = addMonths(fromPeriod, i);
    const committed = round2(committedByMonth.get(period) ?? 0);

    // O custo de vida já inclui as contas recorrentes. Se parte delas já está
    // lançada como parcela futura, somar o custo inteiro contaria duplicado.
    const estimatedRecurring = round2(Math.max(0, monthlyCost - committed));
    const projectedBalance = round2(medianIncome - committed - estimatedRecurring);

    out.push({
      period,
      committed,
      estimatedRecurring,
      estimatedIncome: round2(medianIncome),
      projectedBalance,
      tight: projectedBalance < 0,
    });
  }
  return out;
}

export interface UpcomingBill {
  title: string;
  amount: number;
  date: string;
  category: string;
  daysUntil: number;
  overdue: boolean;
  installmentInfo?: string | null;
}

/**
 * Contas a vencer, em ordem de data.
 *
 * `hoje` entra como string AAAA-MM-DD, já no fuso do usuário: a função não
 * pode ter relógio escondido dentro dela. Antes recebia um `Date` e chamava
 * `toISOString()`, o que à noite no Brasil já apontava para o dia seguinte.
 */
export function upcomingBills(
  allTransactions: Tx[],
  hoje: string,
  daysAhead = 45,
): UpcomingBill[] {
  const todayStr = hoje.slice(0, 10);
  const limitStr = somarDias(todayStr, daysAhead);

  return allTransactions
    .filter(t =>
      t.type === 'expense' &&
      t.category !== INVESTMENT &&
      t.is_paid === false &&
      t.date && t.date <= limitStr,
    )
    .map(t => {
      const days = diasEntre(todayStr, t.date!);
      return {
        title: t.title ?? 'Sem título',
        amount: round2(t.amount ?? 0),
        date: t.date!,
        category: t.category ?? 'Sem categoria',
        daysUntil: days,
        overdue: days < 0,
        installmentInfo: t.installment_info,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface TightWeek {
  weekStart: string;
  total: number;
  count: number;
}

/** Semanas com concentração de vencimentos — onde o caixa aperta. */
export function tightWeeks(bills: UpcomingBill[], threshold: number): TightWeek[] {
  const byWeek = new Map<string, { total: number; count: number }>();

  for (const b of bills) {
    const key = domingoDaSemana(b.date);
    const cur = byWeek.get(key) ?? { total: 0, count: 0 };
    byWeek.set(key, { total: cur.total + b.amount, count: cur.count + 1 });
  }

  return [...byWeek.entries()]
    .filter(([, v]) => v.total >= threshold)
    .map(([weekStart, v]) => ({ weekStart, total: round2(v.total), count: v.count }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// ---------------------------------------------------------------------------
// Simulador "e se"
// ---------------------------------------------------------------------------

export interface GoalProjection {
  /** null = não alcança no ritmo atual */
  months: number | null;
  targetDate: Date | null;
  monthlyContribution: number;
}

/**
 * Quando a meta é alcançada guardando `monthly` por mês.
 * Sem rendimento: um app que promete juros compostos sobre reserva de
 * emergência estaria vendendo expectativa, não planejamento.
 */
export function projectGoal(
  current: number,
  target: number,
  monthly: number,
  from: Date = new Date(),
): GoalProjection {
  if (current >= target) {
    return { months: 0, targetDate: from, monthlyContribution: monthly };
  }
  if (monthly <= 0) {
    return { months: null, targetDate: null, monthlyContribution: monthly };
  }

  const months = Math.ceil((target - current) / monthly);
  const targetDate = new Date(from);
  targetDate.setMonth(targetDate.getMonth() + months);
  return { months, targetDate, monthlyContribution: monthly };
}

/** Quanto guardar por mês para bater a meta numa data. */
export function requiredMonthly(current: number, target: number, months: number): number {
  if (months <= 0) return 0;
  return round2(Math.max(0, (target - current) / months));
}

export interface WhatIfResult {
  baseMonths: number | null;
  newMonths: number | null;
  monthsSaved: number;
  newMonthlyContribution: number;
}

/**
 * "Se eu cortar R$ X por mês, quando bato a reserva?"
 * O corte vira aporte: o dinheiro que deixa de ser consumido é o que sobra.
 */
export function whatIfCut(params: {
  reserveCurrent: number;
  reserveTarget: number;
  currentContribution: number;
  monthlyCut: number;
  from?: Date;
}): WhatIfResult {
  const { reserveCurrent, reserveTarget, currentContribution, monthlyCut, from = new Date() } = params;

  const base = projectGoal(reserveCurrent, reserveTarget, currentContribution, from);
  const withCut = projectGoal(reserveCurrent, reserveTarget, currentContribution + monthlyCut, from);

  return {
    baseMonths: base.months,
    newMonths: withCut.months,
    monthsSaved: (base.months !== null && withCut.months !== null) ? base.months - withCut.months : 0,
    newMonthlyContribution: round2(currentContribution + monthlyCut),
  };
}

export interface IncomeDropResult {
  newIncome: number;
  monthlyCost: number;
  survives: boolean;
  deficit: number;
  /** Meses que a reserva aguenta cobrindo o rombo */
  monthsOfRunway: number | null;
}

/** "E se minha renda cair X%?" */
export function whatIfIncomeDrop(params: {
  income: number;
  monthlyCost: number;
  reserveAmount: number;
  dropPercent: number;
}): IncomeDropResult {
  const { income, monthlyCost, reserveAmount, dropPercent } = params;

  const newIncome = round2(income * (1 - dropPercent / 100));
  const deficit = round2(Math.max(0, monthlyCost - newIncome));
  const survives = deficit === 0;

  return {
    newIncome,
    monthlyCost: round2(monthlyCost),
    survives,
    deficit,
    monthsOfRunway: survives ? null : (deficit > 0 ? round2(reserveAmount / deficit) : null),
  };
}
