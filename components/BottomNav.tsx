"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Home, CreditCard, BarChart3, Settings, Plus, Camera, PenTool } from "lucide-react";
import { AI_ENABLED } from "../lib/features";
import { Sheet } from "./ui/Sheet";

function Ponto({ ativo }: { ativo: boolean }) {
  return (
    <span
      aria-hidden
      className={`mt-0.5 h-1 w-1 rounded-full transition-colors ${ativo ? "bg-brand" : "bg-transparent"}`}
    />
  );
}

export function BottomNav() {
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  /**
   * O "+" só existe na Visão Geral.
   *
   * A barra é montada pelo `ChromeDoApp` em toda rota logada, mas quem escuta
   * o evento `openModal` é só `app/page.tsx`. Em `/casais` e `/admin` o botão
   * desenhava, animava, abria o menu — e nada acontecia ao escolher a opção.
   * Botão que não faz nada é pior que botão ausente.
   */
  const naVisaoGeral = (usePathname() ?? '') === '/';

  const openModal = (name: string) => {
    setActiveTab(name);
    // 'home' não abre modal nenhum — antes o botão Início era decorativo.
    // Agora ele volta ao topo do dashboard, que é o comportamento esperado.
    if (name === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.dispatchEvent(new CustomEvent('openModal', { detail: name }));
  };

  return (
    <>
      {/* O `md:hidden` esconde só a BARRA. A folha do "+" é irmã dela, não
          filha, de propósito: quando a folha ficava dentro do mesmo wrapper,
          abrir no celular em retrato e girar para paisagem (≥768px) a escondia
          com o `use-modal-a11y` ainda montado — `body.overflow` travado, página
          sem rolagem e nada visível para fechar. No iOS não há Esc nem botão
          voltar, então só girando de volta se saía. Como irmã, ela continua
          visível e fechável se a orientação mudar no meio do caminho. */}
      <div className="fixed bottom-0 left-0 w-full z-40 pb-safe px-safe md:hidden">
        <div className="absolute inset-0 bg-canvas/85 backdrop-blur-xl border-t border-line-strong"></div>
        
        <div className="relative px-6 h-20 flex items-center justify-between">
          <div className="flex gap-8">
            <button onClick={() => openModal('home')} className={`flex flex-col items-center gap-0.5 min-w-[56px] py-2 transition-colors cursor-pointer ${activeTab === 'home' ? 'text-brand' : 'text-ink-3 hover:text-brand'}`}>
              <Home className="h-[22px] w-[22px]" />
              <span className="text-xs font-medium">Início</span>
              <Ponto ativo={activeTab === 'home'} />
            </button>
            <button onClick={() => openModal('cartoes')} className={`flex flex-col items-center gap-0.5 min-w-[56px] py-2 transition-colors cursor-pointer ${activeTab === 'cartoes' ? 'text-brand' : 'text-ink-3 hover:text-brand'}`}>
              <CreditCard className="h-[22px] w-[22px]" />
              <span className="text-xs font-medium">Cartões</span>
              <Ponto ativo={activeTab === 'cartoes'} />
            </button>
          </div>

          {naVisaoGeral && (
            <div className="absolute left-1/2 -top-6 -translate-x-1/2">
              {/* Com a IA desligada sobraria uma opção só na folha — então o
                  botão lança direto, sem abrir menu de um item. */}
              <button
                onClick={() => AI_ENABLED ? setIsFabOpen(true) : openModal('manual')}
                aria-label={AI_ENABLED ? "Adicionar" : "Novo lançamento"}
                aria-haspopup={AI_ENABLED ? "dialog" : undefined}
                aria-expanded={AI_ENABLED ? isFabOpen : undefined}
                className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-brand text-canvas shadow-[0_8px_28px_rgba(143,189,211,0.35)] transition-transform hover:scale-105 active:scale-95"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
          )}

          <div className="flex gap-8">
            <button onClick={() => openModal('relatorios')} className={`flex flex-col items-center gap-0.5 min-w-[56px] py-2 transition-colors cursor-pointer ${activeTab === 'relatorios' ? 'text-brand' : 'text-ink-3 hover:text-brand'}`}>
              <BarChart3 className="h-[22px] w-[22px]" />
              <span className="text-xs font-medium">Gráficos</span>
              <Ponto ativo={activeTab === 'relatorios'} />
            </button>
            <button onClick={() => openModal('config')} className={`flex flex-col items-center gap-0.5 min-w-[56px] py-2 transition-colors cursor-pointer ${activeTab === 'config' ? 'text-brand' : 'text-ink-3 hover:text-brand'}`}>
              <Settings className="h-[22px] w-[22px]" />
              <span className="text-xs font-medium">Ajustes</span>
              <Ponto ativo={activeTab === 'config'} />
            </button>
          </div>
        </div>
      </div>

      {/* O menu do "+" é uma folha, não um leque à mão.
          O leque anterior eram dois círculos soltos sobre um fundo escurecido:
          sem `role="dialog"`, sem Esc, sem armadilha de foco, sem devolver o
          foco ao fechar e sem responder ao botão voltar do Android. Pior, o
          fundo escurecido ficava em z-30, ABAIXO do botão de feedback (z-40),
          que continuava aceso e clicável por cima dele. A folha resolve os
          cinco de uma vez (`use-modal-a11y`) e sobe da base, onde a mão está.

          O "+" também deixou de girar 45°: com a folha por cima (z-50) ele
          fica atrás do fundo escurecido e a rotação não era mais vista. */}
      <Sheet
        isOpen={isFabOpen && naVisaoGeral}
        onClose={() => setIsFabOpen(false)}
        title="Adicionar"
        largura="sm"
      >
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => { setIsFabOpen(false); openModal('manual'); }}
            className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-field bg-brand px-4 py-3.5 text-left text-sm font-semibold text-canvas transition-colors hover:bg-brand-strong"
          >
            <PenTool className="h-5 w-5 shrink-0" />
            Novo lançamento
          </button>

          {AI_ENABLED && (
            <button
              onClick={() => { setIsFabOpen(false); openModal('camera'); }}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-field border border-line bg-white/5 px-4 py-3.5 text-left text-sm font-medium text-ink transition-colors hover:bg-white/10"
            >
              <Camera className="h-5 w-5 shrink-0 text-brand" />
              Ler fatura
            </button>
          )}
        </div>
      </Sheet>
    </>
  );
}
