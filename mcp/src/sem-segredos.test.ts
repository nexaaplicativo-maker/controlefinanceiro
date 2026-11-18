import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

/**
 * Varredura do código-fonte do MCP.
 *
 * O servidor foi desenhado para não conhecer credencial do app. Este teste
 * é o que impede essa promessa de se desfazer na primeira vez que alguém
 * copiar um trecho do Nexa para cá — "é só para testar" é como começa.
 *
 * Olha os ARQUIVOS, não o código em execução: um `process.env.SUPABASE_...`
 * escrito e nunca chamado continua sendo uma porta.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_MCP = path.resolve(AQUI, '..');

/** Pastas que não são nossas ou não vão para o git. */
const IGNORAR = new Set(['node_modules', 'dist', 'logs', '.git']);

function listarArquivos(dir: string): string[] {
  const saida: string[] = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(item.name)) continue;
    const completo = path.join(dir, item.name);
    if (item.isDirectory()) saida.push(...listarArquivos(completo));
    else saida.push(completo);
  }
  return saida;
}

/** Tudo que é nosso e vai para o repositório. */
const ARQUIVOS = listarArquivos(RAIZ_MCP)
  .filter(f => /\.(ts|js|mjs|json|md|sql|example)$/.test(f))
  .filter(f => !f.endsWith('package-lock.json'));

/** Este arquivo cita os termos proibidos para poder testá-los. */
const ESTE_ARQUIVO = fileURLToPath(import.meta.url);
const ALVOS = ARQUIVOS.filter(f => f !== ESTE_ARQUIVO);

describe('o MCP não carrega credencial do app', () => {
  it('encontrou arquivos para varrer', () => {
    expect(ALVOS.length).toBeGreaterThan(5);
  });

  /**
   * A regra vale para TODO arquivo, documentação incluída.
   *
   * Manter a varredura absoluta custou duas reescritas: o `.env.example` e a
   * mensagem de erro de `seguranca.ts` avisavam o dono para não usar "a
   * service_role", e o aviso continua lá dizendo "a chave de serviço do
   * Supabase". Perdeu-se o nome técnico; ganhou-se um teste sem exceção —
   * e exceção em teste de segredo é por onde o próximo segredo entra.
   *
   * É também por isso que `config.ts` monta os nomes das variáveis do app em
   * pedaços: ver o comentário lá.
   */
  it('nenhum arquivo contém "service_role"', () => {
    const culpados = ALVOS.filter(f =>
      fs.readFileSync(f, 'utf8').toLowerCase().includes('service_role'),
    );
    expect(culpados.map(f => path.relative(RAIZ_MCP, f))).toEqual([]);
  });

  it('nenhum arquivo contém "SUPABASE_"', () => {
    const culpados = ALVOS.filter(f => fs.readFileSync(f, 'utf8').includes('SUPABASE_'));
    expect(culpados.map(f => path.relative(RAIZ_MCP, f))).toEqual([]);
  });

  it('nenhum arquivo contém GEMINI_API_KEY', () => {
    const culpados = ALVOS.filter(f => fs.readFileSync(f, 'utf8').includes('GEMINI_API_KEY'));
    expect(culpados.map(f => path.relative(RAIZ_MCP, f))).toEqual([]);
  });

  /**
   * Esta varredura, sim, vale para TODO arquivo — inclusive documentação.
   * Aqui não se procura o nome da credencial e sim o formato do segredo em
   * si, que é o que realmente não pode estar em lugar nenhum.
   */
  it('nenhum arquivo, nem a documentação, contém um segredo de verdade', () => {
    const FORMATOS: Array<[string, RegExp]> = [
      // JWT do Supabase (anon ou service_role): três blocos base64 com ponto.
      ['JWT', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
      /* String de conexão com senha preenchida.
         O que NÃO conta como senha, e por quê:
           `${...}`  interpolação de template, usada nos testes;
           `<...>`   marcador em prosa;
           A_B_C     marcador em CAIXA ALTA com sublinhados (SUA_SENHA,
                     COLE_A_SENHA_AQUI). Senha de verdade escolhida por
                     alguém não tem essa forma, e marcador assim é o jeito
                     normal de documentar o formato sem vazar nada.
         O que sobra é senha literal mesmo. */
      [
        'senha em URL',
        /postgres(?:ql)?:\/\/[^\s:/]+:(?![A-Z_]+@)[^\s@${}<]{8,}@/,
      ],
      // Chave de API do Google.
      ['chave Google', /\bAIza[A-Za-z0-9_-]{30,}/],
    ];

    for (const [rotulo, formato] of FORMATOS) {
      const culpados = ALVOS.filter(f => formato.test(fs.readFileSync(f, 'utf8')));
      expect({ rotulo, culpados: culpados.map(f => path.relative(RAIZ_MCP, f)) })
        .toEqual({ rotulo, culpados: [] });
    }
  });

  it('a única variável de ambiente lida é a do MCP', () => {
    const lidas = new Set<string>();
    for (const f of ALVOS.filter(x => x.endsWith('.ts'))) {
      const texto = fs.readFileSync(f, 'utf8');
      for (const m of texto.matchAll(/process\.env\.([A-Z_0-9]+)/g)) lidas.add(m[1]!);
      for (const m of texto.matchAll(/process\.env\[['"]([A-Z_0-9]+)['"]\]/g)) lidas.add(m[1]!);
    }
    expect([...lidas].sort()).toEqual(['NEXA_MCP_DATABASE_URL']);
  });

  it('o .env.example não tem senha preenchida', () => {
    const exemplo = path.join(RAIZ_MCP, '.env.example');
    expect(fs.existsSync(exemplo)).toBe(true);
    const texto = fs.readFileSync(exemplo, 'utf8');
    // Tem que ensinar o formato sem trazer segredo nenhum.
    expect(texto).toContain('NEXA_MCP_DATABASE_URL');
    expect(texto).toContain('mcp_readonly');
    expect(texto).toMatch(/SENHA|COLE_AQUI|<.*>/);
    expect(texto).not.toMatch(/supabase\.co(?!m)[^\s]*:[^\s@]{12,}@/);
  });

  it('o .gitignore cobre .env e logs/', () => {
    const texto = fs.readFileSync(path.join(RAIZ_MCP, '.gitignore'), 'utf8');
    expect(texto).toMatch(/^\.env$/m);
    expect(texto).toMatch(/^logs\//m);
  });

  /**
   * A versão anterior deste teste exigia que `mcp/.env` NÃO EXISTISSE, o que
   * estava errado: o dono precisa ter um para o servidor rodar. O que não
   * pode é ele chegar ao git.
   *
   * `git check-ignore` responde exatamente isso, e responde sobre o arquivo
   * de verdade — não sobre o que o `.gitignore` parece dizer.
   */
  it('o git ignora o .env, exista ele ou não', () => {
    const resultado = spawnSync('git', ['check-ignore', '.env'], {
      cwd: RAIZ_MCP,
      encoding: 'utf8',
    });

    if (resultado.error) {
      // Sem git disponível, o teste do .gitignore acima já cobriu a intenção.
      return;
    }

    expect(resultado.status, 'git check-ignore devia reconhecer mcp/.env').toBe(0);
  });

  it('o .env nunca foi rastreado pelo git', () => {
    const rastreados = spawnSync('git', ['ls-files', '--', '.env', '.env.local'], {
      cwd: RAIZ_MCP,
      encoding: 'utf8',
    });

    if (rastreados.error) return;
    expect(rastreados.stdout.trim()).toBe('');
  });
});
