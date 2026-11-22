/**
 * Quanto sobra no mês, e as parcelas que explicam esse número.
 *
 * Função pura sobre totais JÁ SOMADOS: quem chama (a Visão Geral) soma as
 * transações; aqui só mora a aritmética, para que o teste exercite a fórmula
 * REAL e não uma cópia dela.
 *
 * DEFINIÇÃO (decisão do dono, 21/11/2026)
 *
 *   outros = totalExpense − custosFixos − gargalo − aportes
 *   sobra  = rendaLiquida − custosFixos − gargalo − outros
 *
 * O número grande desconta TODA saída — inclusive a que não cai em Contas
 * Fixas nem em cartões e variáveis (categoria criada pelo usuário, "Outros") —
 * MENOS o aporte em Investimentos. Antes ele ignorava esse gasto e mostrava
 * mais dinheiro do que existia, e para quem está endividado o erro cai sempre
 * do lado perigoso.
 *
 * POR QUE O GUARDADO NÃO É DESCONTADO: dinheiro guardado continua sendo do
 * usuário. Descontá-lo faria "sobra" dizer que ele ficou mais pobre ao poupar.
 *
 * A ÁLGEBRA (fechada por teste, e não por coincidência)
 *
 *   balance  = totalIncome − totalExpense            ("Livre na conta")
 *   totalIncome  = rendaLiquida + resgates           (renda exclui Investimentos)
 *   totalExpense = custosFixos + gargalo + aportes + outros
 *   guardado = aportes − resgates
 *
 *   guardado + livre
 *     = (aportes − resgates) + (rendaLiquida + resgates − custosFixos − gargalo − aportes − outros)
 *     = rendaLiquida − custosFixos − gargalo − outros
 *     = sobra
 *
 * e, portanto, custosFixos + gargalo + outros + guardado + livre = rendaLiquida:
 * a divisão da renda explica a renda inteira.
 *
 * CENTAVOS INTEIROS: a conta roda em centavos (inteiros) e só no fim volta a
 * reais. Somar floats deixa resíduos como 399,99999999999994 em `outros`, e um
 * `outros > 0` por resíduo desenharia uma linha "Outros gastos R$ 0,00" num mês
 * que não tem gasto fora dos dois grupos.
 */

export interface TotaisDoMes {
  /** Tudo que entrou, inclusive resgate de investimento. */
  totalIncome: number;
  /** Tudo que saiu, inclusive aporte em investimento. */
  totalExpense: number;
  /** Renda líquida: entradas SEM as de Investimentos. */
  rendaLiquida: number;
  custosFixos: number;
  /** Cartões + variáveis. */
  gargalo: number;
  /** Despesas lançadas em Investimentos. */
  aportes: number;
  /** Receitas lançadas em Investimentos. */
  resgates: number;
}

export interface SobraDoMes {
  rendaLiquida: number;
  custosFixos: number;
  gargalo: number;
  /** Saídas fora de Contas Fixas, gargalo e Investimentos. */
  outros: number;
  /** Aportes menos resgates; negativo quando se resgatou mais do que se aportou. */
  guardado: number;
  /** Saldo do mês: tudo que entrou menos tudo que saiu. Pode ser negativo. */
  livre: number;
  /** O número grande. Vale `guardado + livre`. Pode ser negativo. */
  sobra: number;
}

const paraCentavos = (reais: number) => Math.round((Number.isFinite(reais) ? reais : 0) * 100);
const paraReais = (centavos: number) => centavos / 100;

export function calcularSobraDoMes(totais: TotaisDoMes): SobraDoMes {
  const renda = paraCentavos(totais.rendaLiquida);
  const fixos = paraCentavos(totais.custosFixos);
  const gargalo = paraCentavos(totais.gargalo);
  const aportes = paraCentavos(totais.aportes);
  const resgates = paraCentavos(totais.resgates);

  const outros = paraCentavos(totais.totalExpense) - fixos - gargalo - aportes;
  const livre = paraCentavos(totais.totalIncome) - paraCentavos(totais.totalExpense);

  return {
    rendaLiquida: paraReais(renda),
    custosFixos: paraReais(fixos),
    gargalo: paraReais(gargalo),
    outros: paraReais(outros),
    guardado: paraReais(aportes - resgates),
    livre: paraReais(livre),
    sobra: paraReais(renda - fixos - gargalo - outros),
  };
}
