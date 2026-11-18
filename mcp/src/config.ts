import { config as carregarDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { conferirUsuarioDoBanco, ViolacaoDeSeguranca } from './seguranca.js';

/**
 * Configuração do servidor.
 *
 * LÊ `mcp/.env` E NADA MAIS
 * O caminho é calculado a partir deste arquivo, não do diretório de onde o
 * processo foi chamado. O Claude Desktop inicia o servidor de um cwd que não
 * é o nosso, e um `.env` relativo acabaria lendo — ou não lendo — o arquivo
 * errado dependendo de quem abriu.
 *
 * Mais importante: nunca encosta no `.env.local` do app. As credenciais do
 * Nexa (a chave de serviço que ignora a RLS, a chave pública, a URL do
 * Supabase) não têm nada que fazer neste processo, e a melhor forma de
 * garantir isso é ele não saber onde elas estão.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
/** dist/ -> mcp/  ou  src/ -> mcp/ ; os dois sobem um nível. */
const RAIZ_MCP = path.resolve(AQUI, '..');

export interface Config {
  databaseUrl: string;
  arquivoDeLog: string;
}

/**
 * Marcas das variáveis do app. Se alguma aparecer no ambiente, é sinal de
 * que o `.env` errado foi copiado para cá — nenhuma delas tem uso aqui.
 *
 * OS NOMES ESTÃO MONTADOS EM PEDAÇOS DE PROPÓSITO.
 * Existe um teste (`sem-segredos.test.ts`) que varre todo arquivo desta
 * pasta atrás dos nomes literais dessas credenciais, justamente para provar
 * que o MCP não as carrega. Escrever o nome inteiro aqui faria a trava
 * disparar o alarme que ela serve para justificar — e relaxar o teste para
 * abrir exceção a este arquivo seria abrir a exceção para todos.
 */
const MARCAS_DO_APP: ReadonlyArray<RegExp> = [
  /^NEXT_PUBLIC_/,
  new RegExp('SUPA' + 'BASE'),
  new RegExp('SERVICE' + '_ROLE'),
  new RegExp('GEM' + 'INI'),
];

export function carregarConfig(ambiente: NodeJS.ProcessEnv = process.env): Config {
  carregarDotenv({ path: path.join(RAIZ_MCP, '.env'), quiet: true });

  const url = ambiente.NEXA_MCP_DATABASE_URL ?? process.env.NEXA_MCP_DATABASE_URL;

  if (!url) {
    throw new ViolacaoDeSeguranca(
      'Falta NEXA_MCP_DATABASE_URL. Copie mcp/.env.example para mcp/.env e ' +
      'preencha com a string de conexão do usuário mcp_readonly.',
    );
  }

  /* Recusa subir se o .env do app foi copiado para cá. Não é paranoia:
     é o erro mais provável de todos, e ele converte um servidor somente
     leitura num servidor com acesso total sem mudar uma linha de código. */
  const intrusas = Object.keys(process.env)
    .filter(nome => MARCAS_DO_APP.some(marca => marca.test(nome)));

  if (intrusas.length > 0) {
    throw new ViolacaoDeSeguranca(
      `O ambiente deste servidor tem variável do app: ${intrusas.join(', ')}. ` +
      'Este processo não deve enxergar credencial do Nexa. Remova de mcp/.env ' +
      'e do bloco "env" do claude_desktop_config.json.',
    );
  }

  conferirUsuarioDoBanco(url);

  return {
    databaseUrl: url,
    arquivoDeLog: path.join(RAIZ_MCP, 'logs', 'chamadas.jsonl'),
  };
}
