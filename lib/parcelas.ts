/**
 * Parcelamento dentro de uma fatura de cartão.
 *
 * Uma fatura mostra "AMERICANAS 03/10": a terceira de dez cobranças. As sete
 * restantes já são dívida assumida, mas só apareciam no app conforme cada
 * fatura seguinte fosse importada — ou seja, a previsão de caixa não enxergava
 * nada do que já estava contratado.
 *
 * Aqui as parcelas futuras viram lançamentos reais, do mesmo jeito que o
 * formulário manual já faz com `installment_group` + `installment_info`. Nada
 * de modelo novo: a tela de cartões e a previsão já sabem ler isso.
 *
 * O risco todo é duplicar. No mês que vem a fatura traz "04/10", que esta
 * projeção já criou. Por isso toda linha parcelada ganha uma chave estável
 * (`chaveParcela`) e quem importa confere antes de inserir.
 *
 * Função pura, sem I/O, para rodar na suíte.
 */

/** Teto de parcelas aceito. O formulário manual permite 48; aqui o limite é
 *  mais apertado de propósito: acima disso é quase sempre leitura errada, e o
 *  estrago de um falso positivo é criar dezenas de lançamentos fantasma. */
export const MAX_PARCELAS = 36;

// A aritmética de meses mora em lib/data.ts, com o resto das datas.
import { somarMeses } from './data';
export { somarMeses };

export interface Parcela {
  numero: number;
  total: number;
}

/**
 * `n/N` plausível como parcelamento.
 *
 * Exige `total >= 2` porque "1/1" não é parcela, e `numero <= total` porque o
 * contrário não existe.
 */
export function parcelaValida(numero: unknown, total: unknown): boolean {
  if (!Number.isInteger(numero) || !Number.isInteger(total)) return false;
  const n = numero as number;
  const t = total as number;
  return t >= 2 && t <= MAX_PARCELAS && n >= 1 && n <= t;
}

/**
 * Lê "3/10" no fim da descrição.
 *
 * Só é usada quando o modelo não devolve os campos estruturados. O marcador
 * precisa estar no FIM porque "UBER 03/10" no meio de uma frase tem chance
 * real de ser data — e uma data lida como parcela vira dívida inventada.
 */
const MARCADOR = /\s*[(\[]?\s*(?:parc(?:ela)?\.?\s*)?(\d{1,2})\s*(?:\/|\s+de\s+)\s*(\d{1,2})\s*[)\]]?\s*$/i;

export function detectarParcela(descricao: string | null | undefined): Parcela | null {
  if (!descricao) return null;

  const achado = MARCADOR.exec(descricao);
  if (!achado) return null;

  const numero = Number(achado[1]);
  const total = Number(achado[2]);
  if (!parcelaValida(numero, total)) return null;

  return { numero, total };
}

/** A descrição sem o "3/10" do fim, para montar títulos e a chave de duplicata. */
export function tituloBase(descricao: string | null | undefined): string {
  if (!descricao) return '';
  return descricao.replace(MARCADOR, '').trim();
}

/** Título como o app escreve parcela em todo lugar: "AMERICANAS (4/10)". */
export function tituloDaParcela(base: string, numero: number, total: number): string {
  return `${base} (${numero}/${total})`;
}

/**
 * Chave de uma cobrança parcelada: mesma compra, mesma parcela, mesmo mês.
 *
 * Deliberadamente sem o valor. A fatura às vezes arredonda a última parcela em
 * um centavo, e isso não faz dela uma cobrança diferente.
 */
export function chaveParcela(
  base: string | null | undefined,
  info: string | null | undefined,
  data: string | null | undefined,
): string {
  const titulo = (base ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  return `${titulo}|${(info ?? '').trim()}|${(data ?? '').slice(0, 7)}`;
}

export interface LinhaParcela {
  titulo: string;
  data: string;
  installment_info: string;
  futura: boolean;
}

/**
 * A linha da fatura mais as parcelas que ainda vão vir.
 *
 * A primeira devolvida é a própria cobrança deste mês — ela também precisa
 * passar pela conferência de duplicata, porque pode ter sido criada pela
 * projeção da fatura anterior.
 *
 * Sem parcelamento devolve lista vazia: a compra é avulsa e segue o caminho
 * normal da importação.
 */
export function expandirParcelamento(
  descricao: string | null | undefined,
  dataBase: string,
  parcela: Parcela | null,
): LinhaParcela[] {
  if (!parcela || !parcelaValida(parcela.numero, parcela.total)) return [];

  const base = tituloBase(descricao) || 'Compra parcelada';
  const linhas: LinhaParcela[] = [];

  for (let n = parcela.numero; n <= parcela.total; n++) {
    linhas.push({
      titulo: tituloDaParcela(base, n, parcela.total),
      data: somarMeses(dataBase, n - parcela.numero),
      installment_info: `${n}/${parcela.total}`,
      futura: n > parcela.numero,
    });
  }

  return linhas;
}
