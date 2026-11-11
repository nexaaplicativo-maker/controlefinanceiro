import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase do navegador.
 *
 * SEM FALLBACK NO CÓDIGO, DE PROPÓSITO
 * Antes havia a URL e a anon key gravadas como valor padrão. Isso publicava as
 * credenciais no repositório e, pior, fazia o app conectar no projeto errado
 * EM SILÊNCIO quando a variável faltava em produção — o tipo de falha que só
 * aparece depois que os dados já foram para o lugar errado.
 *
 * POR QUE A CRIAÇÃO É PREGUIÇOSA
 * A versão anterior lançava o erro na IMPORTAÇÃO do módulo. Isso derrubava o
 * build inteiro na hora de pré-renderizar `/_not-found` — uma página 404
 * estática, que não fala com o banco. Uma variável faltando virava "build
 * falhou" sem dizer qual, e a mensagem citava as duas.
 *
 * Agora o cliente só é construído no primeiro uso de verdade. Quem não usa
 * banco — a 404, as páginas de termos e privacidade — compila normalmente, e
 * quem usa falha na hora certa, dizendo o nome exato da variável ausente.
 *
 * Isso NÃO afrouxa a verificação: continua impossível rodar o app sem
 * configuração. Só muda ONDE o erro aparece, de "build quebrado sem pista"
 * para "mensagem precisa". E `/api/health` continua reportando o estado da
 * configuração sem precisar conectar.
 */

function faltando(): string[] {
  const ausentes: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) ausentes.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ausentes.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return ausentes;
}

function criar(): SupabaseClient {
  const ausentes = faltando();

  if (ausentes.length > 0) {
    throw new Error(
      `Supabase não configurado. Faltando: ${ausentes.join(' e ')}. ` +
      'Em desenvolvimento, defina no .env.local (veja .env.example). ' +
      'Na Vercel, em Settings → Environment Variables, marcando Production e Preview. ' +
      'Variável com prefixo NEXT_PUBLIC_ é lida durante o BUILD: depois de ' +
      'cadastrar, refaça o deploy SEM cache, senão o pacote antigo é reaproveitado.'
    );
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}

let instancia: SupabaseClient | null = null;

/**
 * Proxy que adia a criação do cliente até o primeiro acesso a qualquer
 * propriedade — `supabase.from(...)`, `supabase.auth`, e assim por diante.
 *
 * Quem importa este módulo sem usar não paga nada e não quebra.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_alvo, propriedade, receptor) {
    instancia ??= criar();
    const valor = Reflect.get(instancia, propriedade, receptor);
    // Métodos precisam continuar ligados à instância real.
    return typeof valor === 'function' ? valor.bind(instancia) : valor;
  },
});

/** Para o /api/health responder sem tentar conectar. */
export function supabaseConfigurado(): boolean {
  return faltando().length === 0;
}
