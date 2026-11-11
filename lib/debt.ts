/**
 * Dívidas — cálculo de custo, quitação e estratégia.
 *
 * Tudo aqui é função pura, sem I/O, para ser testável e ter um dono único.
 *
 * CONVENÇÃO DE TAXA: `monthly_rate` é fração decimal ao MÊS.
 *   0.15 = 15% a.m.  —  não 15.
 * O banco tem um teto de sanidade em 2 justamente para pegar quem digitar 15.
 */

export type DebtKind =
  | 'rotativo_cartao'
  | 'cheque_especial'
  | 'emprestimo_pessoal'
  | 'financiamento'
  | 'consignado'
  | 'parcelamento_loja'
  | 'outro';

export interface Debt {
  id: string;
  name: string;
  creditor?: string | null;
  kind: DebtKind;
  current_balance: number;
  monthly_rate: number;
  minimum_payment: number;
  due_day?: number | null;
  status: 'ativa' | 'quitada';
}

export const DEBT_KINDS: Record<DebtKind, string> = {
  rotativo_cartao: 'Rotativo do cartão',
  cheque_especial: 'Cheque especial',
  emprestimo_pessoal: 'Empréstimo pessoal',
  financiamento: 'Financiamento',
  consignado: 'Consignado',
  parcelamento_loja: 'Parcelamento de loja',
  outro: 'Outro',
};

/**
 * Corte de "dívida cara": 3% ao mês.
 *
 * Acima disso a dívida supera com folga qualquer rendimento conservador, então
 * quitar vence investir — é ela que segura o usuário no Estágio 1. Abaixo
 * (consignado, financiamento imobiliário), a dívida é acompanhada mas não
 * bloqueia aporte nem progressão de estágio.
 */
export const EXPENSIVE_DEBT_RATE = 0.03;

/** Teto de meses nas simulações. 50 anos: além disso é "nunca quita". */
const MAX_MONTHS = 600;

export function isExpensive(debt: Pick<Debt, 'monthly_rate'>): boolean {
  return debt.monthly_rate >= EXPENSIVE_DEBT_RATE;
}

export function isActive(debt: Pick<Debt, 'status'>): boolean {
  return debt.status === 'ativa';
}

/**
 * Quanto a dívida cobra por mês só para existir, sem amortizar nada.
 * É o número que mais choca o usuário e o que melhor justifica a prioridade.
 */
export function monthlyInterestCost(debt: Pick<Debt, 'current_balance' | 'monthly_rate'>): number {
  // Arredonda aos centavos: 5000 × 0.14 dá 700.0000000000001 em ponto
  // flutuante, e esse resto vazaria para a tela e para as comparações.
  return round2(debt.current_balance * debt.monthly_rate);
}

/**
 * Pagamento mínimo que faz o saldo andar para baixo.
 * Qualquer valor igual ou menor que isto deixa a dívida eterna (ou crescendo).
 */
export function minimumViablePayment(balance: number, monthlyRate: number): number {
  return round2(balance * monthlyRate);
}

/**
 * Meses até quitar, pela fórmula fechada de amortização:
 *
 *   n = -ln(1 - r·B/P) / ln(1 + r)
 *
 * Devolve `null` quando a dívida nunca zera naquele ritmo — ou seja, quando o
 * pagamento não cobre nem o juro do mês. Devolver null em vez de Infinity
 * obriga quem chama a tratar o caso explicitamente.
 */
export function payoffMonths(balance: number, monthlyRate: number, payment: number): number | null {
  if (balance <= 0) return 0;
  if (payment <= 0) return null;

  // Sem juros: divisão simples.
  if (monthlyRate <= 0) return Math.ceil(balance / payment);

  // O pagamento não cobre o juro: o saldo nunca cai.
  if (payment <= minimumViablePayment(balance, monthlyRate)) return null;

  const n = -Math.log(1 - (monthlyRate * balance) / payment) / Math.log(1 + monthlyRate);
  return Math.ceil(n);
}

/**
 * Taxa efetiva ANUAL equivalente a uma taxa mensal.
 *
 *   (1 + r)^12 − 1
 *
 * Existe porque "3% ao mês" não assusta ninguém e 42,58% ao ano assusta. É o
 * mesmo número dito de um jeito que a pessoa consegue comparar com o que ela
 * conhece: poupança, CDI, financiamento imobiliário.
 *
 * 3% a.m. = 42,58% a.a.  |  15% a.m. = 435,03% a.a.
 */
export function taxaAnualEquivalente(taxaMensal: number): number {
  if (!Number.isFinite(taxaMensal) || taxaMensal <= 0) return 0;
  return Math.round(((1 + taxaMensal) ** 12 - 1) * 10000) / 10000;
}

/**
 * Parcela necessária para quitar em exatamente `n` meses.
 *
 *   P = r·B / (1 − (1 + r)^−n)
 *
 * É a pergunta inversa de `payoffMonths`: em vez de "quanto tempo com esta
 * parcela", responde "quanto por mês para acabar nesta data".
 */
export function pagamentoParaQuitarEm(balance: number, monthlyRate: number, meses: number): number | null {
  if (balance <= 0) return 0;
  if (!Number.isFinite(meses) || meses <= 0) return null;

  // Arredonda para CIMA, ao centavo. Arredondar para baixo deixa um resíduo de
  // centavos que empurra a quitação para um mês a mais — a resposta seria
  // "pague isto por 12 meses" e a dívida terminaria em 13. Para "quanto
  // preciso pagar", errar para cima custa centavos; errar para baixo custa um
  // mês inteiro de juros.
  const aoCentavoAcima = (n: number) => Math.ceil(n * 100) / 100;

  if (monthlyRate <= 0) return aoCentavoAcima(balance / meses);

  return aoCentavoAcima((monthlyRate * balance) / (1 - (1 + monthlyRate) ** -meses));
}

export interface PayoffPoint {
  month: number;
  balance: number;
  interest: number;
  principal: number;
}

export interface PayoffResult {
  /** null = não quita neste ritmo */
  months: number | null;
  totalInterest: number;
  totalPaid: number;
  timeline: PayoffPoint[];
  /** Data prevista da quitação, a partir de hoje */
  payoffDate: Date | null;
}

/**
 * Simula a quitação mês a mês.
 *
 * Usa iteração em vez da fórmula fechada de propósito: o último pagamento é
 * quase sempre parcial, e só a iteração dá o total de juros correto e a linha
 * do tempo para o gráfico.
 */
export function simulatePayoff(
  balance: number,
  monthlyRate: number,
  payment: number,
  startFrom: Date = new Date(),
): PayoffResult {
  const timeline: PayoffPoint[] = [];
  let current = balance;
  let totalInterest = 0;
  let totalPaid = 0;

  if (balance <= 0) {
    return { months: 0, totalInterest: 0, totalPaid: 0, timeline: [], payoffDate: startFrom };
  }

  if (payment <= 0 || (monthlyRate > 0 && payment <= minimumViablePayment(balance, monthlyRate))) {
    return { months: null, totalInterest: Infinity, totalPaid: Infinity, timeline: [], payoffDate: null };
  }

  for (let month = 1; month <= MAX_MONTHS; month++) {
    const interest = current * monthlyRate;
    // O último pagamento é só o que falta — ninguém paga a mais para quitar.
    const due = current + interest;
    const paid = Math.min(payment, due);
    const principal = paid - interest;

    current = due - paid;
    totalInterest += interest;
    totalPaid += paid;

    timeline.push({
      month,
      balance: Math.max(0, round2(current)),
      interest: round2(interest),
      principal: round2(principal),
    });

    if (current <= 0.005) {
      const payoffDate = new Date(startFrom);
      payoffDate.setMonth(payoffDate.getMonth() + month);
      return { months: month, totalInterest: round2(totalInterest), totalPaid: round2(totalPaid), timeline, payoffDate };
    }
  }

  return { months: null, totalInterest: Infinity, totalPaid: Infinity, timeline, payoffDate: null };
}

export interface StrategyStep {
  debtId: string;
  name: string;
  /** Mês em que esta dívida foi quitada */
  month: number;
}

export interface StrategyResult {
  order: 'avalanche' | 'snowball';
  /** null = não quita dentro do limite de simulação */
  months: number | null;
  totalInterest: number;
  /** false quando o orçamento não cobre nem as parcelas mínimas */
  feasible: boolean;
  /** Soma das parcelas mínimas — orçamento abaixo disso é inviável */
  requiredMinimum: number;
  payoffOrder: StrategyStep[];
}

/**
 * Simula a quitação de várias dívidas com um orçamento mensal total.
 *
 * Em ambas as estratégias todas as dívidas recebem a parcela mínima, e a sobra
 * vai inteira para a dívida prioritária. Quando uma é quitada, a parcela dela
 * é liberada e engrossa a sobra — é o efeito "bola de neve", que vale para as
 * duas ordens.
 *
 * A diferença está só em quem é a prioritária:
 *   avalanche -> maior taxa primeiro  (menos juros no total; é o certo)
 *   snowball  -> menor saldo primeiro (quita uma antes; motiva mais)
 */
export function simulateStrategy(
  debts: Debt[],
  monthlyBudget: number,
  order: 'avalanche' | 'snowball',
  startFrom: Date = new Date(),
): StrategyResult {
  const active = debts
    .filter(d => isActive(d) && d.current_balance > 0)
    .map(d => ({ ...d, balance: d.current_balance }));

  const requiredMinimum = active.reduce((acc, d) => acc + d.minimum_payment, 0);

  const empty: StrategyResult = {
    order, months: 0, totalInterest: 0, feasible: true,
    requiredMinimum, payoffOrder: [],
  };
  if (active.length === 0) return empty;

  if (monthlyBudget < requiredMinimum) {
    return { order, months: null, totalInterest: Infinity, feasible: false, requiredMinimum, payoffOrder: [] };
  }

  const payoffOrder: StrategyStep[] = [];
  let totalInterest = 0;

  for (let month = 1; month <= MAX_MONTHS; month++) {
    const remaining = active.filter(d => d.balance > 0.005);
    if (remaining.length === 0) {
      return { order, months: month - 1, totalInterest: round2(totalInterest), feasible: true, requiredMinimum, payoffOrder };
    }

    // 1) juros do mês
    for (const d of remaining) {
      const interest = d.balance * d.monthly_rate;
      d.balance += interest;
      totalInterest += interest;
    }

    // 2) parcela mínima em todas, limitada ao saldo
    let budgetLeft = monthlyBudget;
    for (const d of remaining) {
      const pay = Math.min(d.minimum_payment, d.balance, budgetLeft);
      d.balance -= pay;
      budgetLeft -= pay;
    }

    // 3) a sobra vai para a prioritária, e transborda para a próxima
    const priority = [...remaining]
      .filter(d => d.balance > 0.005)
      .sort((a, b) => order === 'avalanche'
        ? b.monthly_rate - a.monthly_rate || a.balance - b.balance
        : a.balance - b.balance || b.monthly_rate - a.monthly_rate);

    for (const d of priority) {
      if (budgetLeft <= 0.005) break;
      const pay = Math.min(budgetLeft, d.balance);
      d.balance -= pay;
      budgetLeft -= pay;
    }

    // 4) registra o que foi quitado neste mês
    for (const d of remaining) {
      if (d.balance <= 0.005 && !payoffOrder.some(s => s.debtId === d.id)) {
        d.balance = 0;
        payoffOrder.push({ debtId: d.id, name: d.name, month });
      }
    }
  }

  return { order, months: null, totalInterest: Infinity, feasible: true, requiredMinimum, payoffOrder };
}

export interface StrategyComparison {
  avalanche: StrategyResult;
  snowball: StrategyResult;
  /** Quanto a avalanche economiza de juros em relação à bola de neve */
  interestSaved: number;
  /** Quantos meses a avalanche adianta (pode ser negativo) */
  monthsSaved: number;
}

export function compareStrategies(
  debts: Debt[],
  monthlyBudget: number,
  startFrom: Date = new Date(),
): StrategyComparison {
  const avalanche = simulateStrategy(debts, monthlyBudget, 'avalanche', startFrom);
  const snowball = simulateStrategy(debts, monthlyBudget, 'snowball', startFrom);

  const bothFinite = Number.isFinite(avalanche.totalInterest) && Number.isFinite(snowball.totalInterest);

  return {
    avalanche,
    snowball,
    interestSaved: bothFinite ? round2(snowball.totalInterest - avalanche.totalInterest) : 0,
    monthsSaved: (avalanche.months !== null && snowball.months !== null)
      ? snowball.months - avalanche.months
      : 0,
  };
}

export interface ExtraPaymentResult {
  baseMonths: number | null;
  extraMonths: number | null;
  monthsSaved: number;
  interestSaved: number;
}

/**
 * "Se eu colocar +R$ X por mês, o que muda?"
 * A pergunta mais acionável do módulo: transforma um valor abstrato em meses
 * de vida a menos com a dívida.
 */
export function simulateExtraPayment(
  balance: number,
  monthlyRate: number,
  payment: number,
  extra: number,
): ExtraPaymentResult {
  const base = simulatePayoff(balance, monthlyRate, payment);
  const withExtra = simulatePayoff(balance, monthlyRate, payment + extra);

  const bothFinite = Number.isFinite(base.totalInterest) && Number.isFinite(withExtra.totalInterest);

  return {
    baseMonths: base.months,
    extraMonths: withExtra.months,
    monthsSaved: (base.months !== null && withExtra.months !== null) ? base.months - withExtra.months : 0,
    interestSaved: bothFinite ? round2(base.totalInterest - withExtra.totalInterest) : 0,
  };
}

export interface DebtSummary {
  total: number;
  expensiveTotal: number;
  monthlyInterest: number;
  expensiveMonthlyInterest: number;
  requiredMinimum: number;
  count: number;
  expensiveCount: number;
  /** A que mais custa por mês em juros — não necessariamente a maior */
  mostExpensive: Debt | null;
  /** Taxa da pior dívida, para comparar com rendimento */
  highestRate: number;
}

export function summarizeDebts(debts: Debt[]): DebtSummary {
  const active = debts.filter(isActive);
  const expensive = active.filter(isExpensive);

  const mostExpensive = active.length
    ? active.reduce((worst, d) => monthlyInterestCost(d) > monthlyInterestCost(worst) ? d : worst)
    : null;

  return {
    total: round2(active.reduce((a, d) => a + d.current_balance, 0)),
    expensiveTotal: round2(expensive.reduce((a, d) => a + d.current_balance, 0)),
    monthlyInterest: round2(active.reduce((a, d) => a + monthlyInterestCost(d), 0)),
    expensiveMonthlyInterest: round2(expensive.reduce((a, d) => a + monthlyInterestCost(d), 0)),
    requiredMinimum: round2(active.reduce((a, d) => a + d.minimum_payment, 0)),
    count: active.length,
    expensiveCount: expensive.length,
    mostExpensive,
    highestRate: active.reduce((max, d) => Math.max(max, d.monthly_rate), 0),
  };
}

/**
 * Contraste entre o juro da dívida e o rendimento do investimento.
 *
 * Serve para o caso, comum, de alguém com dinheiro aplicado e rotativo aberto:
 * enquanto a dívida cobra mais que o investimento rende, cada real aplicado em
 * vez de quitar está perdendo dinheiro.
 */
export function debtVsInvestment(
  highestDebtRate: number,
  assumedInvestmentMonthlyReturn = 0.01,
): { debtWins: boolean; gapPercentPoints: number } {
  return {
    debtWins: highestDebtRate > assumedInvestmentMonthlyReturn,
    gapPercentPoints: round2((highestDebtRate - assumedInvestmentMonthlyReturn) * 100),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
