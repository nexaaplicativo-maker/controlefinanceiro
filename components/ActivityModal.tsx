"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, Bell, TrendingUp, TrendingDown, AlertTriangle, Clock } from "lucide-react";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { formatMoney } from "../lib/format";
import { hojeEmSaoPaulo } from "../lib/data";

export function ActivityModal({ isOpen, onClose, transactions, dueBills = [] }: { isOpen: boolean, onClose: () => void, transactions: any[], dueBills?: any[] }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  if (!isOpen) return null;

  const recentActivities = transactions.slice(0, 15);
  const todayStr = hojeEmSaoPaulo();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex justify-end">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        />
        
        <motion.div ref={a11yRef} role="dialog" aria-modal="true" 
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="relative w-full max-w-sm h-full bg-surface border-l border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.65)] p-6 flex flex-col"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Bell className="w-5 h-5 text-neg" />
              Notificações
            </h2>
            <button onClick={onClose} aria-label="Fechar" className="p-2 text-ink-2 hover:text-ink bg-white/5 rounded-full">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
            
            {dueBills.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-ink-2 mb-3">Lembretes Inteligentes</h3>
                <div className="space-y-3">
                  {dueBills.map(bill => {
                    const isOverdue = bill.date < todayStr;
                    const isToday = bill.date === todayStr;
                    return (
                      <div key={bill.id} className="bg-neg/10 border border-neg/20 rounded-inner p-4 flex gap-3">
                        <div className="shrink-0 mt-1">
                          {isOverdue ? <AlertTriangle className="w-5 h-5 text-neg" /> : <Clock className="w-5 h-5 text-warn" />}
                        </div>
                        <div>
                          <h4 className="text-ink font-semibold text-sm">{bill.title}</h4>
                          <p className="text-xs text-ink-2 mt-1">
                            {isOverdue ? <span className="text-neg font-medium">Atrasada!</span> : (isToday ? <span className="text-warn font-medium">Vence Hoje!</span> : "Vence em breve")} • {formatMoney(bill.amount)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-ink-2 mb-3">Últimas Atividades</h3>
              <div className="space-y-2">
                {recentActivities.length === 0 ? (
                   <p className="text-ink-3 text-sm">Nenhuma atividade registrada.</p>
                ) : (
                  recentActivities.map((tx, idx) => {
                    const isIncome = tx.type === 'income';
                    return (
                      <div key={idx} className="flex gap-4 relative">
                         <div className="w-px h-full bg-white/10 absolute left-[19px] top-8 -z-10"></div>
                         
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${isIncome ? 'bg-pos/10 border-pos/20 text-pos' : 'bg-neg/10 border-neg/20 text-neg'}`}>
                            {isIncome ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                         </div>
                         <div className="pt-2 pb-6">
                            <p className="text-sm text-ink font-medium">
                              {isIncome ? 'Dinheiro na conta!' : 'Despesa registrada'}
                            </p>
                            <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                              O lançamento de <span className="text-ink">"{tx.title}"</span> no valor de <strong className={isIncome ? 'text-pos' : 'text-neg'}>{formatMoney(tx.amount)}</strong> foi adicionado em {tx.category}.
                            </p>
                            <span className="text-xs text-ink-3 mt-2 block font-medium">
                               {new Date(tx.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                            </span>
                         </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
