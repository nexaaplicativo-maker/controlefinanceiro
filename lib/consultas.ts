/**
 * Leitura paginada do Supabase.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 * A REST API do Supabase (PostgREST) corta toda resposta em 1.000 linhas por
 * padrão. O corte é SILENCIOSO: vem HTTP 200, vem um array, e nada no
 * retorno diz que faltou coisa.
 *
 * Nenhuma consulta do app pedia `limit` nem paginava. Na prática isso quer
 * dizer que, a partir da milésima transação dentro da janela, o painel passa
 * a somar um pedaço do mês e a exibir um número errado — sem erro, sem
 * aviso, sem jeito de perceber olhando a tela. O mesmo vale para a
 * exportação de dados da LGPD, que entregaria um arquivo incompleto dizendo
 * ser "todos os seus dados".
 *
 * COMO FUNCIONA
 * Pede faixas de 1.000 com `.range()` até vir uma página curta, que é o sinal
 * de que acabou. Há um teto de páginas para uma consulta mal filtrada não
 * virar um laço que baixa o banco inteiro.
 *
 * O TETO AVISA, NÃO MENTE
 * Se o teto for atingido, `truncado` volta `true` e quem chamou decide o que
 * fazer. Para números somados na tela, a resposta certa é dizer que a conta
 * está incompleta — nunca mostrar um total parcial como se fosse o total.
 */

/** Tamanho de página. É o mesmo corte padrão do PostgREST. */
export const PAGINA = 1000;

/**
 * Máximo de páginas por consulta: 20 mil linhas.
 *
 * Dimensionado para a janela do painel (42 meses). Um usuário intenso lança
 * algo como 150 transações por mês, o que dá ~6.300 na janela — três vezes
 * abaixo do teto. Quem passar disso recebe o aviso em vez de um número
 * errado.
 */
export const MAX_PAGINAS = 20;

export interface ResultadoPaginado<T> {
  linhas: T[];
  /** `true` quando o teto de páginas foi atingido e pode haver mais dados. */
  truncado: boolean;
  /** Erro da primeira página que falhou, se houve. */
  erro: { message: string } | null;
}

/** O mínimo que precisamos de uma resposta do supabase-js. */
export interface RespostaFaixa<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Busca todas as linhas de uma consulta, de mil em mil.
 *
 * `pedirFaixa` recebe os índices inicial e final (inclusivos, como o
 * `.range()` do supabase-js) e devolve a resposta daquela faixa. Fica como
 * parâmetro para esta função não depender do cliente do Supabase e poder ser
 * testada sem rede nem banco.
 */
export async function buscarTudo<T>(
  pedirFaixa: (de: number, ate: number) => Promise<RespostaFaixa<T>>,
  opcoes: { pagina?: number; maxPaginas?: number } = {},
): Promise<ResultadoPaginado<T>> {
  const pagina = opcoes.pagina ?? PAGINA;
  const maxPaginas = opcoes.maxPaginas ?? MAX_PAGINAS;

  const linhas: T[] = [];

  for (let i = 0; i < maxPaginas; i++) {
    const de = i * pagina;
    const { data, error } = await pedirFaixa(de, de + pagina - 1);

    // Erro em qualquer página invalida o conjunto: devolver as páginas que
    // deram certo seria entregar um total parcial como se fosse o total —
    // exatamente o que esta função existe para impedir.
    if (error) return { linhas: [], truncado: false, erro: error };

    const recebidas = data ?? [];
    linhas.push(...recebidas);

    // Página curta (ou vazia) significa fim dos dados.
    if (recebidas.length < pagina) return { linhas, truncado: false, erro: null };
  }

  // Saiu pelo teto: há pelo menos mais uma linha que não veio.
  return { linhas, truncado: true, erro: null };
}
