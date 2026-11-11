/**
 * Mover dinheiro para dentro ou para fora de uma meta.
 *
 * O QUE ESTAVA ERRADO
 * Três telas alimentavam uma meta — o botão "Poupar", o "+" do card de
 * Reserva e a tela de Metas — e cada uma fazia uma coisa diferente:
 *
 *   Poupar      -> gravava a despesa E somava na meta
 *   "+" Reserva -> só somava na meta
 *   Metas       -> só somava (ou subtraía) na meta
 *
 * Nos dois últimos o dinheiro subia na meta sem sair da conta: o mesmo real
 * aparecia como saldo disponível E como reserva formada. No primeiro, as duas
 * gravações estavam certas, mas o patrimônio somava os dois termos.
 *
 * A VERDADE QUE O APP PRECISA REPRESENTAR
 * Guardar R$ 500 é UM movimento com dois efeitos: sai da conta, entra na
 * meta. Retirar é o inverso. Esta função monta esse par, e `goal_id` amarra
 * a transação à meta para que o patrimônio nunca conte o mesmo dinheiro duas
 * vezes.
 *
 * Função pura: recebe números e devolve o que gravar. Quem chama faz o I/O.
 */

/** Categoria das transações de meta. Aporte é patrimônio, não consumo. */
const CATEGORIA_META = 'Investimentos';

export interface MovimentoDeMeta {
  /** Linha pronta para `insert` em `transactions`. */
  transacao: {
    user_id: string;
    goal_id: string;
    title: string;
    amount: number;
    type: 'expense' | 'income';
    category: string;
    date: string;
    is_paid: true;
  };
  /** Novo valor de `goals.current_amount`. */
  novoSaldoDaMeta: number;
}

export type ResultadoMovimento =
  | { ok: true; movimento: MovimentoDeMeta }
  | { ok: false; erro: string };

/**
 * Monta o par (transação, novo saldo da meta).
 *
 * `valor` é sempre positivo; a direção vem de `sentido`. É a mesma convenção
 * do resto do banco, onde `amount` nunca é negativo e o sinal mora em `type`.
 */
export function moverNaMeta(params: {
  userId: string;
  goalId: string;
  tituloDaMeta: string;
  valor: number;
  sentido: 'guardar' | 'retirar';
  saldoAtualDaMeta: number;
  /** 'AAAA-MM-DD', já no fuso do usuário. */
  data: string;
}): ResultadoMovimento {
  const { userId, goalId, tituloDaMeta, valor, sentido, saldoAtualDaMeta, data } = params;

  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, erro: 'Informe um valor maior que zero.' };
  }
  if (!userId || !goalId) {
    return { ok: false, erro: 'Meta não identificada.' };
  }

  // Tirar mais do que há na meta deixaria `current_amount` negativo, e a barra
  // de progresso passaria a mostrar um número sem significado.
  if (sentido === 'retirar' && valor > saldoAtualDaMeta) {
    return { ok: false, erro: 'Você não pode retirar mais do que há guardado nesta meta.' };
  }

  const guardando = sentido === 'guardar';

  return {
    ok: true,
    movimento: {
      transacao: {
        user_id: userId,
        goal_id: goalId,
        // O título diz o movimento e a meta, para a linha se explicar sozinha
        // na lista do mês.
        title: `${guardando ? 'Guardado em' : 'Retirado de'}: ${tituloDaMeta}`,
        amount: valor,
        // Guardar é saída da conta; retirar é entrada. O patrimônio não muda
        // em nenhum dos dois — o dinheiro só trocou de lugar.
        type: guardando ? 'expense' : 'income',
        category: CATEGORIA_META,
        date: data,
        // Já aconteceu: não é conta a vencer.
        is_paid: true,
      },
      novoSaldoDaMeta: arredondar(guardando ? saldoAtualDaMeta + valor : saldoAtualDaMeta - valor),
    },
  };
}

/**
 * Esta transação alimenta uma meta?
 *
 * `goal_id` é a resposta confiável. O casamento por título existe só para as
 * linhas gravadas antes da coluna — sem ele, todo aporte antigo voltaria a
 * ser contado duas vezes no patrimônio no dia em que a coluna chegou.
 */
export function ehMovimentoDeMeta(t: {
  goal_id?: string | null;
  title?: string | null;
  category?: string | null;
}): boolean {
  if (t.goal_id) return true;
  if (t.category !== CATEGORIA_META) return false;

  const titulo = achatar(t.title);
  return titulo.startsWith('aporte - reserva')
    || titulo.startsWith('guardado em:')
    || titulo.startsWith('retirado de:');
}

function achatar(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function arredondar(n: number): number {
  return Math.round(n * 100) / 100;
}
