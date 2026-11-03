"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Target, Sparkles, Loader2, Save } from "lucide-react";
import { AI_ENABLED } from "../lib/features";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { formatMoney } from "../lib/format";
import { getUserId, getAccessToken } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";

const CATEGORIES = ["Contas Fixas", "Variáveis", "Investimentos"];

export function BudgetModal({ isOpen, onClose, transactions, currentIncome, activeMonth, activeYear }: { isOpen: boolean, onClose: () => void, transactions: any[], currentIncome: number, activeMonth: number, activeYear: number }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  // Competencia do orcamento, no mesmo formato YYYY-MM usado no banco.
  const budgetMonth = activeYear + "-" + String(activeMonth + 1).padStart(2, "0");
  const [budgets, setBudgets] = useState<Record<string, number>>({
    "Contas Fixas": 0,
    "Variáveis": 0,
    "Investimentos": 0,
  });
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchBudgets();
    }
    // budgetMonth entra nas dependências: trocar de mês no dashboard e reabrir
    // precisa recarregar o orçamento daquela competência, não repetir a anterior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, budgetMonth]);

  const fetchBudgets = async () => {
    const userId = await getUserId();
    if (!userId) return;

    // Orçamento é por mês. Buscar sem filtrar competência traria o teto de
    // outro período e o consumo seria medido contra o número errado.
    const { data } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', userId)
      .eq('month', budgetMonth);

    const bMap: Record<string, number> = { "Contas Fixas": 0, "Variáveis": 0, "Investimentos": 0 };
    if (data) data.forEach(b => { bMap[b.category] = b.amount; });
    setBudgets(bMap);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const userId = await getUserId();
      if (!userId) {
        toast("Sessão expirada. Faça login novamente.", "error");
        return;
      }

      // ATENÇÃO: este delete precisa ser escopado ao mês.
      // Antes era `.eq('user_id', userId)` apenas — apagava TODOS os
      // orçamentos do usuário a cada salvamento. Com a coluna `month`, isso
      // destruiria o histórico inteiro ao editar um único mês.
      await supabase
        .from('budgets')
        .delete()
        .eq('user_id', userId)
        .eq('month', budgetMonth);

      const inserts = Object.keys(budgets).map(cat => ({
        user_id: userId,
        category: cat,
        amount: budgets[cat] || 0,
        month: budgetMonth,
      }));

      const { error } = await supabase.from('budgets').insert(inserts);
      if (error) throw error;
      toast("🌟 Orçamento do mês salvo!", "success");
      onClose();
    } catch (err: any) {
      toast("Erro ao salvar orçamentos: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiSuggest = async () => {
    if (currentIncome <= 0) {
      toast("Adicione alguma receita neste mês para a IA ter uma base!", "warning");
      return;
    }
    setIsAiLoading(true);
    try {
      const token = await getAccessToken() ?? '';

      const res = await fetch("/api/auto-budget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ income: currentIncome })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setBudgets(prev => ({
        ...prev,
        "Contas Fixas": data["Contas Fixas"] || prev["Contas Fixas"],
        "Variáveis": data["Variáveis"] || prev["Variáveis"],
        "Investimentos": data["Investimentos"] || prev["Investimentos"],
      }));

    } catch (err: any) {
      toast("Erro da IA: " + err.message, "error");
    } finally {
      setIsAiLoading(false);
    }
  };

  const getSpentAmount = (cat: string) => {
    return transactions.filter(t => {
      if (t.type !== 'expense') return false;
      // Tratar Investimentos como despesa no contexto de "onde foi o dinheiro"
      if (cat === 'Investimentos' && t.category !== 'Investimentos') return false;
      if (cat !== 'Investimentos' && t.category !== cat) return false;
      
      if (!t.date) return false;
      const [year, month] = t.date.split('-');
      return (parseInt(month) - 1) === activeMonth;
    }).reduce((acc, t) => acc + t.amount, 0);
  };


  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg sheet-panel rounded-t-card sm:rounded-card sheet-grab pb-safe sm:pb-0 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden max-h-[90vh] flex flex-col">
            
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                <Target className="w-5 h-5 text-ink-2" /> Orçamentos (Tetos)
              </h2>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto [&>*]:shrink-0 pr-2 pb-4 flex flex-col gap-5">
              
              {AI_ENABLED && (
                /* `shrink-0`: sem isto o card encolhia dentro da coluna
                   rolável e, como ele mesmo tem `overflow-hidden`, engolia o
                   próprio texto e o botão — sobrava só o título. */
                <div className="shrink-0 bg-white/5 border border-white/10 rounded-inner p-5 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand/[0.06] rounded-full blur-2xl group-hover:bg-brand/[0.06] transition-all"></div>
                  <h3 className="text-ink font-bold mb-2 flex items-center gap-2 relative z-10"><Sparkles className="w-4 h-4 text-brand" /> Auto-Orçamento IA</h3>
                  <p className="text-sm text-ink-2 mb-4 relative z-10">Deixe o Gemini analisar sua renda de <strong className="text-ink">{formatMoney(currentIncome)}</strong> e sugerir tetos saudáveis usando a regra 50/30/20.</p>
                  <button onClick={handleAiSuggest} disabled={isAiLoading} className="w-full relative z-10 bg-brand/20 hover:bg-brand/30 text-brand border border-brand/30 font-semibold py-2.5 rounded-field transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                    {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isAiLoading ? "Pensando..." : "Sugerir com IA"}
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {CATEGORIES.map(cat => {
                  const limit = budgets[cat] || 0;
                  const spent = getSpentAmount(cat);
                  const percent = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
                  
                  let barColor = "bg-pos";
                  if (percent > 75) barColor = "bg-warn";
                  if (percent >= 100) barColor = "bg-neg";

                  return (
                    <div key={cat} className="bg-white/5 border border-white/5 p-4 rounded-inner">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-ink">{cat}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-3">Teto: R$</span>
                          <input 
                            type="number" 
                            value={budgets[cat] || ""} 
                            onChange={(e) => setBudgets(p => ({ ...p, [cat]: Number(e.target.value) }))}
                            className="w-24 bg-white/5 border border-white/10 rounded-lg p-1.5 text-ink text-sm focus:outline-none focus:border-brand text-right font-medium"
                            placeholder="0,00"
                          />
                        </div>
                      </div>
                      <div className="w-full h-2 bg-surface rounded-full overflow-hidden border border-white/5 mb-2">
                         <motion.div initial={{ width: 0 }} animate={{ width: `${percent}%` }} className={`h-full ${barColor}`}></motion.div>
                      </div>
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-ink-2">Gasto: {formatMoney(spent)}</span>
                        <span className={percent >= 100 ? "text-neg" : "text-ink-3"}>{percent.toFixed(0)}% do limite</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 shrink-0">
              <button onClick={handleSave} disabled={isSaving} className="w-full bg-brand hover:bg-brand-strong text-canvas font-bold py-3.5 rounded-field transition-all shadow-lg shadow-brand/25 flex justify-center items-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Orçamentos
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
