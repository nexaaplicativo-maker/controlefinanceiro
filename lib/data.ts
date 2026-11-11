/**
 * Datas — "hoje" e aritmética de calendário, sempre no fuso do usuário.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 * `new Date().toISOString().slice(0, 10)` devolve a data em UTC. Às 21h01 de
 * 31/10 em Brasília, isso grava 2026-11-01: o lançamento nasce no mês
 * seguinte, e o usuário não tem como perceber. Quem lança gasto à noite — ou
 * seja, quase todo mundo — perdia lançamentos para o mês errado a cada virada.
 *
 * O Brasil não tem horário de verão desde 2019, então hoje o deslocamento é
 * fixo em −3. Ainda assim o cálculo usa o fuso IANA, não um número cravado:
 * se a regra voltar, o app acompanha sem ninguém lembrar de mexer aqui.
 *
 * Sem dependência nova: `Intl.DateTimeFormat` com locale 'en-CA' já devolve
 * AAAA-MM-DD, que é exatamente o formato guardado no banco.
 */

export const FUSO_APP = 'America/Sao_Paulo';

/**
 * A data de hoje no fuso do usuário, como 'AAAA-MM-DD'.
 *
 * Recebe o instante por parâmetro para poder ser testada: nenhuma regra deste
 * app deve depender de um relógio escondido dentro dela.
 */
export function hojeEmSaoPaulo(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_APP,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/** O mês de hoje, como 'AAAA-MM'. */
export function mesAtual(agora: Date = new Date()): string {
  return hojeEmSaoPaulo(agora).slice(0, 7);
}

/** O mês de uma data ISO, por fatiamento — nunca por `Date`, que desloca. */
export function mesDe(iso: string | null | undefined): string {
  return (iso ?? '').slice(0, 7);
}

/**
 * Soma dias a uma data de calendário, sem passar por fuso.
 *
 * `Date.UTC` é só aritmética aqui: entra data pura, sai data pura, e o fuso
 * local da máquina não participa em momento nenhum.
 */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return iso;
  const alvo = new Date(Date.UTC(a, m - 1, d + dias));
  return alvo.toISOString().slice(0, 10);
}

/** Dias inteiros entre duas datas de calendário. Negativo se `ate` for antes. */
export function diasEntre(de: string, ate: string): number {
  const ms = (iso: string) => {
    const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((ms(ate) - ms(de)) / 86_400_000);
}

/**
 * O domingo da semana de uma data, como 'AAAA-MM-DD'.
 * `getUTCDay` sobre uma data construída em UTC não sofre deslocamento.
 */
export function domingoDaSemana(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}
