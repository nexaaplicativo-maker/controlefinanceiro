"use client";

import { useEffect } from "react";

/**
 * Registra o service worker, em toda rota.
 *
 * POR QUE SAIU DO InstallPrompt
 * O registro morava lá, com um comentário explicando que ficava no layout
 * justamente para rodar em toda página — "registrar só em / deixava /login
 * sem a opção". Depois disso o `ChromeDoApp` passou a esconder o
 * InstallPrompt nas rotas públicas, e o registro foi junto: /login,
 * /recuperar-senha, /termos e /privacidade voltaram a ficar sem service
 * worker, exatamente o que aquele comentário queria evitar.
 *
 * Isso importa por dois motivos. O Chrome só oferece instalar o app se
 * houver service worker e manifest na página aberta — e /login é a primeira
 * página de todo mundo. E sem registro não há cache nem tela de offline.
 *
 * Fica num componente próprio, montado no layout raiz, para não voltar a
 * depender de uma decisão de layout que não tem nada a ver com isto.
 */
export function RegistraServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    /* EM DESENVOLVIMENTO NÃO SE REGISTRA — e desfaz-se o que já existir.
     *
     * `sw.js` trata `/_next/static/` como imutável e responde cache-first
     * (ver `ehEstaticoImutavel`). Em produção está certo: o Next põe hash no
     * nome de cada arquivo, então build novo = URL nova. Em `next dev` os
     * chunks têm caminho FIXO (`/_next/static/chunks/app/page.js` é sempre o
     * mesmo), então o service worker passa a servir eternamente o JS da
     * primeira visita e ignora o que o dev server recompila.
     *
     * O sintoma não é obviamente de cache: o HTML vem novo do servidor e o JS
     * vem velho do cache, o React acusa erro de hidratação apontando classes
     * que já não existem no código, e qualquer mudança parece "não ter
     * surtido efeito". Foi o que aconteceu em 20/11/2026, com duas horas de
     * investigação.
     *
     * Por isso aqui não basta não registrar: é preciso remover o registro já
     * instalado e apagar os caches, senão a máquina de quem já abriu o app
     * em dev continua presa ao JS antigo. Custo: não se testa offline nem o
     * banner de instalação em dev — para isso, use um build de produção.
     */
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((registros) => registros.forEach((r) => r.unregister()))
        .catch(() => { /* sem registro para remover: nada a fazer */ });

      if ('caches' in window) {
        caches.keys()
          .then((nomes) => Promise.all(nomes.map((n) => caches.delete(n))))
          .catch(() => { /* cache indisponível (janela privada): nada a fazer */ });
      }
      return;
    }

    // Depois do `load`: registrar durante a carga inicial faz o navegador
    // disputar banda com os próprios arquivos da página.
    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Falha ao registrar o service worker:', err);
      });
    };

    if (document.readyState === 'complete') registrar();
    else {
      window.addEventListener('load', registrar);
      return () => window.removeEventListener('load', registrar);
    }
  }, []);

  return null;
}
