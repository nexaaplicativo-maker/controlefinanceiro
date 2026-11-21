/**
 * Formatação de dinheiro — fonte única.
 *
 * Antes isto estava reimplementado em 11 arquivos, em duas variantes que
 * davam resultados diferentes para o mesmo valor:
 *
 *   toFixed(2).replace('.', ',')   -> "R$ 1500,50"   (sem separador de milhar)
 *   toLocaleString('pt-BR')        -> "R$ 1.500,50"
 *
 * Ou seja, o mesmo número aparecia de um jeito no dashboard e de outro no
 * planejador. Esta é a implementação correta para pt-BR, e a única.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Máscara usada quando o usuário liga "ocultar valores". */
export const HIDDEN_MONEY = 'R$ •••••';

/**
 * Formata um valor em reais.
 *
 * @param value  Número. `null`, `undefined` e `NaN` viram R$ 0,00 em vez de
 *               "R$ NaN" — um app financeiro nunca deve exibir NaN.
 * @param visible Passe `showValues` aqui para respeitar o modo de ocultar
 *               valores sem repetir o ternário em toda chamada.
 */
export function formatMoney(value: number | null | undefined, visible = true): string {
  if (!visible) return HIDDEN_MONEY;
  const n = Number(value);
  return BRL.format(Number.isFinite(n) ? n : 0);
}

/**
 * Formata com sinal explícito à frente. Útil para variação e rendimento,
 * onde o "+" comunica tanto quanto o número.
 */
export function formatMoneySigned(value: number | null | undefined, visible = true): string {
  if (!visible) return HIDDEN_MONEY;
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe >= 0 ? '+' : ''}${BRL.format(safe)}`;
}

/** Percentual com uma casa, já com o símbolo. */
export function formatPercent(value: number | null | undefined, visible = true, decimals = 0): string {
  if (!visible) return '••%';
  const n = Number(value);
  return `${(Number.isFinite(n) ? n : 0).toFixed(decimals)}%`;
}

/** O valor em reais quebrado em duas partes, para quem desenha os centavos menores. */
export interface PartesDoValor {
  /** "R$ 1.234" — com o símbolo e os separadores de milhar, sem os centavos. */
  reais: string;
  /** ",56" — com a vírgula. Vazio quando `oculto`. */
  centavos: string;
  /** true no modo privado: `reais` carrega a máscara inteira e não há centavos. */
  oculto: boolean;
}

/**
 * Quebra o texto de `formatMoney` em reais e centavos.
 *
 * Parte do que `formatMoney` devolveu, de propósito: o `Money` tinha esta
 * lógica por conta própria, e qualquer tela que quisesse os centavos menores
 * teria de reimplementar a formatação, que é o que este arquivo existe para
 * impedir. Corta na ÚLTIMA vírgula — o separador decimal do pt-BR.
 *
 * No modo privado a máscara é uma coisa só: não há centavos para recuar.
 */
export function partesDoValor(value: number | null | undefined, visible = true): PartesDoValor {
  const texto = formatMoney(value, visible);
  if (!visible) return { reais: texto, centavos: '', oculto: true };

  const corte = texto.lastIndexOf(',');
  return {
    reais: corte === -1 ? texto : texto.slice(0, corte),
    centavos: corte === -1 ? '' : texto.slice(corte),
    oculto: false,
  };
}
