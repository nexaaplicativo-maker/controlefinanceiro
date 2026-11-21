/**
 * Como a renda do mês se divide: contas fixas, cartões e variáveis, o que foi
 * guardado e o que sobrou livre.
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

export type IdDoSegmento = 'fixos' | 'gargalo' | 'guardado' | 'livre';

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
  /** Os percentuais foram calculados sobre o total das saídas, não sobre a renda. */
  normalizado: boolean;
}

export interface EntradaDaDivisao {
  rendaLiquida: number;
  custosFixos: number;
  /** Cartões + variáveis. */
  gargalo: number;
  /** Líquido de aportes menos resgates; pode vir negativo. */
  guardado: number;
  /** Saldo do mês; negativo quando se gastou mais do que entrou. */
  livre: number;
}

const ROTULOS: Record<IdDoSegmento, string> = {
  fixos: 'Contas fixas',
  gargalo: 'Cartões e variáveis',
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
  if (renda <= 0) return { segmentos: [], estourou: false, normalizado: false };

  const fixos = naoNegativo(entrada.custosFixos);
  const gargalo = naoNegativo(entrada.gargalo);
  const guardado = naoNegativo(entrada.guardado);
  const saidas = fixos + gargalo + guardado;

  const estourou = saidas > renda || finito(entrada.livre) < 0;

  const itens: Array<[IdDoSegmento, number]> = [['fixos', fixos], ['gargalo', gargalo], ['guardado', guardado]];
  if (!estourou) itens.push(['livre', naoNegativo(entrada.livre)]);

  // Estouro sem nenhuma saída listada (o buraco veio de categoria própria do
  // usuário): não há fatia a mostrar, só o aviso de que gastou mais do que ganhou.
  if (estourou && saidas === 0) return { segmentos: [], estourou: true, normalizado: false };

  const base = estourou ? saidas : renda;
  const percentuais = percentuaisInteiros(itens.map(([, v]) => v), base);

  return {
    segmentos: itens.map(([id, valor], i) => ({ id, rotulo: ROTULOS[id], valor, percentual: percentuais[i] })),
    estourou,
    normalizado: estourou,
  };
}
