/**
 * Flags de funcionalidade.
 *
 * AI_ENABLED controla tudo que depende do Google Gemini: leitura de recibo por
 * foto, conselheiro financeiro e orçamento automático.
 *
 * O padrão é DESLIGADO de propósito. Assim o app sobe e funciona sem a
 * GEMINI_API_KEY, e nenhum botão leva o usuário a uma tela que só devolve erro.
 * Para ligar, defina as duas variáveis no ambiente de deploy:
 *
 *   NEXT_PUBLIC_AI_ENABLED=true    (mostra os botões no cliente)
 *   GEMINI_API_KEY=...             (usada só no servidor)
 *
 * São duas porque o cliente não enxerga GEMINI_API_KEY — ela nunca pode ser
 * exposta ao navegador. A flag pública é só o interruptor visual; as rotas
 * validam a chave de verdade por conta própria.
 */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === 'true';

/**
 * Login com Google.
 *
 * Desligado por padrão, pela mesma razão do AI_ENABLED: o provedor precisa
 * estar habilitado no painel do Supabase, e enquanto não estiver, o botão
 * falha em 100% dos cliques. Confirmado medindo `/auth/v1/settings`, que
 * listava apenas `email` entre os provedores ativos.
 *
 * Botão que nunca funciona é pior que botão ausente: a pessoa conclui que o
 * app está quebrado, não que aquele caminho não existe.
 *
 * Para ligar, depois de habilitar o provedor no Supabase:
 *
 *   NEXT_PUBLIC_GOOGLE_LOGIN=true
 */
export const GOOGLE_LOGIN_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === 'true';
