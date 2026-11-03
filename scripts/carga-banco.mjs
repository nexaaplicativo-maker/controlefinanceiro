/**
 * Teste de carga do BANCO — 100 pessoas abrindo o painel ao mesmo tempo.
 *
 * ================== LEIA ANTES DE RODAR ==================
 * Este script é para um projeto Supabase DE TESTE, gratuito e separado.
 * NUNCA aponte para o banco de produção: ele cria usuários, insere milhares
 * de linhas e dispara centenas de consultas simultâneas. Rodar contra
 * produção consumiria a cota do plano free e degradaria o app para quem
 * está usando.
 *
 * O script se recusa a rodar se a URL for a mesma do `.env.local`.
 * =========================================================
 *
 * POR QUE ESTE TESTE EXISTE
 * O Nexa é um app de cliente: o navegador fala direto com o Supabase. Medir
 * o servidor Next diz pouco — ele só entrega HTML e JavaScript. O que
 * realmente limita são as 6 consultas que cada abertura de painel dispara.
 *
 * COMO RODAR
 *   1. Crie um projeto Supabase novo (plano free).
 *   2. Rode lá o mesmo schema de `supabase/*.sql`.
 *   3. node scripts/carga-banco.mjs <URL> <ANON_KEY> [pessoas] [meses]
 *
 * O QUE ELE MEDE
 *   - Latência das 6 consultas do painel, por percentil
 *   - Quantas aberturas por segundo o banco sustenta
 *   - Em que ponto começam os erros
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const [URL, CHAVE, pessoasArg, mesesArg] = process.argv.slice(2);
const PESSOAS = Number(pessoasArg || 100);
const MESES = Number(mesesArg || 24);
const POR_MES = 40; // compras de fatura por mês, que é o caso pesado

if (!URL || !CHAVE) {
  console.error('uso: node scripts/carga-banco.mjs <SUPABASE_URL> <ANON_KEY> [pessoas] [meses]');
  process.exit(1);
}

// --- trava de segurança: nunca contra produção ---
try {
  const env = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  const prod = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
  if (prod && URL.replace(/\/+$/, '') === prod.replace(/\/+$/, '')) {
    console.error('RECUSADO: essa é a URL de produção, a mesma do .env.local.');
    console.error('Crie um projeto Supabase separado para este teste.');
    process.exit(2);
  }
} catch {
  // Sem .env.local não há o que comparar; segue.
}

const db = createClient(URL, CHAVE);

const JANELA = (() => {
  const de = new Date(); de.setMonth(de.getMonth() - 18);
  const ate = new Date(); ate.setMonth(ate.getMonth() + 24);
  return { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) };
})();

const COLUNAS = 'id, user_id, title, amount, category, subcategoria, type, date, is_paid, is_split, installment_group, installment_info, import_group, receipt_url, wallet_id';

function percentil(v, p) {
  if (!v.length) return 0;
  const o = [...v].sort((a, b) => a - b);
  return Math.round(o[Math.min(o.length - 1, Math.floor((p / 100) * o.length))]);
}

/** As 6 consultas que uma abertura de painel dispara, em paralelo. */
async function abrirPainel(userId) {
  const t0 = performance.now();
  const r = await Promise.all([
    db.from('profiles').select('*').eq('id', userId).single(),
    db.from('transactions').select(COLUNAS).eq('user_id', userId)
      .gte('date', JANELA.de).lte('date', JANELA.ate).order('date', { ascending: false }),
    db.from('wallets').select('*').eq('user_id', userId),
    db.from('goals').select('*').eq('user_id', userId),
    db.from('investments').select('*').eq('user_id', userId),
    db.from('debts').select('*').eq('user_id', userId),
  ]);
  const erro = r.find(x => x.error)?.error;
  return {
    ms: performance.now() - t0,
    erro: erro?.message,
    linhas: r[1].data?.length ?? 0,
    bytes: JSON.stringify(r[1].data ?? []).length,
  };
}

console.log(`alvo        ${URL}`);
console.log(`cenário     ${PESSOAS} pessoas abrindo o painel ao mesmo tempo`);
console.log(`dados       ${MESES} meses x ${POR_MES} lançamentos = ${MESES * POR_MES} linhas por pessoa\n`);

// Usa os usuários que já existirem no banco de teste; sem eles, não há o que medir.
const { data: perfis, error: erroPerfis } = await db.from('profiles').select('id').limit(PESSOAS);
if (erroPerfis) { console.error('não consegui listar perfis:', erroPerfis.message); process.exit(1); }
if (!perfis?.length) {
  console.error('o banco de teste está vazio. Popule-o antes (veja o cabeçalho deste arquivo).');
  process.exit(1);
}

const ids = Array.from({ length: PESSOAS }, (_, i) => perfis[i % perfis.length].id);

const inicio = performance.now();
const r = await Promise.all(ids.map(abrirPainel));
const duracao = (performance.now() - inicio) / 1000;

const erros = r.filter(x => x.erro);
const ms = r.map(x => x.ms);
const bytes = r.reduce((a, x) => a + x.bytes, 0);

console.log(`tempo total      ${duracao.toFixed(1)}s`);
console.log(`aberturas/s      ${(PESSOAS / duracao).toFixed(1)}`);
console.log(`erros            ${erros.length} de ${PESSOAS}${erros.length ? '  ← ' + [...new Set(erros.map(e => e.erro))].slice(0, 2).join(' | ') : ''}`);
console.log(`linhas (mediana) ${percentil(r.map(x => x.linhas), 50)}`);
console.log(`tráfego          ${(bytes / 1024 / 1024).toFixed(1)} MB  (${(bytes / PESSOAS / 1024).toFixed(0)} KB por pessoa)`);
console.log(`\nlatência de uma abertura completa (6 consultas em paralelo)`);
console.log(`  p50 ${percentil(ms, 50)}ms   p95 ${percentil(ms, 95)}ms   p99 ${percentil(ms, 99)}ms   max ${Math.round(Math.max(...ms))}ms`);

process.exit(erros.length ? 1 : 0);
