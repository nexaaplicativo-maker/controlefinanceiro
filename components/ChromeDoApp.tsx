"use client";

/**
 * O que só faz sentido com alguém logado dentro do app.
 *
 * Barra inferior, caixa de feedback, convite de instalação e expiração por
 * inatividade viviam no layout raiz, ou seja, apareciam também no login, no
 * cadastro, na recuperação de senha e nas páginas de termos e privacidade.
 *
 * Na tela de login isso não era só enfeite: o botão "+" da barra cobria o
 * "Cadastre-se", e os quatro destinos (Início, Cartões, Gráficos, Ajustes)
 * não levavam a lugar nenhum para quem ainda não entrou.
 *
 * O recorte é por rota, não por sessão: estas páginas são públicas por
 * definição, e esperar o Supabase responder só para decidir se desenha uma
 * barra faria a tela piscar.
 */

import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { InstallPrompt } from './InstallPrompt';
import { FeedbackWidget } from './FeedbackWidget';
import { IdleTimeout } from './IdleTimeout';

/** Rotas públicas: ninguém está logado aqui. */
const PUBLICAS = ['/login', '/recuperar-senha', '/termos', '/privacidade'];

export function ChromeDoApp() {
  const rota = usePathname() ?? '';
  if (PUBLICAS.some(p => rota === p || rota.startsWith(p + '/'))) return null;

  return (
    <>
      {/* Reserva a altura da barra fixa. Estava no <body>, ou seja, valia
          tambem para login e termos, que nao tem barra: sobrava uma faixa
          morta no fim dessas telas. Aqui a reserva anda junto com a barra. */}
      <div aria-hidden className="pb-bottom-nav md:hidden" />
      <BottomNav />
      <InstallPrompt />
      <FeedbackWidget />
      <IdleTimeout />
    </>
  );
}
