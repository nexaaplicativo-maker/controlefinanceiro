"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

/**
 * Convite para instalar o PWA.
 *
 * Antes isto reaparecia em toda visita: no iOS um setTimeout mostrava o aviso
 * 3 segundos depois de cada carregamento, e fechar no X só mexia em estado de
 * memória, perdido no reload. Quem já tinha instalado e abria pelo navegador
 * continuava sendo cobrado para sempre.
 *
 * Agora há memória em três níveis:
 *   1. display-mode standalone  -> está rodando instalado, nunca mostra
 *   2. flag de instalado        -> o evento appinstalled já disparou alguma vez
 *   3. dispensa temporária      -> fechou no X, não incomoda por 30 dias
 *
 * localStorage pode lançar em navegação privada ou com dados bloqueados, então
 * toda leitura e escrita está protegida: na dúvida o app segue funcionando.
 */

const INSTALLED_KEY = 'nexa_pwa_installed';
const DISMISSED_KEY = 'nexa_install_dismissed_at';
const DISMISS_DAYS = 30;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* sem storage, segue o jogo */ }
}

/** Já roda como app instalado? Cobre Android, desktop e o caso do iOS. */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const modes = ['standalone', 'minimal-ui', 'fullscreen'];
  const byDisplayMode = modes.some(m => window.matchMedia(`(display-mode: ${m})`).matches);
  const iosStandalone = (window.navigator as any).standalone === true;
  return byDisplayMode || iosStandalone;
}

/** Fechou o convite há menos de 30 dias? */
function recentlyDismissed(): boolean {
  const raw = safeGet(DISMISSED_KEY);
  if (!raw) return false;
  const when = Number(raw);
  if (!Number.isFinite(when)) return false;
  const days = (Date.now() - when) / (1000 * 60 * 60 * 24);
  return days < DISMISS_DAYS;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  useEffect(() => {
    // Registra o service worker aqui, e não no dashboard: este componente vive
    // no layout e roda em toda página. O Chrome só oferece instalação se houver
    // SW + manifest, então registrar só em "/" deixava /login sem a opção.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW fail:', err));
    }

    // Se o navegador avisar que instalou, lembra para sempre. Esse evento é o
    // único sinal confiável de "já instalou" quando o app é aberto pela aba.
    const handleInstalled = () => {
      safeSet(INSTALLED_KEY, '1');
      setShowAndroidPrompt(false);
      setShowIosPrompt(false);
    };
    window.addEventListener('appinstalled', handleInstalled);

    const alreadyInstalled = detectStandalone() || safeGet(INSTALLED_KEY) === '1';

    // Rodando instalado agora também vale como prova de instalação.
    if (detectStandalone()) safeSet(INSTALLED_KEY, '1');

    if (alreadyInstalled || recentlyDismissed()) {
      return () => window.removeEventListener('appinstalled', handleInstalled);
    }

    const isIos = /ipad|iphone|ipod/.test(navigator.userAgent.toLowerCase()) && !(window as any).MSStream;

    if (isIos) {
      // No iOS não existe beforeinstallprompt: só dá para ensinar o caminho.
      const timer = setTimeout(() => setShowIosPrompt(true), 4000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('appinstalled', handleInstalled);
      };
    }

    // Android/Chrome: o evento só dispara se realmente der para instalar —
    // ou seja, ele próprio já filtra quem tem o app instalado.
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroidPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismiss = () => {
    safeSet(DISMISSED_KEY, String(Date.now()));
    setShowAndroidPrompt(false);
    setShowIosPrompt(false);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      safeSet(INSTALLED_KEY, '1');
    } else {
      // Recusou: trata como dispensa, para não perguntar de novo amanhã.
      safeSet(DISMISSED_KEY, String(Date.now()));
    }
    setShowAndroidPrompt(false);
    setDeferredPrompt(null);
  };

  return (
    <AnimatePresence>
      {/* Aviso Android */}
      {showAndroidPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 md:left-auto md:right-8 md:w-96 bg-surface border border-brand/30 shadow-[0_24px_60px_rgba(0,0,0,0.65)] shadow-brand/20 rounded-inner p-5 z-50 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand/20 rounded-field flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h3 className="font-bold text-ink text-sm">Instalar Aplicativo</h3>
              <p className="text-xs text-ink-2">Tenha o Nexa na sua tela inicial</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="bg-brand hover:bg-brand-strong text-canvas text-xs font-bold py-2 px-4 rounded-field transition-colors cursor-pointer"
            >
              Instalar
            </button>
            <button
              onClick={dismiss}
              className="text-ink-3 hover:text-ink p-2 cursor-pointer"
              title="Não mostrar por 30 dias"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Aviso iOS */}
      {showIosPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-white/10 p-6 z-[100] pb-10"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-ink text-lg">Instalar no iPhone</h3>
              <p className="text-sm text-ink-2 mt-1">Instale o Nexa para ter a experiência completa de aplicativo.</p>
            </div>
            <button
              onClick={dismiss}
              className="bg-white/5 p-2 rounded-full text-ink-2 hover:text-ink cursor-pointer shrink-0"
              title="Não mostrar por 30 dias"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 mt-6">
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-field">
              <div className="bg-brand/20 p-2 rounded-lg">
                <Share className="w-5 h-5 text-brand" />
              </div>
              <p className="text-sm text-ink">1. Toque no botão de <strong>Compartilhar</strong> na barra inferior do Safari.</p>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-field">
              <div className="bg-pos/20 p-2 rounded-lg">
                <PlusSquare className="w-5 h-5 text-pos" />
              </div>
              <p className="text-sm text-ink">2. Role para baixo e escolha <strong>Adicionar à Tela de Início</strong>.</p>
            </div>
          </div>

          <button
            onClick={dismiss}
            className="w-full mt-5 text-xs text-ink-3 hover:text-ink-2 transition-colors cursor-pointer py-2"
          >
            Já instalei, não mostrar novamente
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
