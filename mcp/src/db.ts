import pg from 'pg';
import { conferirColunas, limitarLinhas, TIMEOUT_MS } from './seguranca.js';

/**
 * A ponte com o Postgres.
 *
 * TUDO AQUI ASSUME QUE O BANCO É HOSTIL AO SERVIDOR, NÃO O CONTRÁRIO
 * O papel `mcp_readonly` não tem SELECT no schema `public`. Então mesmo que
 * uma consulta errada escape das travas do código, o banco recusa. Este
 * arquivo só garante que o servidor se comporte: não demora demais, não
 * devolve demais, e não devolve o que não devia.
 */

const { Pool } = pg;

export interface ResultadoDaConsulta {
  linhas: Array<Record<string, unknown>>;
}

export class ClienteDeLeitura {
  private readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      /* Uma conexão basta: o servidor atende uma pergunta por vez, vinda de
         um cliente só. Pool maior seria conexão ociosa aberta contra o banco
         de produção sem ninguém usando. */
      max: 1,
      connectionTimeoutMillis: TIMEOUT_MS,
      idle_in_transaction_session_timeout: TIMEOUT_MS,
      /* O Supabase exige TLS. `rejectUnauthorized: false` aceita o
         certificado do pooler, que é assinado por uma CA que o Node não traz
         — é o mesmo que o cliente oficial faz. A conexão continua
         criptografada; o que não é verificada é a cadeia. */
      ssl: { rejectUnauthorized: false },
      /* Teto no próprio Postgres. Vale mesmo se o timeout do lado do Node
         falhar: o servidor cancela a consulta sozinho. */
      statement_timeout: TIMEOUT_MS,
      query_timeout: TIMEOUT_MS,
      application_name: 'nexa-mcp-dono',
    });

    /* Erro em conexão ociosa chega como evento, não como exceção da consulta.
       Sem este ouvinte, o processo inteiro cai. */
    this.pool.on('error', erro => {
      console.error('[nexa-mcp] erro na conexão ociosa:', erro.message);
    });
  }

  /**
   * Roda uma das consultas fixas do catálogo.
   *
   * `view` entra só para a mensagem de erro de coluna proibida — a consulta
   * já vem pronta de `consultas.ts` e nunca é montada aqui.
   */
  async consultar(view: string, sql: string, parametros: unknown[] = []): Promise<ResultadoDaConsulta> {
    const resultado = await this.pool.query(sql, parametros);
    const linhas = resultado.rows as Array<Record<string, unknown>>;

    // Ordem importa: conferir ANTES de cortar. Se a coluna proibida só
    // aparecesse na linha 101, cortar primeiro a esconderia.
    conferirColunas(view, linhas);

    return { linhas: limitarLinhas(linhas) };
  }

  async fechar(): Promise<void> {
    await this.pool.end();
  }
}
