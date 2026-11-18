/**
 * As travas do servidor.
 *
 * Este arquivo existe porque a promessa "somente leitura, só agregado" não
 * pode depender de alguém lembrar dela ao escrever a próxima tool. Aqui ela
 * vira código que roda em toda resposta, antes de qualquer coisa sair daqui.
 *
 * São três travas independentes, e nenhuma substitui a outra:
 *
 *   1. O banco. O usuário `mcp_readonly` só enxerga o schema `mcp`, e nem
 *      sequer tem permissão de leitura no `public`. É a trava que vale.
 *   2. As consultas. São strings fixas no código, parametrizadas. Não existe
 *      tool de SQL livre, então não há como pedir outra coisa.
 *   3. Esta aqui. Se uma view for alterada no painel e passar a devolver uma
 *      coluna de dado pessoal, a resposta falha em vez de vazar.
 *
 * A terceira é a que protege contra o erro mais provável: ninguém vai trocar
 * a senha do banco por engano, mas é perfeitamente plausível alguém adicionar
 * `user_id` numa view para depurar e esquecer de tirar.
 */

/**
 * Colunas que nunca podem sair daqui.
 *
 * Duas famílias. A primeira identifica uma PESSOA (`user_id`, `email`): com
 * ela, uma métrica agregada deixa de ser agregada. A segunda é DINHEIRO de
 * alguém (`amount`, `balance`, `current_balance`): é o dado mais sensível do
 * app, e nenhuma pergunta que este servidor existe para responder — quantos
 * cadastros, quais erros — precisa dele.
 *
 * A comparação é por nome exato, em minúsculas. Nomes derivados passam de
 * propósito: `total_amount` é uma soma de toda a base, não o gasto de
 * ninguém, e é exatamente o tipo de número que o dono precisa ver.
 */
export const COLUNAS_PROIBIDAS: readonly string[] = [
  // Quem é a pessoa
  'user_id',
  'owner_id',
  'invited_by',
  'used_by',
  'email',
  'e_mail',
  'auth_email',
  // Quanto a pessoa tem ou deve
  'amount',
  'balance',
  'current_balance',
  'monthly_income',
  'target_amount',
  'invested_amount',
  'current_value',
  'joint_wealth',
  'emergency_fund',
  // Texto livre que a pessoa escreveu
  'title',
  'advice',
  'snapshot',
  'receipt_url',
];

/** Teto de linhas por resposta. Vale no SQL e de novo aqui. */
export const MAX_LINHAS = 100;

/** Teto de tempo por consulta, em milissegundos. */
export const TIMEOUT_MS = 5_000;

export class ViolacaoDeSeguranca extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ViolacaoDeSeguranca';
  }
}

/**
 * Recusa a resposta inteira se qualquer linha trouxer coluna proibida.
 *
 * Falha fechado, e falha na RESPOSTA inteira, não na coluna: remover a
 * coluna e devolver o resto esconderia o problema justamente de quem
 * precisa corrigi-lo. O erro nomeia a view e a coluna para o conserto ser
 * óbvio.
 */
export function conferirColunas(view: string, linhas: ReadonlyArray<Record<string, unknown>>): void {
  const primeira = linhas[0];
  if (!primeira) return;

  const proibidas = Object.keys(primeira)
    .filter(coluna => COLUNAS_PROIBIDAS.includes(coluna.toLowerCase()));

  if (proibidas.length > 0) {
    throw new ViolacaoDeSeguranca(
      `A view ${view} devolveu coluna(s) de dado pessoal: ${proibidas.join(', ')}. ` +
      'A resposta foi descartada inteira. Corrija a view no Supabase — este servidor ' +
      'só entrega métricas agregadas.',
    );
  }
}

/**
 * Corta no teto, por garantia.
 *
 * O `LIMIT` já está no SQL. Isto é a segunda linha: uma view que mude de
 * forma, ou uma consulta futura escrita sem `LIMIT`, não transforma uma
 * resposta do MCP num despejo de tabela.
 */
export function limitarLinhas<T>(linhas: readonly T[]): T[] {
  return linhas.slice(0, MAX_LINHAS);
}

/**
 * Confere que a string de conexão é a do usuário somente leitura.
 *
 * O jeito mais fácil de furar todo o desenho deste servidor é colar a URL de
 * conexão do dono do banco no `.env` porque "era a que estava à mão". Aí o
 * schema `public` volta a ficar visível e as travas 1 e 2 caem juntas.
 *
 * A verificação é pelo nome do usuário na própria string. Não prova que o
 * papel tem só SELECT — isso quem garante é o GRANT no banco — mas pega o
 * erro de copiar e colar, que é o caso real.
 */
export function conferirUsuarioDoBanco(url: string): void {
  let usuario: string;
  try {
    usuario = decodeURIComponent(new URL(url).username);
  } catch {
    throw new ViolacaoDeSeguranca(
      'NEXA_MCP_DATABASE_URL não é uma URL válida. Formato esperado: ' +
      'postgresql://mcp_readonly:SENHA@host:5432/postgres',
    );
  }

  if (usuario !== USUARIO_ESPERADO) {
    throw new ViolacaoDeSeguranca(
      `NEXA_MCP_DATABASE_URL conecta como "${usuario || '(sem usuário)'}", e este servidor ` +
      `só roda como "${USUARIO_ESPERADO}". Use a string do papel somente leitura — ` +
      'nunca a do dono do banco, nunca a chave de serviço do Supabase.',
    );
  }
}

/** O único usuário de banco que este servidor aceita. */
export const USUARIO_ESPERADO = 'mcp_readonly';
