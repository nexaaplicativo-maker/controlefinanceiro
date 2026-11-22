/**
 * Como a renda do mês se divide: contas fixas, cartões e variáveis, outros
 * gastos, o que foi guardado e o que sobrou livre. Com `calcularSobraDoMes`
 * (`lib/sobra-do-mes.ts`) as cinco parcelas fecham a renda inteira.
 *
 * Função pura. Quem chama passa os valores que a tela já calcula; nada aqui
 * conhece transação, mês ou perfil.
 *
 * REGRA CENTRAL: NUNCA DESENHAR SOBRA QUE NÃO EXISTE
 * Num mês em que as saídas passam da renda (cartão acima de 100%, por
 * exemplo), um "livre" calculado como o que resta seria negativo, e uma barra
 * com fatia livre positiva diria o contrário da verdade. Então, no estouro, o
 * segmento "livre" deixa de existir e os demais são normalizados pelo total
 * das SAÍDAS — a barra mostra de onde veio o buraco, não uma renda inexistente.
 */

export type IdDoSegmento = 'fixos' | 'gargalo' | 'outros' | 'guardado' | 'livre';

export interface SegmentoDaRenda {
  id: IdDoSegmento;
  /** Texto do item da legenda e do `aria-label` da barra. */
  rotulo: string;
  /** Valor exato em R$, sem arredondar — é o que bate com os modais. */
  valor: number;
  /** Percentual inteiro da base (renda, ou total das saídas se normalizado). */
  percentual: number;
}

export interface DivisaoDaRenda {
  /** Vazio sem renda, ou quando não há o que desenhar. Sem "livre" no estouro. */
  segmentos: SegmentoDaRenda[];
  /** As saídas passaram da renda: não existe sobra para mostrar. */
  estourou: boolean;
  /** Os percentuais foram calculados sobre outra base que não a renda. */
  normalizado: boolean;
  /** A base de TUDO: percentual em texto e largura da barra (valor ÷ base).
   *  A renda; o total das saídas no estouro; ou a soma das fatias quando ela
   *  passa da renda. 0 quando não há segmentos. */
  base: number;
}

export interface EntradaDaDivisao {
  rendaLiquida: number;
  custosFixos: number;
  /** Cartões + variáveis. */
  gargalo: number;
  /** Saídas fora de Contas Fixas, gargalo e Investimentos. Só vira fatia se > 0. */
  outros: number;
  /** Líquido de aportes menos resgates; pode vir negativo. */
  guardado: number;
  /** Saldo do mês; negativo quando se gastou mais do que entrou. */
  livre: number;
}

/** Rótulo de cada fatia, único para a legenda, o `aria-label` e o modal de destino. */
export const ROTULO_DO_SEGMENTO: Record<IdDoSegmento, string> = {
  fixos: 'Contas fixas',
  gargalo: 'Cartões e variáveis',
  outros: 'Outros gastos',
  guardado: 'Já guardado',
  livre: 'Livre na conta',
};

const finito = (n: number) => (Number.isFinite(n) ? n : 0);
const naoNegativo = (n: number) => Math.max(0, finito(n));

/**
 * Percentuais inteiros cuja soma é o arredondamento da soma real — e portanto
 * nunca passa de 100 quando a base cobre todos os valores. Arredondar cada
 * fatia sozinha dava 101% em casos como três terços.
 */
function percentuaisInteiros(valores: number[], base: number): number[] {
  const brutos = valores.map(v => (v / base) * 100);
  const pisos = brutos.map(Math.floor);
  const alvo = Math.round(brutos.reduce((a, b) => a + b, 0));
  let falta = alvo - pisos.reduce((a, b) => a + b, 0);

  const porResto = brutos
    .map((b, i) => ({ i, resto: b - pisos[i] }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);

  for (const { i } of porResto) {
    if (falta <= 0) break;
    pisos[i] += 1;
    falta -= 1;
  }
  return pisos;
}

export function dividirRenda(entrada: EntradaDaDivisao): DivisaoDaRenda {
  const renda = finito(entrada.rendaLiquida);
  if (renda <= 0) return { segmentos: [], estourou: false, normalizado: false, base: 0 };

  const fixos = naoNegativo(entrada.custosFixos);
  const gargalo = naoNegativo(entrada.gargalo);
  const outros = naoNegativo(entrada.outros);
  // Guardado negativo (resgate maior que o aporte) não é saída: vira fatia
  // zero, e o dinheiro do resgate aparece em `livre`, o que empurra a soma das
  // fatias para cima da renda — o caso de base que cresce, mais abaixo.
  const guardado = naoNegativo(entrada.guardado);
  const saidas = fixos + gargalo + outros + guardado;

  // Em centavos: a renda gasta até o último centavo soma 1e-13 a mais em ponto
  // flutuante, e isso não pode virar "você gastou mais do que ganhou".
  const centavos = (n: number) => Math.round(n * 100);
  const estourou = centavos(saidas) > centavos(renda) || centavos(finito(entrada.livre)) < 0;

  const itens: Array<[IdDoSegmento, number]> = [['fixos', fixos], ['gargalo', gargalo]];
  // Sem gasto fora dos dois grupos a divisão não ganha uma fatia zerada.
  if (outros > 0) itens.push(['outros', outros]);
  itens.push(['guardado', guardado]);
  if (!estourou) itens.push(['livre', naoNegativo(entrada.livre)]);

  // Estouro sem nenhuma saída listada (o buraco veio de categoria própria do
  // usuário): não há fatia a mostrar, só o aviso de que gastou mais do que ganhou.
  if (estourou && saidas === 0) return { segmentos: [], estourou: true, normalizado: false, base: 0 };

  // A soma das fatias pode passar da renda sem estouro: um resgate lançado
  // como receita em Investimentos infla o saldo (`livre`) sem entrar na renda.
  // Nesse caso a base cresce junto, senão o texto diria "250% livre" e a barra
  // — que desenha cada fatia como valor ÷ base — discordaria dele.
  const soma = itens.reduce((acc, [, v]) => acc + v, 0);
  const base = estourou ? saidas : Math.max(renda, soma);
  const percentuais = percentuaisInteiros(itens.map(([, v]) => v), base);

  return {
    segmentos: itens.map(([id, valor], i) => ({ id, rotulo: ROTULO_DO_SEGMENTO[id], valor, percentual: percentuais[i] })),
    estourou,
    normalizado: base !== renda,
    base,
  };
}
