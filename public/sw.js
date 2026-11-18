/**
 * Service worker do Nexa.
 *
 * O QUE ELE FAZ — E O QUE DELIBERADAMENTE NÃO FAZ
 *
 * Faz duas coisas: guarda os arquivos estáticos do app (JavaScript, CSS,
 * ícones) e mostra uma tela própria quando a navegação falha por falta de
 * rede, no lugar do erro do navegador.
 *
 * NÃO guarda dado financeiro. Nenhuma resposta do Supabase, nenhuma rota
 * `/api`, nada com valor em reais dentro. Isso não é limitação de esforço, é
 * a decisão central deste arquivo: saldo velho servido do cache é pior que
 * tela de erro. Alguém olha "R$ 1.200 disponível", decide um gasto, e o
 * número era de três dias atrás. Uma tela dizendo "sem conexão" é honesta;
 * um número desatualizado sem aviso, não.
 *
 * Então o app continua SEM funcionar offline, e a tela de fallback diz isso
 * com todas as letras. O ganho real aqui é outro: em conexão ruim o app
 * abre na hora, porque o shell vem do disco em vez da rede.
 *
 * POR QUE ESCRITO À MÃO, SEM WORKBOX
 * São três estratégias e noventa linhas. Uma dependência de build para isso
 * custaria mais em configuração e tamanho do que resolve.
 *
 * COMO ATUALIZAR
 * Suba o VERSAO abaixo. O `activate` apaga todo cache com nome diferente, e
 * `skipWaiting` + `clients.claim` fazem a versão nova assumir sem esperar
 * todas as abas fecharem.
 */

const VERSAO = 'nexa-v2';
const CACHE_ESTATICO = `${VERSAO}-estatico`;

/** A tela mostrada quando a navegação falha. */
const PAGINA_OFFLINE = '/offline.html';

/**
 * O mínimo que precisa estar no disco antes do primeiro corte de rede.
 *
 * Os pacotes do Next não entram aqui: os nomes têm hash e mudam a cada
 * build, então listá-los quebraria a instalação no deploy seguinte. Eles são
 * guardados conforme o app os pede, no `fetch` lá embaixo.
 */
const ESSENCIAIS = [
  PAGINA_OFFLINE,
  '/manifest.json',
  '/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_ESTATICO)
      // `addAll` falha inteiro se um arquivo faltar, e uma instalação que
      // falha deixa o app sem service worker nenhum. Um a um, um ícone
      // ausente não derruba o resto.
      .then((cache) => Promise.all(
        ESSENCIAIS.map((url) => cache.add(url).catch(() => undefined)),
      ))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((n) => !n.startsWith(VERSAO)).map((n) => caches.delete(n)),
      ))
      .then(() => self.clients.claim()),
  );
});

/** Endereços que NUNCA podem ser guardados nem servidos do cache. */
function ehDadoVivo(url) {
  return (
    url.hostname.endsWith('.supabase.co') ||
    url.pathname.startsWith('/api/')
  );
}

/** Arquivos de build com hash no nome: imutáveis, seguros no cache. */
function ehEstaticoImutavel(url) {
  return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
}

/** Ícones e manifest servidos de `public/`. */
function ehRecursoProprio(url) {
  return url.origin === self.location.origin && /\.(png|svg|ico|webmanifest|json)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Só GET. Um POST guardado ou repetido do cache lançaria a mesma despesa
  // duas vezes.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Dado financeiro e autenticação passam direto para a rede, sempre.
  if (ehDadoVivo(url)) return;

  // Navegação: tenta a rede e, se não houver, mostra a tela de offline.
  // Nunca serve HTML do cache — a página do painel vem com o estado da
  // sessão embutido, e uma versão guardada poderia aparecer para outra
  // pessoa no mesmo aparelho.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(PAGINA_OFFLINE).then(
        (r) => r ?? new Response('Sem conexão.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        }),
      )),
    );
    return;
  }

  // Estático com hash: do cache primeiro. O nome muda a cada build, então
  // nunca serve versão velha de código novo.
  if (ehEstaticoImutavel(url)) {
    event.respondWith(
      caches.match(req).then((guardado) => guardado ?? fetch(req).then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE_ESTATICO).then((c) => c.put(req, copia));
        }
        return resp;
      })),
    );
    return;
  }

  // Ícones e manifest: rede primeiro, cache como rede de segurança. São
  // poucos e mudam raramente; buscar antes evita ícone antigo preso.
  if (ehRecursoProprio(url)) {
    event.respondWith(
      fetch(req).then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE_ESTATICO).then((c) => c.put(req, copia));
        }
        return resp;
      }).catch(() => caches.match(req).then((r) => r ?? Response.error())),
    );
    return;
  }

  // Qualquer outra coisa (fontes do Google, por exemplo) segue o caminho
  // normal do navegador.
});
