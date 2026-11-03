"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, TrendingUp, Edit2, Trash2, CheckCircle2, Clock } from "lucide-react";
import { useModalA11y } from "../hooks/use-modal-a11y";

export function IncomeListModal({ isOpen, onClose, incomes, onEdit, onDelete, onTogglePaid, formatMoney }: any) {
  const a11yRef = useModalA11y(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />
        <motion.div ref={a11yRef} role="dialog" aria-modal="true" 
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
          className="relative w-full sm:max-w-md sheet-panel sheet-grab rounded-t-card sm:rounded-card shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col max-h-[88dvh] pb-safe sm:pb-0"
        >
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-field bg-pos/20 flex items-center justify-center border border-pos/30">
                <TrendingUp className="w-5 h-5 text-pos" />
              </div>
              <h2 className="text-xl font-bold text-ink tracking-tight">Suas Receitas</h2>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="p-2 text-ink-2 hover:text-ink hover:bg-white/10 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-3">
            {incomes.length === 0 ? (
              <p className="text-center text-ink-3 py-4">Nenhuma receita registrada neste mês.</p>
            ) : (
              incomes.map((item: any) => (
                <div key={item.id} className={`flex justify-between items-center text-sm p-4 rounded-inner border transition-all ${ item.is_paid === false ? 'bg-warn/5 border-warn/10' : 'bg-white/5 border-white/5' }`}>
                  <div className="flex flex-col gap-1 min-w-0 pr-4 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${ item.is_paid === false ? 'bg-warn' : 'bg-pos' }`} title={item.is_paid === false ? 'Pendente' : 'Recebido'} />
                      <span className="text-ink font-semibold line-clamp-1">{item.title}</span>
                      {item.is_paid === false && (
                        <span className="text-xs font-bold text-warn bg-warn/10 px-1.5 py-0.5 rounded-md">PEND.</span>
                      )}
                    </div>
                    <span className="text-pos font-bold text-lg">+ {formatMoney(item.amount)}</span>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    {item.is_paid !== undefined && (
                      <button 
                        onClick={() => onTogglePaid(item.id, item.is_paid)} 
                        className={`p-2 rounded-field transition-colors shrink-0 ${item.is_paid ? 'text-pos/50 hover:text-pos hover:bg-pos/10' : 'text-warn/80 hover:text-warn hover:bg-warn/10'}`}
                        title={item.is_paid ? 'Marcar como pendente' : 'Marcar como recebido'}
                      >
                        {item.is_paid ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      </button>
                    )}
                    <button 
                      onClick={() => { onEdit(item); onClose(); }} 
                      className="text-brand/50 hover:text-brand p-2 rounded-field hover:bg-brand/10 transition-colors shrink-0"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onDelete(item.id)} 
                      className="text-neg/50 hover:text-neg p-2 rounded-field hover:bg-neg/10 transition-colors shrink-0"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
