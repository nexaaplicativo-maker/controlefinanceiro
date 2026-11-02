/**
 * Caminho de comprovante — função pura, sem I/O.
 *
 * Vive separada de `receipts.ts` porque aquele módulo importa o cliente do
 * Supabase, que lança no import quando não há env — e a suíte de testes é só
 * de função pura, de propósito (veja vitest.config.ts).
 *
 * O que está em jogo: o bucket `receipts` vai virar privado, e a partir daí
 * todo comprovante precisa de URL assinada. Assinar exige o CAMINHO do
 * arquivo. Registro novo já guarda o caminho; registro antigo guarda a URL
 * pública inteira, e extrair o caminho dela errado é comprovante que não abre.
 */

export const BUCKET = 'receipts';

/** Trecho que separa o host do caminho numa URL pública do Storage. */
const MARCA_PUBLICA = `/object/public/${BUCKET}/`;

/** Registro antigo guardava URL completa; o novo guarda caminho relativo. */
export function ehUrlCompleta(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

/**
 * Devolve o caminho do arquivo dentro do bucket, aceitando os dois formatos
 * que existem no banco:
 *
 *   `<user_id>/<timestamp>.<ext>`                         (registro novo)
 *   `https://<proj>.supabase.co/storage/v1/object/public/receipts/<caminho>`
 *
 * Devolve null quando é uma URL de formato desconhecido — aí não há caminho
 * para assinar, e quem chama decide o que fazer.
 */
export function caminhoDoComprovante(stored: string | null | undefined): string | null {
  if (!stored) return null;

  if (!ehUrlCompleta(stored)) return stored;

  const corte = stored.indexOf(MARCA_PUBLICA);
  if (corte === -1) return null;

  // Query string e fragmento não fazem parte do caminho no Storage.
  const bruto = stored.slice(corte + MARCA_PUBLICA.length).split('?')[0].split('#')[0];
  if (!bruto) return null;

  try {
    return decodeURIComponent(bruto);
  } catch {
    // Percent-encoding inválido: o caminho cru ainda é a melhor aposta.
    return bruto;
  }
}
