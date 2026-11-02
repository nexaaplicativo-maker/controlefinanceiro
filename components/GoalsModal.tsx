"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Target, Plus, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { confirmDialog } from "./ConfirmDialog";

export function GoalsModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [goals, setGoals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");

  const [activeGoal, setActiveGoal] = useState<any>(null);
  const [transactionType, setTransactionType] = useState<'add'|'remove'>('add');
  const [transactionAmount, setTransactionAmount] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchGoals();
    }
  }, [isOpen]);

  async function fetchGoals() {
    setIsLoading(true);
    const userId = await getUserId();
    if (!userId) {
      setIsLoading(false);
      toast("Sessão expirada. Faça login novamente.", "error");
      return;
    }
    const { data } = await supabase.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (data) setGoals(data);
    setIsLoading(false);
  }

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetAmount) {
      toast("Preencha título e valor alvo.", "warning");
      return;
    }
    
    const userId = await getUserId();
    const { data, error } = await supabase.from('goals').insert([{
      user_id: userId,
      title,
      target_amount: parseFloat(targetAmount.replace(',', '.')),
      current_amount: 0
    }]).select();

    if (error) {
      toast("Erro ao criar meta. Verifique se rodou o script SQL no Supabase.", "error");
    } else if (data) {
      setGoals([data[0], ...goals]);
      setIsCreating(false);
      setTitle("");
      setTargetAmount("");
      toast("Meta criada! 🎯", "success");
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionAmount || !activeGoal) return;

    const amount = parseFloat(transactionAmount.replace(',', '.'));
    const newAmount = transactionType === 'add' ? activeGoal.current_amount + amount : activeGoal.current_amount - amount;

    const { error } = await supabase.from('goals').update({ current_amount: newAmount }).eq('id', activeGoal.id);
    
    if (error) {
      toast("Erro ao atualizar meta.", "error");
    } else {
      setGoals(goals.map(g => g.id === activeGoal.id ? { ...g, current_amount: newAmount } : g));
      setActiveGoal(null);
      setTransactionAmount("");
      toast(transactionType === 'add' ? "Valor adicionado à meta! 💰" : "Valor removido da meta.", "info");
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ title: "Apagar esta meta?", message: "O progresso registrado nela será perdido.", confirmLabel: "Apagar", danger: true }))) return;
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (!error) setGoals(goals.filter(g => g.id !== id));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Target className="w-5 h-5 text-emerald-400"/> Metas Financeiras</h2>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto pr-2 pb-4 flex flex-col gap-4">
              
              {!isCreating && !activeGoal && (
                <button onClick={() => setIsCreating(true)} className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 py-3 rounded-xl font-medium transition-all cursor-pointer">
                  <Plus className="w-4 h-4" /> Nova Meta
                </button>
              )}

              {isCreating && (
                <form onSubmit={handleCreateGoal} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-4">
                  <h3 className="font-semibold text-white">Criar Nova Meta</h3>
                  <input type="text" placeholder="Ex: Viagem para Praia, Carro Novo" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-emerald-500 outline-none" required />
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">R$</span>
                    <input type="number" step="0.01" placeholder="Valor Alvo" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-emerald-500 outline-none" required />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-3 text-neutral-400 bg-black/20 hover:bg-white/5 rounded-xl transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors">Criar</button>
                  </div>
                </form>
              )}

              {activeGoal && (
                <form onSubmit={handleTransaction} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-white truncate pr-4">{activeGoal.title}</h3>
                    <button type="button" onClick={() => setActiveGoal(null)} className="p-1 text-neutral-400 hover:text-white"><X className="w-4 h-4"/></button>
                  </div>
                  
                  <div className="flex gap-2 bg-black/20 p-1 rounded-xl">
                    <button type="button" onClick={() => setTransactionType('add')} className={`flex-1 py-2 flex justify-center items-center gap-1 rounded-lg text-sm font-medium ${transactionType === 'add' ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'}`}><TrendingUp className="w-3 h-3"/> Guardar</button>
                    <button type="button" onClick={() => setTransactionType('remove')} className={`flex-1 py-2 flex justify-center items-center gap-1 rounded-lg text-sm font-medium ${transactionType === 'remove' ? 'bg-rose-500/20 text-rose-400' : 'text-neutral-500 hover:text-neutral-300'}`}><TrendingDown className="w-3 h-3"/> Retirar</button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">R$</span>
                    <input type="number" step="0.01" placeholder="Valor" value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-indigo-500 outline-none" required autoFocus />
                  </div>
                  
                  <button type="submit" className={`w-full py-3 text-white font-medium rounded-xl transition-colors ${transactionType === 'add' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'}`}>
                    Confirmar Transação
                  </button>
                </form>
              )}

              {!isCreating && !activeGoal && (
                <div className="flex flex-col gap-3">
                  {isLoading ? (
                    <p className="text-center text-neutral-500 py-4">Carregando metas...</p>
                  ) : goals.length === 0 ? (
                    <p className="text-center text-neutral-500 py-4 text-sm">Você ainda não tem metas financeiras. Crie uma para começar a guardar dinheiro!</p>
                  ) : (
                    goals.map(goal => {
                      const percent = Math.min(100, Math.max(0, (goal.current_amount / goal.target_amount) * 100));
                      const isComplete = percent >= 100;
                      return (
                        <div key={goal.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl relative overflow-hidden group">
                          <div className="absolute top-3 right-3 flex gap-2">
                            <button onClick={() => setActiveGoal(goal)} className="p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"><Plus className="w-4 h-4"/></button>
                            <button onClick={() => handleDelete(goal.id)} className="p-2 text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                          </div>
                          
                          <div className="mb-4 pr-16">
                            <h4 className="font-semibold text-white">{goal.title}</h4>
                            <p className="text-xs text-neutral-400">
                              <span className={isComplete ? 'text-emerald-400 font-medium' : 'text-white font-medium'}>R$ {goal.current_amount.toFixed(2).replace('.',',')}</span> de R$ {goal.target_amount.toFixed(2).replace('.',',')}
                            </p>
                          </div>

                          <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden border border-white/5">
                            <div className={`h-full transition-all duration-1000 ${isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${percent}%` }}></div>
                          </div>
                          <div className="text-right mt-1 text-[10px] text-neutral-500 font-medium">{percent.toFixed(1)}% concluído</div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
