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
