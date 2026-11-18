import { z } from 'zod';

/**
 * O catálogo das tools.
 *
 * NÃO EXISTE TOOL DE SQL LIVRE, E ESTE ARQUIVO É O PORQUÊ.
 * Cada tool é uma entrada fixa aqui, com a consulta escrita por extenso. O
 * nome da view nunca vem de parâmetro, nunca é concatenado com entrada de
 * ninguém: é literal, dentro de uma string literal, neste arquivo. Qualquer
 * valor que o cliente mande entra por `$1`, e só onde a consulta previu.
 *
 * O efeito prático é que a superfície de ataque do servidor é esta lista.
 * Para ele responder outra coisa, alguém precisa editar este arquivo e
 * passar por revisão de código — não basta mandar outra pergunta.
 *
 * CONTRATO COM AS VIEWS
 * As duas consultas com `dias` esperam uma coluna `dia` do tipo date. Se o
 * seu SQL nomeou diferente, ajuste o WHERE aqui. Ver mcp/sql/leitura.sql.
 */

/** Dias aceitos por tool que recebe janela. Fora disso, falha na validação. */
const DIAS_CADASTROS = z
  .number()
  .int('Informe um número inteiro de dias.')
  .min(1, 'O mínimo é 1 dia.')
  .max(90, 'O máximo é 90 dias.')
  .describe('Quantos dias para trás contar, de 1 a 90.');

const DIAS_IA = z
  .number()
  .int('Informe um número inteiro de dias.')
  .min(1, 'O mínimo é 1 dia.')
  .max(60, 'O máximo é 60 dias.')
  .describe('Quantos dias para trás contar, de 1 a 60.');

export interface DefinicaoDeTool {
  /** Nome exposto ao cliente MCP. */
  nome: string;
  /** View consultada. Usado também na mensagem de erro de coluna proibida. */
  view: string;
  /** Texto que o Claude lê para decidir quando chamar. Em português. */
  descricao: string;
  /** SQL fixo. `$1` só aparece onde `parametro` existe. */
  sql: string;
  /** Validação do parâmetro, quando a tool tem um. */
  parametro?: { nome: 'dias'; schema: z.ZodTypeAny };
}

/**
 * `ORDER BY` explícito em tudo que tem ordem natural: sem ele o Postgres
 * devolve na ordem que quiser, e a resposta muda entre duas perguntas iguais.
 */
export const TOOLS: readonly DefinicaoDeTool[] = [
  {
    nome: 'resumo_geral',
    view: 'mcp.resumo_geral',
    descricao:
      'Visão geral do app numa linha: total de contas, quantas estão ativas, ' +
      'quantos lançamentos existem e desde quando. Use para perguntas amplas ' +
      'como "como está o app?" ou "quantos usuários eu tenho?".',
    sql: 'SELECT * FROM mcp.resumo_geral LIMIT 100',
  },
  {
    nome: 'cadastros_por_dia',
    view: 'mcp.cadastros_por_dia',
    descricao:
      'Quantas contas novas por dia, do mais recente para o mais antigo. ' +
      'Use para "quantos cadastros esta semana?", "o crescimento parou?" ou ' +
      'qualquer pergunta sobre entrada de gente ao longo do tempo.',
    sql: 'SELECT * FROM mcp.cadastros_por_dia WHERE dia >= current_date - $1::int ORDER BY dia DESC LIMIT 100',
    parametro: { nome: 'dias', schema: DIAS_CADASTROS },
  },
  {
    nome: 'ativacao_retencao',
    view: 'mcp.ativacao_retencao',
    descricao:
      'Quantos dos cadastrados chegaram a usar o app de verdade e quantos ' +
      'continuaram usando. Use para "a galera que se cadastra usa?", ' +
      '"quantos voltaram?" ou perguntas sobre abandono.',
    sql: 'SELECT * FROM mcp.ativacao_retencao LIMIT 100',
  },
  {
    nome: 'uso_ia',
    view: 'mcp.uso_ia',
    descricao:
      'Uso das rotas de IA (leitura de recibo, conselheiro, orçamento) por ' +
      'dia. Use para "a IA está sendo usada?", "quanto da cota estou ' +
      'gastando?" ou para decidir se vale manter o recurso ligado.',
    sql: 'SELECT * FROM mcp.uso_ia WHERE dia >= current_date - $1::int ORDER BY dia DESC LIMIT 100',
    parametro: { nome: 'dias', schema: DIAS_IA },
  },
  {
    nome: 'feedback_resumo',
    view: 'mcp.feedback_resumo',
    descricao:
      'Contagem de feedbacks por situação (novo, lido, resolvido). Use para ' +
      '"tem feedback esperando resposta?" ou "quantos chegaram?".',
    sql: 'SELECT * FROM mcp.feedback_resumo LIMIT 100',
  },
  {
    nome: 'feedback_recente',
    view: 'mcp.feedback_recente',
    descricao:
      'Os feedbacks mais recentes, sem identificar quem escreveu. Use para ' +
      '"o que estão reclamando?" ou "o que chegou essa semana?". Não devolve ' +
      'e-mail nem id de usuário.',
    sql: 'SELECT * FROM mcp.feedback_recente LIMIT 100',
  },
  {
    nome: 'erros_7d',
    view: 'mcp.erros_7d',
    descricao:
      'Erros registrados nos últimos 7 dias, agrupados por mensagem e do mais ' +
      'frequente para o menos. Use para "quais erros mais aparecem?", "tem ' +
      'algo quebrado?" ou para priorizar conserto.',
    sql: 'SELECT * FROM mcp.erros_7d LIMIT 100',
  },
  {
    nome: 'perfil_agregado',
    view: 'mcp.perfil_agregado',
    descricao:
      'Distribuição dos perfis financeiros: quantas contas em cada estágio, ' +
      'tipo de renda e estratégia. Números agregados, nunca a renda de ' +
      'alguém. Use para "quem é meu usuário?" ou "em que estágio eles estão?".',
    sql: 'SELECT * FROM mcp.perfil_agregado LIMIT 100',
  },
  {
    nome: 'volume_dados',
    view: 'mcp.volume_dados',
    descricao:
      'Quantas linhas cada tabela tem. Use para "o banco está crescendo ' +
      'quanto?", "vou estourar o plano gratuito?" ou para dimensionar custo.',
    sql: 'SELECT * FROM mcp.volume_dados LIMIT 100',
  },
];

/** Busca pelo nome. Devolve undefined para nome desconhecido. */
export function acharTool(nome: string): DefinicaoDeTool | undefined {
  return TOOLS.find(t => t.nome === nome);
}
