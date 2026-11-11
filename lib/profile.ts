/**
 * Perfil financeiro — o "protocolo" que adapta o app a cada usuário.
 *
 * Antes deste arquivo, os limites do dashboard eram constantes universais
 * (30% / 50% da renda, reserva de R$ 21.000). Isso quebra na prática: 50% em
 * gastos variáveis é normal para um autônomo e é alerta para um CLT; uma
 * reserva de R$ 21.000 é pouco para quem ganha R$ 15.000 e é inalcançável para
 * quem ganha R$ 1.800.
 *
 * Aqui tudo é derivado de duas fontes:
 *   1. O que o usuário DECLAROU no onboarding (tabela profiles)
 *   2. O que o app OBSERVOU nas transações reais
 *
 * A observação tem prioridade sobre a declaração sempre que existir dado
 * suficiente — usuário chuta a própria renda, o extrato não.
 *
 * Nada aqui faz I/O. Recebe dados prontos e devolve números, para continuar
 * testável e para não criar mais uma chamada de getSession().
 */

import { EXPENSIVE_DEBT_RATE } from "./debt";
import { MESES_PARA_INDEPENDENCIA, TAXA_RETIRADA_SEGURA } from "./constantes-financeiras";
import { ehMovimentoDeMeta } from "./aporte-meta";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type IncomeType = 'fixa' | 'variavel';
export type StrategyId = '50_30_20' | '40_20_40' | '80_20';
export type MainGoal = 'quitar_dividas' | 'reserva' | 'investir' | 'organizar';

/** Espelha as colunas de profiles criadas em 2026-09-29-perfil-financeiro.sql */
export interface FinancialProfile {
  monthly_income: number | null;
  income_type: IncomeType | null;
  strategy: StrategyId | null;
  has_debt: boolean | null;
  main_goal: MainGoal | null;
  onboarded_at: string | null;
}

export type StageId =
  | 'emergencia'
  | 'estabilidade'
  | 'reserva'
  | 'acumulacao'
  | 'independencia';

export interface Stage {
  id: StageId;
  /** 1 a 5 — útil para comparar progresso e para barras de evolução */
  level: number;
  label: string;
  /** A única coisa que o usuário deveria fazer agora */
  priority: string;
  /** Cor do tema, alinhada ao PILLAR_ACCENTS do dashboard */
  accent: 'rose' | 'amber' | 'blue' | 'indigo' | 'emerald';
}

/** Tudo que a UI precisa saber sobre este usuário, já calculado. */
export interface ProfileInsights {
  stage: Stage;
  /** Renda mensal de referência (observada, com fallback no declarado) */
  referenceIncome: number;
  /** Custo de vida mensal médio, excluindo aportes */
  monthlyCost: number;
  /** Limites de alerta do gargalo, adaptados ao perfil */
  gargaloWarn: number;
  gargaloCritical: number;
  /** Metas de reserva de emergência em R$ */
  reserveMinimum: number;
  reserveIdeal: number;
  /** Quantos meses de custo de vida o usuário já tem guardado */
  reserveMonths: number;
  /** Quanto há hoje na reserva, em R$ */
  reserveAmount: number;
  /** Patrimônio investido considerado: valor de mercado das posições quando
   *  existirem, senão a soma líquida dos aportes lançados. */
  investedTotal: number;
  /** Soma líquida dos aportes lançados em transactions (aportes - resgates) */
  contributedTotal: number;
  /** Valor de mercado das posições cadastradas, ou null se não houver */
  positionsValue: number | null;
  /** Rendimento das posições: valor de mercado - total aportado nelas */
  positionsReturn: number | null;
  /** % da renda que o usuário deveria aportar, conforme a estratégia */
  suggestedSavingsRate: number;
  /** Valor sugerido de aporte mensal, em R$ */
  suggestedContribution: number;
  /** Se false, o app NÃO deve sugerir aporte (dívida cara vem antes) */
  shouldSuggestContribution: boolean;
  /** Reserva + investido, sem contar o mesmo dinheiro duas vezes. */
  patrimonio: number;
  /** De onde saiu a renda de referência: do histórico ou do que foi declarado. */
  fonteDaRenda: FonteDoNumero;
  /** De onde saiu o custo de vida. 'estimado' impede classificar independência. */
  fonteDoCusto: FonteDoNumero;
  /** Quantos meses fechados sustentam a renda de referência. */
  mesesNaBase: number;
  /** Oscilação da renda: desvio padrão sobre a média. null sem base. */
  volatilidadeDaRenda: number | null;
  /** Patrimônio necessário para a independência. null sem custo conhecido. */
  independenciaAlvo: number | null;
  /** 0 a 1. null sem custo conhecido. */
  independenciaProgresso: number | null;
  /** Quanto o patrimônio de hoje renderia por mês a 4% ao ano. ESTIMATIVA. */
  rendaPassivaEstimada: number;
  /** true enquanto o usuário não respondeu o onboarding */
  needsOnboarding: boolean;
}

// ---------------------------------------------------------------------------
// Estratégias de alocação
// Mantidas em sincronia com as do FinancialPlannerModal.
// ---------------------------------------------------------------------------

export const STRATEGIES: Record<StrategyId, {
  id: StrategyId;
  name: string;
  description: string;
  fixed: number;
  variable: number;
  save: number;
}> = {
  '50_30_20': {
    id: '50_30_20',
    name: 'Equilibrado (50/30/20)',
    description: '50% contas fixas, 30% variáveis, 20% guardado. O padrão para a maioria.',
    fixed: 0.5, variable: 0.3, save: 0.2,
  },
  '40_20_40': {
    id: '40_20_40',
    name: 'Agressivo / FIRE (40/20/40)',
    description: 'Corta o consumo ao máximo para guardar 40%. Para quem quer independência cedo.',
    fixed: 0.4, variable: 0.2, save: 0.4,
  },
  '80_20': {
    id: '80_20',
    name: 'Simplista (80/20)',
    description: 'Vive com 80% e guarda 20%, sem microgerenciar categorias.',
    fixed: 0.8, variable: 0.0, save: 0.2,
  },
};

export const DEFAULT_STRATEGY: StrategyId = '50_30_20';

// ---------------------------------------------------------------------------
// Estágios financeiros
// ---------------------------------------------------------------------------

export const STAGES: Record<StageId, Stage> = {
  emergencia: {
    id: 'emergencia', level: 1, accent: 'rose',
    label: 'Modo Emergência',
    priority: 'Parar de cavar. Corte cartões e gastos variáveis e quite a dívida cara antes de qualquer outra coisa.',
  },
  estabilidade: {
    id: 'estabilidade', level: 2, accent: 'amber',
    label: 'Buscando Estabilidade',
    priority: 'Fechar todo mês no azul e formar o primeiro mês de reserva.',
  },
  reserva: {
    id: 'reserva', level: 3, accent: 'blue',
    label: 'Construindo Reserva',
    priority: 'Completar a reserva de emergência antes de investir em qualquer outra coisa.',
  },
  acumulacao: {
    id: 'acumulacao', level: 4, accent: 'indigo',
    label: 'Acumulação',
    priority: 'Reserva pronta. Agora o excedente vai para investimento de longo prazo.',
  },
  independencia: {
    id: 'independencia', level: 5, accent: 'emerald',
    label: 'Independência',
    priority: 'Patrimônio sustenta seu custo de vida. Foco em preservar e diversificar.',
  },
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Categorias que representam o gargalo de consumo. */
export const GARGALO_CATEGORIES = ['Variáveis', 'Cartões', 'Cartões de Crédito'];

/** Aporte não é gasto — nunca entra no custo de vida. */
const INVESTMENT_CATEGORY = 'Investimentos';

type Tx = {
  type?: string;
  category?: string;
  amount?: number;
  date?: string;
  /** Usado só para separar movimento de meta dos demais investimentos. */
  title?: string | null;
  /** Meta que este lançamento alimenta. Preenchido = não entra no investido. */
  goal_id?: string | null;
};

/** 'YYYY-MM' de uma data ISO, sem construir Date (evita o bug de fuso). */
function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** De onde saiu um número que o app exibe. */
export type FonteDoNumero = 'historico' | 'parcial' | 'estimado' | 'declarado';

export interface ValorComFonte {
  valor: number;
  fonte: FonteDoNumero;
  /** Quantos meses fechados sustentam o número. 0 quando é estimado. */
  mesesNaBase: number;
}

export interface SerieMensal {
  /** Totais por mês, em ordem cronológica. */
  valores: number[];
  meses: string[];
  mediana: number;
  mesesNaBase: number;
  /** 3+ meses = histórico; 1 a 2 = parcial; nenhum = vazio. */
  fonte: 'historico' | 'parcial' | 'vazio';
  /** Desvio padrão sobre a média. Mede o quanto o número oscila. null sem base. */
  coeficienteDeVariacao: number | null;
}

/**
 * Série mensal de um subconjunto de transações, nos últimos meses FECHADOS.
 *
 * DUAS CORREÇÕES EM RELAÇÃO À VERSÃO ANTERIOR
 *
 * 1. Mês ativo sem o valor procurado conta ZERO, em vez de sumir.
 *    Antes a série só tinha os meses em que o predicado casou. Para quem
 *    recebeu em 3 de 6 meses, a mediana saía desses 3 — e o app concluía que
 *    a renda recorrente era bem maior do que é. Justamente o perfil de renda
 *    variável, que o resto do arquivo trata com mais cuidado.
 *
 *    "Mês ativo" é mês com QUALQUER lançamento. Mês em que a pessoa não usou
 *    o app não é mês sem renda: é mês sem dado, e entra como nada.
 *
 * 2. O mês corrente fica de fora.
 *    Ele está pela metade. No dia 3, com o aluguel pago e o salário ainda não
 *    recebido, ele puxaria a mediana para baixo e mudaria todo dia.
 *
 * Mediana e não média: um 13º salário ou uma compra grande de uma vez só
 * distorceria a média.
 */
export function serieMensalFechada(params: {
  transacoes: Tx[];
  predicado: (t: Tx) => boolean;
  /** 'AAAA-MM-DD', já no fuso do usuário. */
  hoje: string;
  maxMeses?: number;
}): SerieMensal {
  const { transacoes, predicado, hoje, maxMeses = 6 } = params;
  const mesCorrente = hoje.slice(0, 7);

  const ativos = new Set<string>();
  const somas = new Map<string, number>();

  for (const t of transacoes) {
    if (!t.date) continue;
    const mes = monthKey(t.date);
    if (mes >= mesCorrente) continue;        // mês em andamento e futuros ficam fora

    ativos.add(mes);
    if (predicado(t)) somas.set(mes, (somas.get(mes) ?? 0) + (t.amount ?? 0));
  }

  const meses = [...ativos].sort().slice(-maxMeses);
  const valores = meses.map(m => somas.get(m) ?? 0);

  return {
    valores,
    meses,
    mediana: median(valores),
    mesesNaBase: meses.length,
    fonte: meses.length >= 3 ? 'historico' : meses.length > 0 ? 'parcial' : 'vazio',
    coeficienteDeVariacao: coefVariacao(valores),
  };
}

/** Desvio padrão sobre a média. Null quando não há base ou a média é zero. */
function coefVariacao(valores: number[]): number | null {
  if (valores.length < 2) return null;
  const media = valores.reduce((a, v) => a + v, 0) / valores.length;
  if (media <= 0) return null;
  const variancia = valores.reduce((a, v) => a + (v - media) ** 2, 0) / valores.length;
  return Math.round((Math.sqrt(variancia) / media) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Cálculos públicos
// ---------------------------------------------------------------------------

/**
 * Renda de referência do usuário.
 * Prioriza o observado (mediana das receitas reais); cai no declarado apenas
 * enquanto não houver histórico.
 */
export function getReferenceIncome(
  profile: FinancialProfile | null,
  transactions: Tx[],
  hoje: string,
): ValorComFonte {
  // Exclui Investimentos: venda ou resgate de ativo é patrimônio mudando de
  // lugar, não renda recorrente. Incluir distorceria a mediana e, com ela, a
  // meta de reserva, o aporte sugerido e todos os limites de alerta.
  const serie = serieMensalFechada({
    transacoes: transactions,
    predicado: t => t.type === 'income' && t.category !== INVESTMENT_CATEGORY,
    hoje,
  });

  const declarada = profile?.monthly_income ?? 0;

  // Três meses fechados bastam para a mediana significar alguma coisa.
  if (serie.fonte === 'historico' && serie.mediana > 0) {
    return { valor: serie.mediana, fonte: 'historico', mesesNaBase: serie.mesesNaBase };
  }

  // Com um ou dois meses, o que a pessoa DECLAROU costuma descrever melhor a
  // renda típica do que uma amostra que pode ter pegado justo o mês atípico.
  // Sem nada declarado, a amostra curta ainda é melhor que zero.
  if (declarada > 0) {
    return { valor: declarada, fonte: 'declarado', mesesNaBase: serie.mesesNaBase };
  }
  if (serie.mediana > 0) {
    return { valor: serie.mediana, fonte: 'parcial', mesesNaBase: serie.mesesNaBase };
  }

  return { valor: 0, fonte: 'declarado', mesesNaBase: 0 };
}

/**
 * Custo de vida mensal: despesas recorrentes, excluindo aportes.
 *
 * CASCATA, do mais confiável ao menos:
 *   1. historico  — mediana de 3+ meses fechados
 *   2. parcial    — mediana de 1 ou 2 meses; é pouco, mas é observação real
 *   3. estimado   — o consumo PLANEJADO da estratégia escolhida
 *
 * O passo 3 substitui um `renda × 0,7` que não tinha origem nenhuma. A
 * estratégia já diz quanto a pessoa pretende consumir: no 50/30/20 são 80%
 * da renda (50 de fixo + 30 de variável), no FIRE 60%. Usar o que ela mesma
 * escolheu é mais honesto do que um número redondo — e, no 50/30/20, também
 * é mais conservador: 80% contra os 70% de antes.
 *
 * Importa quem é a fonte: com `estimado`, o app não deve classificar
 * independência financeira nem tratar a meta de reserva como fato.
 */
export function getMonthlyCost(
  transactions: Tx[],
  referenceIncome: number,
  hoje: string,
  profile?: FinancialProfile | null,
): ValorComFonte {
  const serie = serieMensalFechada({
    transacoes: transactions,
    predicado: t => t.type === 'expense' && t.category !== INVESTMENT_CATEGORY,
    hoje,
  });

  if (serie.mediana > 0 && serie.fonte !== 'vazio') {
    return { valor: serie.mediana, fonte: serie.fonte, mesesNaBase: serie.mesesNaBase };
  }

  const estrategia = STRATEGIES[profile?.strategy ?? DEFAULT_STRATEGY] ?? STRATEGIES[DEFAULT_STRATEGY];
  const consumoPlanejado = 1 - estrategia.save;

  return { valor: referenceIncome * consumoPlanejado, fonte: 'estimado', mesesNaBase: 0 };
}

/**
 * Limites de alerta do gargalo (cartões + variáveis), como % da renda.
 *
 * A base é a própria estratégia escolhida: quem optou pelo FIRE aceitou um
 * teto de consumo menor, então merece ser avisado antes. Renda variável ganha
 * folga porque o mês ruim é estrutural, não descuido.
 */
export function getGargaloThresholds(profile: FinancialProfile | null): { warn: number; critical: number } {
  const strategyId = profile?.strategy ?? DEFAULT_STRATEGY;
  const strategy = STRATEGIES[strategyId] ?? STRATEGIES[DEFAULT_STRATEGY];

  // O teto natural de consumo da estratégia é o que sobra fora do aporte,
  // descontando as contas fixas. Ex.: 50/30/20 -> 30% de variáveis.
  const base = strategy.variable > 0 ? strategy.variable : 0.4;

  const warn = base * 100;
  const critical = Math.min(warn + 20, 70);

  if (profile?.income_type === 'variavel') {
    return { warn: warn + 5, critical: Math.min(critical + 5, 75) };
  }
  return { warn, critical };
}

/**
 * Metas da reserva de emergência, em R$.
 *
 * Regra de planejamento padrão: 3 a 6 meses de CUSTO DE VIDA (não de renda).
 * Renda variável exige o dobro, porque a queda de faturamento e a emergência
 * costumam chegar juntas.
 */
export function getReserveTargets(profile: FinancialProfile | null, monthlyCost: number): { minimum: number; ideal: number } {
  const isVariable = profile?.income_type === 'variavel';
  const minMonths = isVariable ? 6 : 3;
  const idealMonths = isVariable ? 12 : 6;

  return {
    minimum: Math.round(monthlyCost * minMonths),
    ideal: Math.round(monthlyCost * idealMonths),
  };
}

/**
 * Classifica o usuário em um dos 5 estágios.
 *
 * A ordem dos testes importa: emergência tem precedência sobre tudo. Não
 * adianta parabenizar quem tem reserva formada mas está pagando 15% ao mês de
 * rotativo — esse dinheiro está sendo destruído, não construído.
 */
/**
 * Déficit recorrente: gastou mais do que ganhou, e não foi uma vez só.
 *
 * Um mês ruim acontece — conserto de carro, dentista, matrícula de escola.
 * O que caracteriza emergência é o padrão, não o episódio. Por isso exige
 * pelo menos 2 dos últimos 3 meses FECHADOS no vermelho.
 *
 * Meses fechados, e não o corrente: no dia 3, com o aluguel pago e o salário
 * ainda não creditado, todo mundo parece estar gastando mais do que ganha.
 *
 * Investimentos ficam de fora dos DOIS lados, simetricamente: aporte não é
 * consumo, e resgate não é renda. Contar só de um lado inventaria déficit em
 * quem aportou, ou esconderia o déficit de quem resgatou para cobrir o rombo.
 */
export function temDeficitRecorrente(params: {
  transacoes: Tx[];
  hoje: string;
  mesesParaOlhar?: number;
  minimoDeMesesNoVermelho?: number;
}): boolean {
  const { transacoes, hoje, mesesParaOlhar = 3, minimoDeMesesNoVermelho = 2 } = params;

  const receitas = serieMensalFechada({
    transacoes,
    predicado: t => t.type === 'income' && t.category !== INVESTMENT_CATEGORY,
    hoje,
    maxMeses: mesesParaOlhar,
  });

  const despesas = serieMensalFechada({
    transacoes,
    predicado: t => t.type === 'expense' && t.category !== INVESTMENT_CATEGORY,
    hoje,
    maxMeses: mesesParaOlhar,
  });

  // As duas séries vêm dos mesmos meses ativos, então os índices casam.
  let noVermelho = 0;
  for (let i = 0; i < receitas.valores.length; i++) {
    const entrou = receitas.valores[i];
    const saiu = despesas.valores[i] ?? 0;

    // Mês sem NENHUMA receita lançada não prova déficit — prova que a pessoa
    // não lança receita. Muita gente usa o app só para acompanhar gasto, e
    // tratar isso como "gastou mais do que ganhou" prenderia essas pessoas no
    // Modo Emergência para sempre, sem caminho de saída.
    if (entrou <= 0) continue;

    if (saiu >= entrou) noVermelho++;
  }

  return noVermelho >= minimoDeMesesNoVermelho;
}

export function computeStage(params: {
  profile: FinancialProfile | null;
  referenceIncome: number;
  monthlyCost: number;
  /** Despesas >= receitas em pelo menos 2 dos últimos 3 meses FECHADOS. */
  deficitRecorrente: boolean;
  reserveAmount: number;
  investedTotal: number;
  reserveIdeal: number;
  /** true quando o usuário já cadastrou ao menos uma dívida na tabela `debts` */
  hasRegisteredDebts?: boolean;
  /** Soma dos saldos de dívidas CARAS (taxa >= 3% a.m.) */
  expensiveDebtTotal?: number;
  /** true quando o custo de vida é palpite, não observação. Bloqueia o
   *  Estágio 5: ninguém deve ser declarado independente com base num chute. */
  custoEhEstimado?: boolean;
}): Stage {
  const {
    profile, monthlyCost, deficitRecorrente,
    reserveAmount, investedTotal, reserveIdeal,
  } = params;

  // Dívida cara: a tabela `debts` manda quando existir pelo menos uma dívida
  // cadastrada. O booleano `has_debt` continua valendo apenas enquanto o
  // usuário ainda não cadastrou nada — senão quem respondeu "sim" no
  // onboarding e nunca cadastrou ficaria preso no Estágio 1 para sempre,
  // e quem respondeu "não" sairia mesmo com dívida registrada.
  const hasDebt = params.hasRegisteredDebts
    ? (params.expensiveDebtTotal ?? 0) > 0
    : profile?.has_debt === true;

  const patrimonio = reserveAmount + investedTotal;

  // 1. Emergência — insolvência ou iliquidez, nada além disso.
  //
  // SAIU DAQUI: `gargaloPercent > 50`.
  // Gastar demais em cartão e variáveis com a poupança positiva é problema de
  // COMPORTAMENTO, não emergência financeira. Como o Estágio 1 bloqueia a
  // sugestão de aporte, quem consumia muito mas fechava o mês no azul era
  // impedido de guardar dinheiro — a punição não tinha relação com o
  // problema. O gargalo continua existindo, como ALERTA, em gargaloWarn e
  // gargaloCritical.
  //
  // MUDOU: o déficit era medido no mês CORRENTE, que está pela metade. No dia
  // 3, com o aluguel pago e o salário ainda não creditado, qualquer pessoa
  // caía em Modo Emergência. Agora é déficit RECORRENTE, medido em meses
  // fechados.
  if (hasDebt || deficitRecorrente) {
    return STAGES.emergencia;
  }

  // 5. Independência — patrimônio cobre 300 meses (25 anos) de custo de vida.
  //
  // Exige custo OBSERVADO. Com custo estimado, o alvo é derivado de outro
  // palpite — a renda declarada vezes a fatia da estratégia — e declarar
  // independência financeira em cima disso seria irresponsável.
  //
  // Era 92, com este mesmo comentário citando a regra dos 4%. Mas 4% ao ano
  // sobre o patrimônio pede 12/0,04 = 300 meses de despesa; 92 meses
  // equivalem a sacar 13% ao ano. O app declarava independência a quem tinha
  // menos de um terço do necessário.
  if (!params.custoEhEstimado && monthlyCost > 0 && patrimonio >= monthlyCost * MESES_PARA_INDEPENDENCIA) {
    return STAGES.independencia;
  }

  // 4. Acumulação — reserva completa, sobra vai para investimento.
  if (reserveIdeal > 0 && reserveAmount >= reserveIdeal) {
    return STAGES.acumulacao;
  }

  // 2. Estabilidade — ainda não tem nem um mês de colchão.
  if (monthlyCost > 0 && reserveAmount < monthlyCost) {
    return STAGES.estabilidade;
  }

  // 3. Reserva — tem colchão, falta completar.
  return STAGES.reserva;
}

export interface StageStep {
  stage: Stage;
  status: 'done' | 'current' | 'locked';
  /** O que precisa acontecer para concluir este estágio. */
  goal: string;
  /** Alvo em R$, quando o critério for financeiro. */
  target: number | null;
  /** Quanto falta em R$ para bater o alvo. */
  remaining: number | null;
}

/**
 * Monta a escada dos 5 estágios com o critério concreto de cada degrau,
 * calculado sobre os números reais do usuário.
 *
 * Existe porque a faixa do dashboard mostrava "Estágio 1/5" sem dizer quais
 * eram os outros quatro nem quanto faltava para o próximo — uma barra de
 * progresso sem régua.
 */
export function getStageLadder(insights: ProfileInsights): StageStep[] {
  const { stage, monthlyCost, reserveAmount, reserveIdeal, investedTotal, gargaloCritical } = insights;

  const patrimonio = reserveAmount + investedTotal;
  const independenceTarget = monthlyCost * MESES_PARA_INDEPENDENCIA;

  const defs: Array<{ id: StageId; goal: string; target: number | null; current: number }> = [
    {
      id: 'emergencia',
      goal: `Quitar a dívida cara e manter cartões e variáveis abaixo de ${gargaloCritical.toFixed(0)}% da renda.`,
      target: null,
      current: 0,
    },
    {
      id: 'estabilidade',
      goal: 'Guardar o primeiro mês de custo de vida.',
      target: monthlyCost > 0 ? monthlyCost : null,
      current: reserveAmount,
    },
    {
      id: 'reserva',
      goal: 'Completar a reserva de emergência ideal.',
      target: reserveIdeal > 0 ? reserveIdeal : null,
      current: reserveAmount,
    },
    {
      id: 'acumulacao',
      goal: `Acumular patrimônio de ${MESES_PARA_INDEPENDENCIA}× seu custo mensal — 25 anos de despesa.`,
      target: independenceTarget > 0 ? independenceTarget : null,
      current: patrimonio,
    },
    {
      id: 'independencia',
      goal: 'Seu patrimônio sustenta seu custo de vida. Foco em preservar e diversificar.',
      target: null,
      current: 0,
    },
  ];

  return defs.map(def => {
    const s = STAGES[def.id];
    const status: StageStep['status'] =
      s.level < stage.level ? 'done' : s.level === stage.level ? 'current' : 'locked';

    return {
      stage: s,
      status,
      goal: def.goal,
      target: def.target,
      remaining: def.target !== null ? Math.max(0, def.target - def.current) : null,
    };
  });
}

/**
 * Ponto de entrada único: recebe o perfil declarado + as transações e devolve
 * tudo que a UI precisa. Dashboard, modais e o prompt da IA leem daqui.
 */
export function getProfileInsights(params: {
  profile: FinancialProfile | null;
  allTransactions: Tx[];
  monthIncome: number;
  monthExpense: number;
  monthGargalo: number;
  reserveAmount: number;
  /** Posições cadastradas. Quando existirem, o valor de mercado delas vale
   *  mais que a soma dos aportes para medir patrimônio. */
  positions?: Array<{ invested_amount?: number; current_value?: number }>;
  /** Dívidas ativas. Quando houver, substituem o booleano has_debt. */
  debts?: Array<{ current_balance?: number; monthly_rate?: number; status?: string }>;
  /** Hoje, 'AAAA-MM-DD' no fuso do usuário. Obrigatório: nenhuma regra deste
   *  arquivo pode ter relógio escondido dentro dela. */
  hoje: string;
}): ProfileInsights {
  const { profile, allTransactions, monthIncome, monthExpense, monthGargalo, reserveAmount, positions, debts, hoje } = params;

  const serieRenda = serieMensalFechada({
    transacoes: allTransactions,
    predicado: t => t.type === 'income' && t.category !== INVESTMENT_CATEGORY,
    hoje,
  });

  const renda = getReferenceIncome(profile, allTransactions, hoje);
  const custo = getMonthlyCost(allTransactions, renda.valor, hoje, profile);
  const referenceIncome = renda.valor;
  const monthlyCost = custo.valor;

  const { warn, critical } = getGargaloThresholds(profile);
  const { minimum, ideal } = getReserveTargets(profile, monthlyCost);

  // O gargalo é medido contra a renda DO MÊS quando ela existe; se o mês ainda
  // está vazio, usa a renda de referência para não exibir 0% enganoso.
  const incomeBase = monthIncome > 0 ? monthIncome : referenceIncome;
  const gargaloPercent = incomeBase > 0 ? (monthGargalo / incomeBase) * 100 : 0;

  // Patrimônio investido LÍQUIDO: aportes menos resgates. Antes contava só
  // aportes, então uma venda de ativo não reduzia o patrimônio — e ainda por
  // cima inflava a renda. O mesmo lançamento contava duas vezes, das duas
  // formas erradas.
  //
  // O aporte à RESERVA fica de fora: ele já é contado em `reserveAmount`,
  // que vem de goals.current_amount. O botão "Poupar" grava as duas coisas —
  // a despesa, que derruba o saldo em conta, e a soma na meta — e as duas
  // estão certas isoladamente. Somá-las no patrimônio é que contava o mesmo
  // dinheiro duas vezes: cinco aportes de R$ 1.000 viravam R$ 10.000.
  const contributedTotal = allTransactions
    .filter(t => t.category === INVESTMENT_CATEGORY && !ehMovimentoDeMeta(t))
    .reduce((acc, t) => acc + (t.type === 'expense' ? (t.amount ?? 0) : -(t.amount ?? 0)), 0);

  // Valor de mercado vence soma de aportes: quem tem posição cadastrada sabe
  // quanto ela vale hoje, e é isso que mede patrimônio. Sem posição, cai nos
  // aportes. Nunca soma os dois — seria contar o mesmo dinheiro duas vezes.
  const hasPositions = Array.isArray(positions) && positions.length > 0;
  const positionsValue = hasPositions
    ? positions.reduce((acc, p) => acc + (p.current_value ?? 0), 0)
    : null;
  const positionsInvested = hasPositions
    ? positions.reduce((acc, p) => acc + (p.invested_amount ?? 0), 0)
    : null;
  const positionsReturn = positionsValue !== null && positionsInvested !== null
    ? positionsValue - positionsInvested
    : null;

  const investedTotal = positionsValue !== null ? positionsValue : contributedTotal;

  const activeDebts = (debts ?? []).filter(d => (d.status ?? 'ativa') === 'ativa');
  const hasRegisteredDebts = activeDebts.length > 0;
  const expensiveDebtTotal = activeDebts
    .filter(d => (d.monthly_rate ?? 0) >= EXPENSIVE_DEBT_RATE)
    .reduce((acc, d) => acc + (d.current_balance ?? 0), 0);

  const stage = computeStage({
    profile, referenceIncome, monthlyCost,
    reserveAmount, investedTotal, reserveIdeal: ideal,
    hasRegisteredDebts, expensiveDebtTotal,
    custoEhEstimado: custo.fonte === 'estimado',
    deficitRecorrente: temDeficitRecorrente({ transacoes: allTransactions, hoje }),
  });

  const strategyId = profile?.strategy ?? DEFAULT_STRATEGY;
  const suggestedSavingsRate = (STRATEGIES[strategyId] ?? STRATEGIES[DEFAULT_STRATEGY]).save;

  // Em Modo Emergência o app NÃO sugere aporte: guardar a 1% ao mês enquanto
  // se paga 15% de rotativo destrói patrimônio. Primeiro quita, depois guarda.
  const shouldSuggestContribution = stage.id !== 'emergencia';

  return {
    stage,
    referenceIncome,
    monthlyCost,
    gargaloWarn: warn,
    gargaloCritical: critical,
    reserveMinimum: minimum,
    reserveIdeal: ideal,
    reserveMonths: monthlyCost > 0 ? reserveAmount / monthlyCost : 0,
    reserveAmount,
    investedTotal,
    contributedTotal,
    positionsValue,
    positionsReturn,
    suggestedSavingsRate,
    suggestedContribution: Math.max(0, Math.round(referenceIncome * suggestedSavingsRate)),
    shouldSuggestContribution,
    // Sem custo de vida conhecido não há alvo: devolver 0 faria qualquer
    // patrimônio parecer completo, e dividir por ele daria Infinity.
    patrimonio: reserveAmount + investedTotal,
    fonteDaRenda: renda.fonte,
    fonteDoCusto: custo.fonte,
    mesesNaBase: renda.mesesNaBase,
    volatilidadeDaRenda: serieRenda.coeficienteDeVariacao,
    independenciaAlvo: monthlyCost > 0 ? Math.round(monthlyCost * MESES_PARA_INDEPENDENCIA) : null,
    independenciaProgresso: monthlyCost > 0
      ? Math.min(1, (reserveAmount + investedTotal) / (monthlyCost * MESES_PARA_INDEPENDENCIA))
      : null,
    // ESTIMATIVA, não promessa: é quanto o patrimônio de hoje renderia por mês
    // se a taxa de retirada segura se confirmasse.
    rendaPassivaEstimada: ((reserveAmount + investedTotal) * TAXA_RETIRADA_SEGURA) / 12,
    needsOnboarding: !profile?.onboarded_at,
  };
}
