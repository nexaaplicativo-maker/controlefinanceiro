"use client";

import { useState } from "react";
import { Home, CreditCard, BarChart3, Settings, Plus, Camera, PenTool } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AI_ENABLED } from "../lib/features";

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
    <div className="md:hidden block"> {/* <--- A CAPA DE INVISIBILIDADE NO PC ESTÁ AQUI */}
      <div className="fixed bottom-0 left-0 w-full z-40 pb-safe px-safe">
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

          <div className="absolute left-1/2 -top-6 -translate-x-1/2">
            {/* Com a IA desligada sobraria uma opção só no leque — então o
                botão lança direto, sem abrir menu de um item. */}
            <button
              onClick={() => AI_ENABLED ? setIsFabOpen(!isFabOpen) : openModal('manual')}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-canvas shadow-xl transition-all duration-300 cursor-pointer ${isFabOpen ? 'bg-white/5 border border-white/10 rotate-45' : 'bg-brand shadow-[0_8px_28px_rgba(143,189,211,0.35)] hover:scale-105 active:scale-95'}`}
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>

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

      <AnimatePresence>
        {isFabOpen && AI_ENABLED && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-30"
              onClick={() => setIsFabOpen(false)}
            />
            <div className="fixed bottom-above-nav left-1/2 -translate-x-1/2 z-30 flex gap-6">
              <motion.button 
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0, transition: { duration: 0.1 } }}
                onClick={() => { setIsFabOpen(false); openModal('manual'); }}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 active:scale-95 transition-transform">
                  <PenTool className="w-6 h-6 text-brand" />
                </div>
                <span className="text-ink text-xs font-medium bg-black/50 px-2 py-1 rounded-md backdrop-blur-md border border-white/5">Manual</span>
              </motion.button>
              
              <motion.button 
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { delay: 0.05 } }} exit={{ y: 20, opacity: 0, transition: { duration: 0.1 } }}
                onClick={() => { setIsFabOpen(false); openModal('camera'); }}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className="w-14 h-14 bg-gradient-to-r from-brand to-brand rounded-full flex items-center justify-center shadow-lg shadow-brand/30 group-hover:scale-110 active:scale-95 transition-transform">
                  <Camera className="w-6 h-6 text-ink" />
                </div>
                <span className="text-ink text-xs font-medium bg-black/50 px-2 py-1 rounded-md backdrop-blur-md border border-white/5">Câmera IA</span>
              </motion.button>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
