/**
 * Normalização do que a leitura por IA devolve.
 *
 * Função pura, sem I/O, para ser testável: a rota `/api/extract` importa a
 * cadeia do Supabase e não roda na suíte.
 *
 * O modelo recebe regras no prompt e desobedece — devolve o nome do
 * estabelecimento como subcategoria, inventa categoria, e classifica compra de
 * fatura como "Contas Fixas". Tudo que precisa ser verdade sobre o resultado
 * é garantido aqui, não lá.
 */

import { normalizarSubcategoria, subcategoriaSugerida } from './subcategorias';
import { detectarParcela, parcelaValida, type Parcela } from './parcelas';

/** Categorias macro aceitas em despesa. É o eixo de que o app inteiro depende. */
const CATEGORIAS_DESPESA = ['Contas Fixas', 'Variáveis', 'Cartões', 'Investimentos'];

export interface ItemExtraido {
  description?: string;
  amount?: number;
  category?: string;
  subcategoria?: string | null;
  type?: string;
  origem?: string;
  parcela_atual?: unknown;
  parcela_total?: unknown;
}

export interface ItemNormalizado {
  description?: string;
  amount?: number;
  category: string;
  subcategoria: string;
  type?: string;
  /** `null` quando a compra é à vista. */
  parcela: Parcela | null;
}

/**
 * Deixa a lista pronta para virar lançamento.
 *
 * Numa fatura de cartão, toda linha vira `Cartões` — não importa o que a
 * compra seja. Deixar o modelo decidir "fixo ou variável" compra a compra
 * espalharia gasto de cartão dentro de Custos Fixos, que é o número usado para
 * saber quanto é preciso ganhar todo mês. O que a compra É fica na
 * subcategoria, que é o eixo criado para isso.
 *
 * Basta um item marcado como fatura para o documento inteiro ser tratado como
 * fatura: o modelo às vezes marca só as primeiras linhas.
 */
export function normalizarItensExtraidos(bruto: unknown): ItemNormalizado[] {
  // Item único costuma vir como objeto, não como lista de um.
  const itens: ItemExtraido[] = Array.isArray(bruto)
    ? bruto
    : bruto && typeof bruto === 'object'
      ? [bruto as ItemExtraido]
      : [];

  const ehFatura = itens.some(
    (i) => String(i?.origem ?? '').trim().toLowerCase() === 'fatura',
  );

  return itens.map((item) => {
    const ehReceita = item?.type === 'income';

    return {
      description: item?.description,
      amount: item?.amount,
      type: item?.type,
      category: categoriaDe(item, ehFatura, ehReceita),
      subcategoria: ehReceita
        ? 'Outros'
        : (normalizarSubcategoria(item?.subcategoria) ?? subcategoriaSugerida(item?.description)),
      parcela: ehReceita ? null : parcelaDe(item),
    };
  });
}

/**
 * Parcelamento da compra, pelo caminho mais confiável disponível.
 *
 * O modelo enxerga a fatura inteira e acerta mais do que uma regex: quando ele
 * devolve os campos, são eles que valem. A leitura da descrição fica como
 * reserva para quando ele omite — o que acontece bastante.
 */
function parcelaDe(item: ItemExtraido): Parcela | null {
  const numero = Number(item?.parcela_atual);
  const total = Number(item?.parcela_total);

  if (parcelaValida(numero, total)) return { numero, total };

  return detectarParcela(item?.description);
}

function categoriaDe(item: ItemExtraido, ehFatura: boolean, ehReceita: boolean): string {
  if (ehReceita) return item?.category || 'Salário';
  if (ehFatura) return 'Cartões';

  // Categoria fora do vocabulário vira "Variáveis": é o balde certo para
  // despesa não identificada, e é o que o formulário manual já usa de padrão.
  const informada = String(item?.category ?? '').trim();
  return CATEGORIAS_DESPESA.includes(informada) ? informada : 'Variáveis';
}
