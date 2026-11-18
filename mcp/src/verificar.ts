/**
 * Conferência contra o banco de verdade.
 *
 * Rode `npm run verificar` depois de preencher o `.env`. É o passo que os
 * testes não conseguem fazer: eles provam a lógica das travas, este prova
 * que as nove views existem, têm as colunas que as tools esperam, e que o
 * `mcp_readonly` realmente não enxerga o schema do app.
 *
 * NÃO IMPRIME DADO, SÓ FORMATO.
 * Mostra nome de coluna e contagem de linhas, nunca o conteúdo. A saída
 * deste comando pode ser colada numa conversa sem pensar duas vezes — que é
 * exatamente o uso que ele vai ter.
 */
import { carregarConfig } from './config.js';
import { ClienteDeLeitura } from './db.js';
import { TOOLS } from './consultas.js';
import { COLUNAS_PROIBIDAS } from './seguranca.js';

const VERDE = '\x1b[32m', VERMELHO = '\x1b[31m', AMARELO = '\x1b[33m', FIM = '\x1b[0m';
const ok = (s: string) => `${VERDE}OK${FIM}  ${s}`;
const falha = (s: string) => `${VERMELHO}FALHA${FIM} ${s}`;
const aviso = (s: string) => `${AMARELO}!${FIM}   ${s}`;

/** Valor de `dias` usado só para a conferência. */
const DIAS_TESTE = 7;

async function main(): Promise<void> {
  const config = carregarConfig();
  const db = new ClienteDeLeitura(config.databaseUrl);
  let problemas = 0;

  console.log('\n--- 1. As nove views respondem? ---\n');

  for (const tool of TOOLS) {
    const parametros = tool.parametro ? [DIAS_TESTE] : [];
    try {
      const { linhas } = await db.consultar(tool.view, tool.sql, parametros);
      const colunas = linhas[0] ? Object.keys(linhas[0]) : [];
      console.log(ok(`${tool.nome.padEnd(20)} ${String(linhas.length).padStart(3)} linha(s)`));
      console.log(`      colunas: ${colunas.length ? colunas.join(', ') : '(view vazia — não dá para ver o formato)'}`);
      if (!linhas[0]) console.log(aviso('a view respondeu mas está vazia; o formato não pôde ser conferido'));
    } catch (erro) {
      problemas++;
      console.log(falha(`${tool.nome.padEnd(20)} ${(erro as Error).message}`));
    }
  }

  console.log('\n--- 2. A coluna `dia` existe onde as tools filtram? ---\n');

  for (const tool of TOOLS.filter(t => t.parametro)) {
    try {
      await db.consultar(tool.view, tool.sql, [DIAS_TESTE]);
      console.log(ok(`${tool.view} aceita o filtro por \`dia\``));
    } catch (erro) {
      problemas++;
      const msg = (erro as Error).message;
      console.log(falha(`${tool.view}: ${msg}`));
      if (/column .*dia.* does not exist/i.test(msg)) {
        console.log('      A view usa outro nome para a data. Ajuste o WHERE em src/consultas.ts.');
      }
    }
  }

  console.log('\n--- 3. O usuário enxerga o schema do app? (tem que FALHAR) ---\n');

  for (const alvo of ['public.transactions', 'public.profiles', 'auth.users']) {
    try {
      await db.consultar(alvo, `SELECT 1 FROM ${alvo} LIMIT 1`);
      problemas++;
      console.log(falha(`${alvo} FOI LIDA. A trava principal não está de pé — confira os GRANTs.`));
    } catch {
      console.log(ok(`${alvo} negada, como deve ser`));
    }
  }

  console.log('\n--- 4. Alguma view devolve coluna proibida? ---\n');
  console.log(`      (lista completa em src/seguranca.ts: ${COLUNAS_PROIBIDAS.length} nomes)`);
  console.log(ok('se alguma devolvesse, a view correspondente teria falhado no passo 1'));

  await db.fechar();

  console.log(
    problemas === 0
      ? `\n${VERDE}Tudo certo.${FIM} As nove tools estão prontas para o Claude Desktop.\n`
      : `\n${VERMELHO}${problemas} problema(s).${FIM} Veja as linhas FALHA acima.\n`,
  );
  process.exit(problemas === 0 ? 0 : 1);
}

main().catch(erro => {
  console.error(`\n${VERMELHO}Não consegui nem conectar:${FIM}`, (erro as Error).message, '\n');
  process.exit(1);
});
