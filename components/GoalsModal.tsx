"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Target, Plus, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { moverNaMeta } from "../lib/aporte-meta";
import { hojeEmSaoPaulo } from "../lib/data";
import { parseMoney } from "../lib/validation";
import { formatMoney } from "../lib/format";
import { confirmDialog } from "./ConfirmDialog";

export function GoalsModal({ isOpen, onClose, onSaved }: { isOpen: boolean, onClose: () => void, onSaved?: () => void }) {
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

    // `parseMoney` em vez de `parseFloat`: "1.500,00" virava 1,5 no segundo.
    const amount = parseMoney(transactionAmount);
    if (amount === null) { toast("Informe um valor válido.", "warning"); return; }

    const userId = await getUserId();
    if (!userId) { toast("Sessão expirada. Faça login novamente.", "error"); return; }

    // Guardar numa meta é dinheiro saindo da conta; retirar é voltando. Antes
    // só a meta era atualizada, então o mesmo real aparecia como saldo
    // disponível E como meta cumprida.
    const r = moverNaMeta({
      userId,
      goalId: activeGoal.id,
      tituloDaMeta: activeGoal.title,
      valor: amount,
      sentido: transactionType === 'add' ? 'guardar' : 'retirar',
      saldoAtualDaMeta: Number(activeGoal.current_amount ?? 0),
      data: hojeEmSaoPaulo(),
    });

    if (!r.ok) { toast(r.erro, "warning"); return; }

    const { error } = await supabase.from('transactions').insert([r.movimento.transacao]);
    if (error) { toast("Erro ao registrar o lançamento: " + error.message, "error"); return; }

    const { error: erroMeta } = await supabase
      .from('goals')
      .update({ current_amount: r.movimento.novoSaldoDaMeta })
      .eq('id', activeGoal.id);

    if (erroMeta) {
      toast("Erro ao atualizar meta.", "error");
      return;
    }

    setGoals(goals.map(g => g.id === activeGoal.id ? { ...g, current_amount: r.movimento.novoSaldoDaMeta } : g));
    setActiveGoal(null);
    setTransactionAmount("");
    toast(transactionType === 'add' ? "Valor guardado na meta! 💰" : "Valor retirado da meta.", "info");
    onSaved?.();
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ title: "Apagar esta meta?", message: "O progresso registrado nela será perdido.", confirmLabel: "Apagar", danger: true }))) return;
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (!error) setGoals(goals.filter(g => g.id !== id));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg sheet-panel rounded-t-card sm:rounded-card sheet-grab pb-safe sm:pb-0 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-ink flex items-center gap-2"><Target className="w-5 h-5 text-pos"/> Metas Financeiras</h2>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto [&>*]:shrink-0 pr-2 pb-4 flex flex-col gap-4">
              
              {!isCreating && !activeGoal && (
                <button onClick={() => setIsCreating(true)} className="w-full flex items-center justify-center gap-2 bg-pos/10 hover:bg-pos/20 text-pos border border-pos/20 py-3 rounded-field font-medium transition-all cursor-pointer">
                  <Plus className="w-4 h-4" /> Nova Meta
                </button>
              )}

              {isCreating && (
                <form onSubmit={handleCreateGoal} className="bg-white/5 border border-white/10 p-4 rounded-inner flex flex-col gap-4">
                  <h3 className="font-semibold text-ink">Criar Nova Meta</h3>
                  <input type="text" placeholder="Ex: Viagem para Praia, Carro Novo" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-field p-3 text-ink focus:border-pos outline-none" required />
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">R$</span>
                    <input type="number" step="0.01" placeholder="Valor Alvo" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-field py-3 pl-12 pr-4 text-ink focus:border-pos outline-none" required />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-3 text-ink-2 bg-white/5 hover:bg-white/5 rounded-field transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 py-3 bg-pos hover:bg-pos/85 text-canvas font-medium rounded-field transition-colors">Criar</button>
                  </div>
                </form>
              )}

              {activeGoal && (
                <form onSubmit={handleTransaction} className="bg-white/5 border border-white/10 p-4 rounded-inner flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-ink truncate pr-4">{activeGoal.title}</h3>
                    <button type="button" onClick={() => setActiveGoal(null)} className="p-1 text-ink-2 hover:text-ink"><X className="w-4 h-4"/></button>
                  </div>
                  
                  <div className="flex gap-2 bg-white/5 p-1 rounded-field">
                    <button type="button" onClick={() => setTransactionType('add')} className={`flex-1 py-2 flex justify-center items-center gap-1 rounded-lg text-sm font-medium ${transactionType === 'add' ? 'bg-pos/20 text-pos' : 'text-ink-3 hover:text-ink-2'}`}><TrendingUp className="w-3 h-3"/> Guardar</button>
                    <button type="button" onClick={() => setTransactionType('remove')} className={`flex-1 py-2 flex justify-center items-center gap-1 rounded-lg text-sm font-medium ${transactionType === 'remove' ? 'bg-neg/20 text-neg' : 'text-ink-3 hover:text-ink-2'}`}><TrendingDown className="w-3 h-3"/> Retirar</button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">R$</span>
                    <input type="number" step="0.01" placeholder="Valor" value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-field py-3 pl-12 pr-4 text-ink focus:border-brand outline-none" required autoFocus />
                  </div>
                  
                  <button type="submit" className={`w-full py-3 text-canvas font-medium rounded-field transition-colors ${transactionType === 'add' ? 'bg-pos hover:bg-pos/85' : 'bg-neg hover:bg-neg/85'}`}>
                    Confirmar Transação
                  </button>
                </form>
              )}

              {!isCreating && !activeGoal && (
                <div className="flex flex-col gap-3">
                  {isLoading ? (
                    <p className="text-center text-ink-3 py-4">Carregando metas...</p>
                  ) : goals.length === 0 ? (
                    <p className="text-center text-ink-3 py-4 text-sm">Você ainda não tem metas financeiras. Crie uma para começar a guardar dinheiro!</p>
                  ) : (
                    goals.map(goal => {
                      const percent = Math.min(100, Math.max(0, (goal.current_amount / goal.target_amount) * 100));
                      const isComplete = percent >= 100;
                      return (
                        <div key={goal.id} className="bg-white/5 border border-white/10 p-4 rounded-inner relative overflow-hidden group">
                          <div className="absolute top-3 right-3 flex gap-2">
                            <button onClick={() => setActiveGoal(goal)} className="p-2 text-brand hover:bg-brand/10 rounded-lg transition-colors"><Plus className="w-4 h-4"/></button>
                            <button onClick={() => handleDelete(goal.id)} className="p-2 text-ink-3 hover:text-neg hover:bg-neg/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                          </div>
                          
                          <div className="mb-4 pr-16">
                            <h4 className="font-semibold text-ink">{goal.title}</h4>
                            <p className="text-xs text-ink-2">
                              <span className={isComplete ? 'text-pos font-medium' : 'text-ink font-medium'}>{formatMoney(goal.current_amount)}</span> de {formatMoney(goal.target_amount)}
                            </p>
                          </div>

                          <div className="w-full bg-black/40 h-3 rounded-full overflow-hidden border border-white/5">
                            <div className={`h-full transition-all duration-1000 ${isComplete ? 'bg-pos' : 'bg-brand'}`} style={{ width: `${percent}%` }}></div>
                          </div>
                          <div className="text-right mt-1 text-xs text-ink-3 font-medium">{percent.toFixed(1)}% concluído</div>
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
