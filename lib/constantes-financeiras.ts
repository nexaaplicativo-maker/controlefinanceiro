/**
 * Limites, multiplicadores e taxas — um lugar só.
 *
 * Antes estavam espalhados como números crus dentro das funções: 92 em
 * profile.ts, 0.7 em outro ponto do mesmo arquivo, 0.03 em debt.ts, 30 e 50
 * em insights-gastos.ts. Mudar um critério exigia caçar o número, e não havia
 * onde registrar de onde ele saiu.
 *
 * REGRA DESTE ARQUIVO
 * Todo valor traz a origem. Quando não houver fonte — e em finanças pessoais
 * boa parte não tem — o comentário diz HEURÍSTICA, explicitamente. É a
 * diferença entre um critério defensável e um número que alguém chutou e
 * ninguém mais ousou mexer.
 */

// ---------------------------------------------------------------------------
// Independência financeira
// ---------------------------------------------------------------------------

/**
 * Taxa de retirada segura (SWR) ao ano.
 *
 * FONTE: estudo Trinity (Cooley, Hubbard & Walz, 1998) e a "regra dos 4%" de
 * William Bengen (1994). Mercado americano, horizonte de ~30 anos, carteira
 * mista de ações e títulos.
 *
 * RESSALVA: é referência estrangeira. Rendimento real e tributação no Brasil
 * são outros, e por isso o valor é parâmetro, não constante de física. O app
 * trata o resultado como ESTIMATIVA de planejamento, nunca como promessa.
 */
export const TAXA_RETIRADA_SEGURA = 0.04;

/**
 * Quantos meses de custo de vida o patrimônio precisa cobrir.
 *
 *   12 / 0.04 = 300 meses = 25 anos de despesa.
 *
 * O código usava 92, com o comentário dizendo "regra dos 4%". 92 meses
 * equivalem a sacar 12/92 = 13% ao ano — mais do que o triplo do sustentável.
 * Era uma pessoa sendo declarada independente com cerca de um terço do que
 * precisa.
 */
export const MESES_PARA_INDEPENDENCIA = Math.round(12 / TAXA_RETIRADA_SEGURA);

/**
 * Cenário conservador, só para exibir ao lado. 12 / 0.035 = 343 meses.
 * NUNCA é o gatilho do estágio — serve para mostrar o custo de errar para
 * menos na premissa.
 */
export const TAXA_RETIRADA_CONSERVADORA = 0.035;
export const MESES_INDEPENDENCIA_CONSERVADOR = Math.round(12 / TAXA_RETIRADA_CONSERVADORA);

// ---------------------------------------------------------------------------
// Dívida
// ---------------------------------------------------------------------------

/**
 * Corte de "dívida cara": 3% ao mês = 42,58% ao ano ((1,03^12) − 1).
 *
 * HEURÍSTICA, calibrada contra o rendimento conservador acessível no Brasil
 * (CDI). Acima disso, quitar rende mais do que aplicar, com certeza e sem
 * risco — por isso a dívida cara bloqueia a sugestão de aporte.
 *
 * O valor canônico vive em lib/debt.ts como EXPENSIVE_DEBT_RATE; reexportado
 * aqui para ficar junto dos outros limites.
 */
export { EXPENSIVE_DEBT_RATE as TAXA_DIVIDA_CARA } from './debt';

// ---------------------------------------------------------------------------
// Reserva de emergência
// ---------------------------------------------------------------------------

/**
 * Título que o botão "Poupar" grava na transação do aporte à reserva.
 *
 * É um MARCADOR, não um rótulo: quem grava e quem lê precisam concordar, ou
 * o mesmo dinheiro volta a ser contado duas vezes (uma na reserva, outra no
 * investido). Por isso mora aqui, e não solto dentro do componente.
 *
 * LIMITAÇÃO CONHECIDA: casar por título é frágil. O certo seria uma coluna
 * `goal_id` em `transactions`, ligando a transação à meta que ela alimenta.
 * Isso exige migração de schema e está proposto à parte — enquanto não
 * existir, este marcador é o que o app já escreve e o que dá para ler.
 */
export const TITULO_APORTE_RESERVA = 'Aporte - Reserva de Emergência';

/** Compara títulos ignorando acento, caixa e espaço repetido. */
export function ehAporteDeReserva(titulo: string | null | undefined): boolean {
  if (!titulo) return false;
  const achatar = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return achatar(titulo) === achatar(TITULO_APORTE_RESERVA);
}

/**
 * Meses de CUSTO DE VIDA (não de renda) na reserva.
 *
 * FONTE: recomendação corrente de planejamento financeiro, 3 a 6 meses para
 * renda estável. O dobro para renda variável porque a queda de faturamento e
 * a emergência costumam chegar juntas — aí a reserva cobre duas coisas ao
 * mesmo tempo.
 */
export const RESERVA_MESES = {
  fixa: { minimo: 3, ideal: 6 },
  variavel: { minimo: 6, ideal: 12 },
} as const;
