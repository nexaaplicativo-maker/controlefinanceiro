/**
 * Essencial x desejo — o eixo que a 50/30/20 realmente usa.
 *
 * O PROBLEMA
 * O "gargalo" do app soma `Variáveis` + `Cartões`. Isso mistura DUAS
 * perguntas diferentes: o que você comprou e como você pagou. Mercado e
 * remédio no cartão caem em `Cartões` e viram gargalo, tratados como consumo
 * discricionário; os mesmos itens no Pix caem em `Variáveis`. O mesmo gasto,
 * duas leituras, decidido pelo meio de pagamento.
 *
 * A regra 50/30/20 de Elizabeth Warren separa NECESSIDADES de DESEJOS, não
 * fixo de variável. A subcategoria — que o app já preenche — responde a
 * pergunta certa, porque ela diz onde o dinheiro foi, não por onde passou.
 *
 * ESTE MÓDULO NÃO SUBSTITUI NADA
 * O gargalo continua existindo exatamente como está. Isto calcula AO LADO,
 * para comparar com a estratégia de verdade e para expor o custo essencial —
 * que é o número que a reserva de emergência deveria cobrir.
 */

import { normalizarSubcategoria } from './subcategorias';

export type Natureza = 'essencial' | 'desejo';

/**
 * De onde sai cada subcategoria.
 *
 * As três decisões discutíveis, e o porquê de cada uma:
 *
 *   Pets       -> essencial. Ração e veterinário são saúde de um dependente,
 *                 não lazer. Quem tem um animal não deixa de alimentá-lo ao
 *                 apertar o orçamento.
 *   Serviços   -> essencial. É o balde de encanador, mecânico e conserto:
 *                 manutenção do que já se tem, não aquisição nova.
 *   Alimentação-> desejo. É comer fora, separado de `Mercado`, que é cozinhar
 *                 em casa. A distinção já existe no vocabulário e é exatamente
 *                 a linha entre necessidade e conveniência.
 *   Outros     -> desejo. É o balde do não classificado. Colocá-lo em
 *                 essencial tornaria "não sei o que é" uma necessidade, e o
 *                 custo essencial — que vira meta de reserva — cresceria com
 *                 a desorganização do usuário.
 *
 * Mapa editável de propósito: é uma escolha de produto, não uma lei.
 */
export const NATUREZA_POR_SUBCATEGORIA: Record<string, Natureza> = {
  'Moradia': 'essencial',
  'Mercado': 'essencial',
  'Saúde': 'essencial',
  'Educação': 'essencial',
  'Transporte': 'essencial',
  'Combustível': 'essencial',
  'Impostos e Tarifas': 'essencial',
  'Pets': 'essencial',
  'Serviços': 'essencial',

  'Alimentação': 'desejo',
  'Lazer': 'desejo',
  'Vestuário': 'desejo',
  'Beleza': 'desejo',
  'Viagem': 'desejo',
  'Assinaturas': 'desejo',
  'Outros': 'desejo',
};

export interface RepartoPorNatureza {
  essencial: number;
  desejo: number;
  /** Despesas sem subcategoria reconhecível. Não entram em nenhum dos dois. */
  naoClassificado: number;
  total: number;
  /** % da renda em essenciais. null sem renda para dividir. */
  essencialPercent: number | null;
  desejoPercent: number | null;
}

type Tx = {
  type?: string;
  category?: string;
  amount?: number;
  subcategoria?: string | null;
};

const INVESTIMENTO = 'Investimentos';

/**
 * Reparte as despesas do mês entre necessidade e desejo.
 *
 * Aporte fica de fora: não é consumo de nenhum dos dois tipos — é o que
 * sobrou depois dos dois.
 */
export function repartirPorNatureza(
  transacoes: Tx[],
  rendaReferencia = 0,
): RepartoPorNatureza {
  let essencial = 0;
  let desejo = 0;
  let naoClassificado = 0;

  for (const t of transacoes) {
    if (t.type !== 'expense' || t.category === INVESTIMENTO) continue;

    const valor = t.amount ?? 0;
    const sub = normalizarSubcategoria(t.subcategoria);
    const natureza = sub ? NATUREZA_POR_SUBCATEGORIA[sub] : undefined;

    // Sem subcategoria reconhecível não dá para dizer o que a compra foi.
    // Chutar encheria um dos dois lados com ruído.
    if (!natureza) naoClassificado += valor;
    else if (natureza === 'essencial') essencial += valor;
    else desejo += valor;
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const pct = (n: number) => (rendaReferencia > 0 ? Math.round((n / rendaReferencia) * 10000) / 100 : null);

  return {
    essencial: r2(essencial),
    desejo: r2(desejo),
    naoClassificado: r2(naoClassificado),
    total: r2(essencial + desejo + naoClassificado),
    essencialPercent: pct(essencial),
    desejoPercent: pct(desejo),
  };
}
