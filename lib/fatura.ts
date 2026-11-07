/**
 * Que linhas pertencem à mesma cobrança de fatura.
 *
 * Uma fatura de cartão é um pagamento só: paga-se o total, não cada compra.
 * Então marcar uma linha como paga deve marcar a fatura inteira — é o mesmo
 * fato sendo registrado uma vez, em vez de trinta e quatro.
 *
 * O RECORTE PRECISA DA DATA, NÃO SÓ DO GRUPO
 * As parcelas futuras projetadas na importação carregam o MESMO
 * `import_group`: nasceram da mesma leitura do PDF. Agrupar só por ele
 * marcaria como paga a parcela 5/10 que vence daqui a meses, e a dívida
 * futura desapareceria das contas a vencer e da previsão de caixa sem
 * nenhum aviso.
 *
 * Toda linha da cobrança deste mês compartilha a data escolhida na
 * importação; as projetadas têm datas à frente. A data é o que separa uma
 * fatura da seguinte.
 *
 * Função pura, sem I/O, para rodar na suíte.
 */

export interface LinhaFatura {
  id: string;
  date?: string | null;
  import_group?: string | null;
}

/**
 * As linhas da mesma cobrança, incluindo a própria.
 *
 * Devolve lista vazia quando não há agrupamento a fazer — lançamento avulso,
 * importação de item único, ou compra anterior à coluna `import_group`. Quem
 * chama trata isso como "mexer só nesta linha".
 */
export function linhasDaMesmaFatura<T extends LinhaFatura>(
  transacoes: readonly T[],
  alvo: T | null | undefined,
): T[] {
  if (!alvo?.import_group || !alvo.date) return [];

  const irmas = transacoes.filter(
    t => t.import_group === alvo.import_group && t.date === alvo.date,
  );

  // Uma linha só não é fatura: é uma compra que por acaso veio de uma leitura.
  return irmas.length > 1 ? irmas : [];
}
