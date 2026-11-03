"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, Heart, Users, Sparkles, ArrowRight } from "lucide-react";
import { useModalA11y } from "../hooks/use-modal-a11y";

export function CoupleModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
        
        <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full sm:max-w-md sheet-panel sheet-grab shadow-[0_24px_60px_rgba(0,0,0,0.65)] rounded-t-card sm:rounded-card p-6 pb-safe sm:pb-6 overflow-hidden">
          
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-white/20 to-transparent"></div>
          
          <div className="flex justify-between items-center mb-6 relative">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Heart className="w-5 h-5 text-ink-2 fill-pink-500" /> Nexa Casais
            </h2>
            <button onClick={onClose} aria-label="Fechar" className="p-2 text-ink-2 hover:text-ink bg-white/5 rounded-full transition-colors"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex flex-col items-center justify-center text-center relative z-10 py-8">
            <div className="w-20 h-20 bg-white/20 border border-white/30 rounded-full flex items-center justify-center mb-6 relative">
              <Users className="w-10 h-10 text-ink-2" />
              <div className="absolute -bottom-2 -right-2 bg-surface p-1 rounded-full">
                <div className="bg-gradient-to-r from-brand to-brand-strong w-6 h-6 rounded-full flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-ink" />
                </div>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-ink mb-2">Casal que trabalha junto,</h3>
            <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-brand to-brand-strong mb-6">cresce junto!</h3>
            
            <p className="text-ink-2 mb-8 leading-relaxed">
              Bem-vindo(a) à área conjunta! Aqui vocês terão uma visão unificada dos gastos da casa, metas para viagens e a construção do patrimônio da família.
            </p>

            <button onClick={() => window.location.href = '/casais'} className="w-full bg-gradient-to-r from-brand to-brand-strong hover:from-brand-strong hover:to-brand text-ink font-bold py-3.5 rounded-field flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand/25 group">
              Acessar Painel do Casal <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
