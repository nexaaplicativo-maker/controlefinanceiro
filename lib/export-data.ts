import { supabase } from './supabase';
import { hojeEmSaoPaulo } from './data';

/**
 * Exportação de dados — portabilidade da LGPD.
 *
 * A política de privacidade promete que o usuário pode levar os dados embora.
 * Promessa em política que o produto não cumpre é pior que não prometer.
 *
 * Dois formatos, porque servem a propósitos diferentes:
 *   JSON — tudo, inclusive perfil, dívidas e posições. É o que a LGPD pede.
 *   CSV  — só transações, para abrir em planilha. É o que a pessoa realmente
 *          usa quando quer conferir ou migrar.
 */

/** Tabelas exportadas. `profiles` é filtrada por `id`, as demais por `user_id`. */
const TABELAS = [
  'transactions', 'wallets', 'categories', 'goals', 'budgets',
  'debts', 'debt_payments', 'investments',
  'couple_settings', 'couple_goals',
] as const;

export interface ExportResult {
  filename: string;
  content: string;
  mime: string;
}

export async function exportAllDataAsJson(userId: string): Promise<ExportResult> {
  const dump: Record<string, unknown> = {
    exportadoEm: new Date().toISOString(),
    aviso: 'Export de dados pessoais do Nexa. Guarde com cuidado: contém suas informações financeiras.',
  };

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', userId).maybeSingle();
  dump.perfil = profile ?? null;

  for (const tabela of TABELAS) {
    // Uma tabela ausente (ex.: SQL de alguma fase não rodado) não pode
    // derrubar a exportação inteira — a pessoa tem direito ao resto.
    const { data, error } = await supabase.from(tabela).select('*').eq('user_id', userId);
    dump[tabela] = error ? { erro: error.message } : (data ?? []);
  }

  return {
    filename: `nexa-meus-dados-${hojeEmSaoPaulo()}.json`,
    content: JSON.stringify(dump, null, 2),
    mime: 'application/json',
  };
}

export async function exportTransactionsAsCsv(userId: string): Promise<ExportResult> {
  const { data } = await supabase
    .from('transactions')
    .select('date, title, category, type, amount, is_paid, installment_info')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  const cabecalho = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Pago', 'Parcela'];

  const linhas = (data ?? []).map(t => [
    t.date ?? '',
    t.title ?? '',
    t.category ?? '',
    t.type === 'income' ? 'Receita' : 'Despesa',
    // Vírgula decimal: o Excel em pt-BR não entende ponto.
    String(t.amount ?? 0).replace('.', ','),
    t.is_paid === false ? 'Não' : 'Sim',
    t.installment_info ?? '',
  ]);

  const csv = [cabecalho, ...linhas]
    .map(linha => linha.map(escaparCsv).join(';'))
    .join('\r\n');

  return {
    filename: `nexa-lancamentos-${hojeEmSaoPaulo()}.csv`,
    // BOM no início: sem ele o Excel abre acentuação quebrada.
    content: '﻿' + csv,
    mime: 'text/csv;charset=utf-8',
  };
}

/** Campo com ; " ou quebra de linha precisa de aspas, e aspas internas dobram. */
function escaparCsv(valor: string): string {
  const v = String(valor ?? '');
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Dispara o download no navegador. */
export function baixarArquivo({ filename, content, mime }: ExportResult) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libera a memória do blob; sem isto ele fica preso até a aba fechar.
  URL.revokeObjectURL(url);
}
