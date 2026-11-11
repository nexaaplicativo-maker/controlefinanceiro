/**
 * Diagnóstico de gastos — para onde o dinheiro está indo.
 *
 * Funções puras. Três perguntas que o app não respondia:
 *   1. Quanto de cada categoria, comparado com o normal DESTE usuário?
 *   2. O que fugiu do padrão este mês?
 *   3. O que se repete todo mês sem eu perceber?
 *
 * A terceira substitui a lista de 21 marcas do SubscriptionTrackerModal
 * ('netflix', 'spotify'...), que não detectava recorrência — detectava marcas
 * que alguém digitou um dia, e perdia Alura, seguro do carro, mensalidade da
 * escola e qualquer serviço regional.
 */

export type Tx = {
  id?: string;
  type?: string;
  category?: string;
  amount?: number;
  date?: string;
  title?: string;
};

import { formatMoney as dinheiro } from './format';

const INVESTMENT = 'Investimentos';

/** Mês de uma data ISO, sem construir Date (evita o bug de fuso). */
function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Título reduzido a um padrão estável, para agrupar o que é a mesma coisa. */
export function normalizeForGrouping(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(\d+\/\d+\)/g, '')  // sufixo de parcela
    .replace(/\d+/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// 1. Raio-x por categoria
// ---------------------------------------------------------------------------

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentOfIncome: number;
  /** Mediana desta categoria nos meses anteriores */
  median: number;
  /** Variação contra a mediana, em % (null quando não há histórico) */
  variationPercent: number | null;
  /** Diferença em R$ contra a mediana */
  variationAmount: number;
}

export function breakdownByCategory(params: {
  monthTransactions: Tx[];
  allTransactions: Tx[];
  currentMonth: string;
  income: number;
  monthsOfHistory?: number;
}): CategoryBreakdown[] {
  const { monthTransactions, allTransactions, currentMonth, income, monthsOfHistory = 3 } = params;

  const atual = new Map<string, number>();
  for (const t of monthTransactions) {
    if (t.type !== 'expense' || t.category === INVESTMENT) continue;
    const c = t.category ?? 'Sem categoria';
    atual.set(c, (atual.get(c) ?? 0) + (t.amount ?? 0));
  }

  // Histórico por categoria e por mês, excluindo o mês corrente.
  const historico = new Map<string, Map<string, number>>();
  for (const t of allTransactions) {
    if (t.type !== 'expense' || t.category === INVESTMENT || !t.date) continue;
    const m = monthOf(t.date);
    if (m >= currentMonth) continue;
    const c = t.category ?? 'Sem categoria';
    if (!historico.has(c)) historico.set(c, new Map());
    const porMes = historico.get(c)!;
    porMes.set(m, (porMes.get(m) ?? 0) + (t.amount ?? 0));
  }

  return [...atual.entries()]
    .map(([category, amount]) => {
      const meses = [...(historico.get(category)?.entries() ?? [])]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, monthsOfHistory)
        .map(([, v]) => v);

      const med = meses.length ? round2(median(meses)) : 0;

      return {
        category,
        amount: round2(amount),
        percentOfIncome: income > 0 ? round2((amount / income) * 100) : 0,
        median: med,
        // Sem histórico não há comparação honesta: null, não 0%.
        variationPercent: med > 0 ? round2(((amount - med) / med) * 100) : null,
        variationAmount: round2(amount - med),
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

// ---------------------------------------------------------------------------
// 2. Anomalias
// ---------------------------------------------------------------------------

export interface Anomaly {
  category: string;
  amount: number;
  median: number;
  /** null em gasto NOVO: não há mediana com que comparar. */
  variationPercent: number | null;
  variationAmount: number;
  /** 'novo' = categoria que não existia no histórico e já pesa. */
  severity: 'novo' | 'atencao' | 'alta';
  /** Frase pronta, em linguagem do dia a dia */
  message: string;
}

/**
 * Categorias que fugiram do padrão do próprio usuário.
 * Exige histórico e um valor mínimo para não alarmar por centavos.
 */
export function detectAnomalies(
  breakdown: CategoryBreakdown[],
  opts: { thresholdPercent?: number; minAmount?: number; referenceIncome?: number } = {},
): Anomaly[] {
  const { thresholdPercent = 30, referenceIncome = 0 } = opts;

  // O piso de R$ 50 era fixo e não acompanhava a renda: para quem ganha
  // R$ 2.000 ele é alto demais e cala alertas que importam; para quem ganha
  // R$ 30.000 é baixo demais e alerta por ruído. HEURÍSTICA: 1% da renda,
  // nunca abaixo de R$ 50.
  const minAmount = opts.minAmount ?? Math.max(50, referenceIncome * 0.01);

  const novos: Anomaly[] = breakdown
    // Gasto NOVO: não havia mediana, então variationPercent é null e o filtro
    // antigo descartava a categoria inteira. Uma viagem de R$ 8.000 estreando
    // no mês não gerava alerta nenhum, por maior que fosse.
    .filter(b => b.variationPercent === null && b.amount >= minAmount)
    .map(b => ({
      category: b.category,
      amount: b.amount,
      median: 0,
      variationPercent: null,
      variationAmount: b.amount,
      severity: 'novo' as const,
      message: `${b.category} apareceu agora: ${dinheiro(b.amount)} neste mês, e não havia histórico.`,
    }));

  const desvios: Anomaly[] = breakdown
    .filter(b =>
      b.variationPercent !== null &&
      b.variationPercent >= thresholdPercent &&
      b.variationAmount >= minAmount,
    )
    .map(b => ({
      category: b.category,
      amount: b.amount,
      median: b.median,
      variationPercent: b.variationPercent!,
      variationAmount: b.variationAmount,
      severity: b.variationPercent! >= 60 ? 'alta' as const : 'atencao' as const,
      message: `Você gastou ${dinheiro(b.variationAmount)} a mais em ${b.category} do que o seu normal.`,
    }));

  return [...desvios, ...novos].sort((a, b) => b.variationAmount - a.variationAmount);
}

// ---------------------------------------------------------------------------
// 3. Recorrência real
// ---------------------------------------------------------------------------

export interface RecurringExpense {
  pattern: string;
  /** Título mais recente, para exibir */
  displayName: string;
  category: string;
  monthlyAmount: number;
  yearlyAmount: number;
  occurrences: number;
  monthsSpan: number;
  /** 0 a 1 — quanto o padrão é consistente em frequência e valor */
  confidence: number;
  lastSeen: string;
}

/**
 * Detecta despesas recorrentes por PADRÃO, não por dicionário de marcas.
 *
 * Critério: mesmo título normalizado aparecendo em pelo menos 2 meses
 * distintos, com valores próximos. A confiança combina quantos meses do
 * período tiveram a cobrança e o quanto o valor é estável.
 */
export function detectRecurring(
  allTransactions: Tx[],
  opts: { minOccurrences?: number; maxVariation?: number } = {},
): RecurringExpense[] {
  const { minOccurrences = 2, maxVariation = 0.25 } = opts;

  const grupos = new Map<string, Tx[]>();
  for (const t of allTransactions) {
    if (t.type !== 'expense' || t.category === INVESTMENT || !t.date || !t.title) continue;
    const key = normalizeForGrouping(t.title);
    if (!key) continue;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(t);
  }

  const resultado: RecurringExpense[] = [];

  for (const [pattern, txs] of grupos) {
    const meses = [...new Set(txs.map(t => monthOf(t.date!)))].sort();
    if (meses.length < minOccurrences) continue;

    const valores = txs.map(t => t.amount ?? 0);
    const med = median(valores);
    if (med <= 0) continue;

    // Valor estável? Variação média em relação à mediana.
    const desvio = valores.reduce((a, v) => a + Math.abs(v - med) / med, 0) / valores.length;
    if (desvio > maxVariation) continue;

    // Quantos meses do intervalo realmente tiveram cobrança.
    const primeiro = meses[0];
    const ultimo = meses[meses.length - 1];
    const span = monthsBetween(primeiro, ultimo) + 1;
    const cobertura = meses.length / span;

    const maisRecente = txs
      .slice()
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];

    resultado.push({
      pattern,
      displayName: maisRecente.title!.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim(),
      category: maisRecente.category ?? 'Sem categoria',
      monthlyAmount: round2(med),
      yearlyAmount: round2(med * 12),
      occurrences: meses.length,
      monthsSpan: span,
      // Cobertura pesa mais que estabilidade: algo que aparece todo mês é
      // mais claramente uma assinatura do que algo de valor sempre igual.
      confidence: round2(Math.min(1, cobertura * 0.7 + (1 - desvio) * 0.3)),
      lastSeen: maisRecente.date!,
    });
  }

  return resultado.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

/** Gastos pequenos e frequentes, que somados pesam sem ninguém notar. */
export interface InvisibleSpending {
  count: number;
  total: number;
  averageTicket: number;
  topCategory: string | null;
}

export function detectInvisibleSpending(
  monthTransactions: Tx[],
  maxTicket = 50,
): InvisibleSpending {
  const pequenos = monthTransactions.filter(t =>
    t.type === 'expense' && t.category !== INVESTMENT && (t.amount ?? 0) <= maxTicket,
  );

  const total = pequenos.reduce((a, t) => a + (t.amount ?? 0), 0);

  const porCategoria = new Map<string, number>();
  for (const t of pequenos) {
    const c = t.category ?? 'Sem categoria';
    porCategoria.set(c, (porCategoria.get(c) ?? 0) + (t.amount ?? 0));
  }
  const top = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    count: pequenos.length,
    total: round2(total),
    averageTicket: pequenos.length ? round2(total / pequenos.length) : 0,
    topCategory: top ? top[0] : null,
  };
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}
