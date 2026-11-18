import fs from 'node:fs';
import path from 'node:path';

/**
 * Registro de chamadas, em JSONL.
 *
 * POR QUE UM ARQUIVO, E POR QUE FORA DO GIT
 * O servidor roda na máquina do dono, iniciado pelo Claude Desktop, sem
 * terminal à vista. Sem registro não há como responder depois "o que esse
 * servidor andou consultando?" — e essa é uma pergunta razoável sobre
 * qualquer coisa que fale com o banco de produção.
 *
 * JSONL porque cada linha é independente: dá para ler com `tail`, com `jq`,
 * ou abrir no meio de uma escrita sem corromper o resto.
 *
 * O arquivo fica em mcp/logs/, que está no .gitignore. Mesmo sem dado
 * pessoal dentro, um histórico de quando o dono olhou cada métrica não tem
 * por que virar commit.
 *
 * POR QUE A FALHA É SILENCIOSA
 * Disco cheio ou pasta sem permissão não podem derrubar a resposta: o
 * registro é para auditoria, não é a função do servidor. Mas o erro vai para
 * stderr — que no stdio do MCP é o canal seguro, porque stdout carrega o
 * protocolo e qualquer byte solto ali quebra a conexão.
 */

export interface LinhaDeRegistro {
  /** ISO 8601 em UTC. */
  data: string;
  tool: string;
  /** Parâmetros já validados. Nunca há dado de usuário aqui — só números. */
  parametros: Record<string, unknown>;
  /** Quantas linhas a resposta devolveu, ou null quando falhou. */
  linhas: number | null;
  /** Preenchido só em falha, com a mensagem — nunca com a string de conexão. */
  erro?: string;
}

export function registrarChamada(arquivo: string, linha: LinhaDeRegistro): void {
  try {
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.appendFileSync(arquivo, JSON.stringify(linha) + '\n', 'utf8');
  } catch (erro) {
    console.error('[nexa-mcp] não consegui gravar o registro:', (erro as Error).message);
  }
}
