#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { carregarConfig } from './config.js';
import { ClienteDeLeitura } from './db.js';
import { TOOLS, type DefinicaoDeTool } from './consultas.js';
import { registrarChamada } from './registro.js';
import { MAX_LINHAS } from './seguranca.js';

/**
 * Servidor MCP do dono do Nexa — somente leitura, só métricas agregadas.
 *
 * O dono pergunta em português ("quantos cadastros esta semana?") e o Claude
 * escolhe uma das tools abaixo. Cada tool é uma consulta fixa a uma view do
 * schema `mcp`, rodando como um usuário de banco que não enxerga mais nada.
 *
 * NADA É ESCRITO NO STDOUT ALÉM DO PROTOCOLO
 * O transporte é stdio: stdout é o canal do MCP. Um `console.log` solto aqui
 * insere lixo no meio de um JSON-RPC e derruba a conexão sem mensagem útil.
 * Todo diagnóstico vai para stderr, que o Claude Desktop registra.
 */

const config = carregarConfig();
const db = new ClienteDeLeitura(config.databaseUrl);

const server = new McpServer(
  { name: 'nexa-mcp-dono', version: '1.0.0' },
  {
    instructions:
      'Métricas agregadas do app de finanças Nexa, para o dono do produto. ' +
      'Somente leitura. Nenhuma tool devolve lançamentos, saldos, dívidas, ' +
      'e-mails ou identificadores de usuário — se precisar de algo assim, ' +
      'diga que este servidor não expõe dado individual, de propósito.',
  },
);

/** Resposta de erro no formato que o MCP espera. */
function respostaDeErro(mensagem: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: mensagem }],
  };
}

/** Resposta de sucesso: JSON enxuto, sem indentação, com a contagem junto. */
function respostaComLinhas(tool: DefinicaoDeTool, linhas: Array<Record<string, unknown>>) {
  const corpo = {
    tool: tool.nome,
    linhas: linhas.length,
    /* Avisa quando bateu no teto: sem isto, uma lista cortada em 100 parece
       uma lista completa de 100, e o dono tira conclusão de um número
       truncado. */
    truncado: linhas.length >= MAX_LINHAS,
    dados: linhas,
  };
  return { content: [{ type: 'text' as const, text: JSON.stringify(corpo) }] };
}

for (const tool of TOOLS) {
  const temParametro = tool.parametro !== undefined;

  server.registerTool(
    tool.nome,
    {
      description: tool.descricao,
      /* O schema do zod é a única porta de entrada de valor externo. O que
         não passa aqui nunca chega perto do banco — e o que passa entra como
         parâmetro `$1`, nunca concatenado na consulta. */
      ...(temParametro ? { inputSchema: { dias: tool.parametro!.schema } } : {}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args: Record<string, unknown>) => {
      const parametros = temParametro ? [args.dias] : [];

      try {
        const { linhas } = await db.consultar(tool.view, tool.sql, parametros);

        registrarChamada(config.arquivoDeLog, {
          data: new Date().toISOString(),
          tool: tool.nome,
          parametros: temParametro ? { dias: args.dias } : {},
          linhas: linhas.length,
        });

        return respostaComLinhas(tool, linhas);
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : String(erro);

        registrarChamada(config.arquivoDeLog, {
          data: new Date().toISOString(),
          tool: tool.nome,
          parametros: temParametro ? { dias: args.dias } : {},
          linhas: null,
          erro: mensagem,
        });

        console.error(`[nexa-mcp] ${tool.nome} falhou:`, mensagem);
        return respostaDeErro(`Não consegui consultar ${tool.view}: ${mensagem}`);
      }
    },
  );
}

async function encerrar(): Promise<void> {
  await db.fechar().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void encerrar());
process.on('SIGTERM', () => void encerrar());

await server.connect(new StdioServerTransport());
console.error(`[nexa-mcp] pronto, ${TOOLS.length} tools, somente leitura.`);
