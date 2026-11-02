import { supabase } from './supabase';
import { BUCKET, caminhoDoComprovante, ehUrlCompleta } from './receipts-caminho';

/**
 * Comprovantes — acesso por URL assinada.
 *
 * Até aqui o app gravava em `transactions.receipt_url` o retorno de
 * `getPublicUrl()`: um link permanente, sem autenticação, para um documento
 * financeiro. Qualquer pessoa com a URL abria o comprovante de outro usuário,
 * e URLs vazam por histórico de navegador, log de servidor e compartilhamento.
 *
 * Agora o banco guarda apenas o CAMINHO do arquivo, e a URL é assinada no
 * momento de abrir, com validade curta.
 *
 * Registros antigos guardam a URL pública inteira. Em vez de reescrevê-los no
 * banco, o caminho é extraído da própria URL e assinado como qualquer outro
 * (`caminhoDoComprovante`, em receipts-caminho.ts). Assim o bucket pode virar
 * privado sem migração de dados, e sem um instante em que o comprovante antigo
 * fique inacessível.
 */

const EXPIRES_IN_SECONDS = 60 * 5;

export { caminhoDoComprovante } from './receipts-caminho';

/**
 * Resolve o valor de `receipt_url` para um link abrível.
 * Devolve null se o arquivo não existir mais ou o acesso for negado.
 */
export async function getReceiptUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;

  const caminho = caminhoDoComprovante(stored);

  // URL antiga em formato que não reconhecemos: tentar como está é o que o app
  // já fazia, e enquanto o bucket for público continua abrindo.
  if (!caminho) return ehUrlCompleta(stored) ? stored : null;

  const { data, error } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(caminho, EXPIRES_IN_SECONDS);

  if (error || !data?.signedUrl) {
    // Assinar falha se as políticas do Storage ainda não estiverem de pé.
    // Para registro antigo, cair na URL pública mantém o comportamento atual:
    // esta função nunca fica pior do que era. Depois que o bucket virar
    // privado esse link morre, e aí o erro é legítimo.
    return ehUrlCompleta(stored) ? stored : null;
  }

  return data.signedUrl;
}
