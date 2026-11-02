/**
 * Subcategorias — o segundo nível de classificação de um gasto.
 *
 * POR QUE DOIS NÍVEIS
 *   `transactions.category` responde "que natureza tem o gasto": Contas Fixas,
 *   Variáveis, Cartões, Investimentos. O app inteiro depende disso — orçamento,
 *   custo fixo do mês, consultor, rastreador de assinaturas. Mexer ali quebra
 *   tudo em silêncio: o gasto não dá erro, só para de ser contado.
 *
 *   `transactions.subcategoria` responde outra pergunta, independente: "onde
 *   você gastou". Um Uber é Transporte E é Variável ao mesmo tempo. São eixos
 *   diferentes, e separá-los é o que permite importar uma fatura de cartão
 *   inteira sem derrubar nenhum cálculo existente.
 *
 * POR QUE A LISTA É FECHADA
 *   Subcategoria livre não serve para filtrar. A IA devolveria "Uber", "uber",
 *   "Transporte/Aplicativo" e "99" para a mesma coisa, e o filtro viraria
 *   areia. A lista abaixo é o vocabulário permitido; tudo que chega de fora
 *   passa por `normalizarSubcategoria`.
 */

/** O vocabulário permitido. Ordem = ordem de exibição nos seletores. */
export const SUBCATEGORIAS = [
  'Mercado',
  'Alimentação',
  'Transporte',
  'Combustível',
  'Moradia',
  'Saúde',
  'Educação',
  'Assinaturas',
  'Lazer',
  'Vestuário',
  'Beleza',
  'Pets',
  'Viagem',
  'Serviços',
  'Impostos e Tarifas',
  'Outros',
] as const;

export type Subcategoria = (typeof SUBCATEGORIAS)[number];

/**
 * Sinônimos e desvios que a IA produz na prática, mapeados para o vocabulário.
 *
 * Isto não é enfeite: o prompt pede a lista fechada, mas modelo de linguagem
 * desobedece — devolve o nome do estabelecimento, o termo em inglês, ou uma
 * variante plausível. Sem este mapa, cada desvio cai em 'Outros' e o filtro
 * que o usuário pediu fica inútil justamente nos casos mais comuns.
 *
 * As chaves são comparadas já sem acento e em minúsculas.
 */
const SINONIMOS: Record<string, Subcategoria> = {
  // Mercado
  supermercado: 'Mercado',
  mercearia: 'Mercado',
  hortifruti: 'Mercado',
  acougue: 'Mercado',
  padaria: 'Mercado',
  compras: 'Mercado',
  groceries: 'Mercado',

  // Alimentação
  alimentacao: 'Alimentação',
  restaurante: 'Alimentação',
  delivery: 'Alimentação',
  lanche: 'Alimentação',
  lanchonete: 'Alimentação',
  ifood: 'Alimentação',
  cafe: 'Alimentação',
  bar: 'Alimentação',
  food: 'Alimentação',

  // Transporte
  uber: 'Transporte',
  '99': 'Transporte',
  taxi: 'Transporte',
  onibus: 'Transporte',
  metro: 'Transporte',
  estacionamento: 'Transporte',
  pedagio: 'Transporte',
  transport: 'Transporte',
  mobilidade: 'Transporte',

  // Combustível
  combustivel: 'Combustível',
  gasolina: 'Combustível',
  etanol: 'Combustível',
  alcool: 'Combustível',
  diesel: 'Combustível',
  posto: 'Combustível',

  // Moradia
  moradia: 'Moradia',
  casa: 'Moradia',
  aluguel: 'Moradia',
  condominio: 'Moradia',
  luz: 'Moradia',
  energia: 'Moradia',
  agua: 'Moradia',
  gas: 'Moradia',
  internet: 'Moradia',
  telefone: 'Moradia',
  iptu: 'Moradia',

  // Saúde
  saude: 'Saúde',
  farmacia: 'Saúde',
  medico: 'Saúde',
  dentista: 'Saúde',
  exame: 'Saúde',
  plano: 'Saúde',
  academia: 'Saúde',
  health: 'Saúde',

  // Educação
  educacao: 'Educação',
  escola: 'Educação',
  faculdade: 'Educação',
  curso: 'Educação',
  livro: 'Educação',
  mensalidade: 'Educação',

  // Assinaturas
  assinatura: 'Assinaturas',
  assinaturas: 'Assinaturas',
  streaming: 'Assinaturas',
  netflix: 'Assinaturas',
  spotify: 'Assinaturas',
  software: 'Assinaturas',
  app: 'Assinaturas',

  // Lazer
  lazer: 'Lazer',
  entretenimento: 'Lazer',
  cinema: 'Lazer',
  jogo: 'Lazer',
  jogos: 'Lazer',
  show: 'Lazer',
  presente: 'Lazer',

  // Vestuário
  vestuario: 'Vestuário',
  roupa: 'Vestuário',
  roupas: 'Vestuário',
  calcado: 'Vestuário',
  sapato: 'Vestuário',

  // Beleza
  beleza: 'Beleza',
  salao: 'Beleza',
  barbeiro: 'Beleza',
  cosmetico: 'Beleza',

  // Pets
  pet: 'Pets',
  pets: 'Pets',
  veterinario: 'Pets',
  racao: 'Pets',

  // Viagem
  viagem: 'Viagem',
  hotel: 'Viagem',
  passagem: 'Viagem',
  hospedagem: 'Viagem',

  // Serviços
  servico: 'Serviços',
  servicos: 'Serviços',
  manutencao: 'Serviços',
  conserto: 'Serviços',
  lavanderia: 'Serviços',

  // Impostos e Tarifas
  imposto: 'Impostos e Tarifas',
  impostos: 'Impostos e Tarifas',
  tarifa: 'Impostos e Tarifas',
  taxa: 'Impostos e Tarifas',
  juros: 'Impostos e Tarifas',
  multa: 'Impostos e Tarifas',
  anuidade: 'Impostos e Tarifas',
  iof: 'Impostos e Tarifas',

  // Outros
  outro: 'Outros',
  outros: 'Outros',
  diversos: 'Outros',
  other: 'Outros',
};

/** Minúsculas, sem acento, sem pontuação de borda. */
function achatar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Índice do vocabulário achatado → valor canônico. */
const CANONICO = new Map<string, Subcategoria>(
  SUBCATEGORIAS.map((s) => [achatar(s), s]),
);

/**
 * Converte o que veio de fora no vocabulário canônico.
 *
 * Devolve null quando não há correspondência — de propósito. Chutar 'Outros'
 * aqui esconderia a diferença entre "a IA não classificou" e "a IA disse que é
 * diverso", e quem chama precisa dessa distinção para decidir se vale tentar o
 * palpite local por palavra-chave.
 */
export function normalizarSubcategoria(valor: string | null | undefined): Subcategoria | null {
  if (!valor) return null;

  const chave = achatar(String(valor));
  if (!chave) return null;

  const exato = CANONICO.get(chave);
  if (exato) return exato;

  const sinonimo = SINONIMOS[chave];
  if (sinonimo) return sinonimo;

  // "transporte urbano", "mercado livre compras": a primeira palavra que bate
  // decide. Palavra inteira só, para "gas" não casar dentro de "gasto".
  for (const palavra of chave.split(' ')) {
    const porPalavra = CANONICO.get(palavra) ?? SINONIMOS[palavra];
    if (porPalavra) return porPalavra;
  }

  return null;
}

/**
 * Palpite local a partir da descrição do lançamento, sem chamar IA.
 *
 * Serve para dois casos: a IA não devolveu subcategoria, e o lançamento foi
 * digitado à mão. É só palpite — barato, offline e errando para 'Outros' em vez
 * de inventar.
 */
export function subcategoriaSugerida(titulo: string | null | undefined): Subcategoria {
  return normalizarSubcategoria(titulo) ?? 'Outros';
}

/** Para o prompt da IA: o vocabulário em uma linha. */
export function vocabularioParaPrompt(): string {
  return SUBCATEGORIAS.map((s) => `"${s}"`).join(', ');
}

/** Rótulo de quem ficou sem classificação. Não é uma subcategoria. */
export const NAO_CLASSIFICADO = 'Não classificado';

export interface GastoPorSubcategoria {
  rotulo: Subcategoria | typeof NAO_CLASSIFICADO;
  total: number;
  /** Fatia do gasto do período, 0 a 100. */
  percentual: number;
  /** Quantos lançamentos entraram. Serve para a pessoa saber se o número é
   *  uma compra grande ou muitas pequenas. */
  itens: number;
}

/**
 * Soma o gasto por subcategoria, do maior para o menor.
 *
 * Só despesa: receita não tem "onde foi gasto", e misturar as duas faria o
 * percentual mentir. Lançamento sem subcategoria vira um grupo próprio em vez
 * de desaparecer — gasto escondido é pior que gasto sem nome.
 */
export function resumoPorSubcategoria(
  transacoes: Array<{ type?: string; amount?: number; subcategoria?: string | null }>,
): GastoPorSubcategoria[] {
  const soma = new Map<string, { total: number; itens: number }>();
  let totalGeral = 0;

  for (const t of transacoes) {
    if (t?.type !== 'expense') continue;

    const valor = Number(t.amount);
    if (!Number.isFinite(valor) || valor <= 0) continue;

    const rotulo = normalizarSubcategoria(t.subcategoria) ?? NAO_CLASSIFICADO;
    const atual = soma.get(rotulo) ?? { total: 0, itens: 0 };
    soma.set(rotulo, { total: atual.total + valor, itens: atual.itens + 1 });
    totalGeral += valor;
  }

  return [...soma.entries()]
    .map(([rotulo, { total, itens }]) => ({
      rotulo: rotulo as GastoPorSubcategoria['rotulo'],
      total,
      percentual: totalGeral > 0 ? (total / totalGeral) * 100 : 0,
      itens,
    }))
    .sort((a, b) => b.total - a.total);
}
