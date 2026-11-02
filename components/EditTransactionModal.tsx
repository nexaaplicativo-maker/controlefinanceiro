"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, TrendingUp, TrendingDown, Calendar, Save, Loader2, ChevronDown, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { validateText, validateMoney, validateDate, firstError } from "../lib/validation";
import { getUserId } from "../lib/session";
import { recordCorrection } from "../lib/corrections-db";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { SUBCATEGORIAS } from "../lib/subcategorias";

interface Transaction {
  id: string;
  title: string;
  amount: number;
  category: string;
  /** Segundo eixo: onde o gasto aconteceu. Nulo em receita e em lançamento
   *  anterior à coluna existir. */
  subcategoria?: string | null;
  type: string;
  date: string;
}

export function EditTransactionModal({ 
  isOpen, 
  onClose, 
  transaction,
  onSave
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  transaction: Transaction | null;
  onSave?: () => void;
}) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Variáveis");
  const [date, setDate] = useState("");
  
  const [customCategories, setCustomCategories] = useState<any[]>([]);
  const [subcategoria, setSubcategoria] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && transaction) {
      setTitle(transaction.title);
      setAmount(transaction.amount.toString());
      setCategory(transaction.category);
      setSubcategoria(transaction.subcategoria || "");
      setType(transaction.type as 'expense' | 'income');
      // Format date correctly
      setDate(transaction.date.split('T')[0]);
      fetchCategories();
    }
  }, [isOpen, transaction]);

  async function fetchCategories() {
    const userId = await getUserId();
    if (!userId) {
      toast("Sessão expirada. Faça login novamente.", "error");
      return;
    }
    const { data } = await supabase.from('categories').select('*').eq('user_id', userId).order('name');
    if (data) setCustomCategories(data);
  }

  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    if (newType === 'income' && category !== 'Salário' && category !== 'Investimentos') {
      setCategory('Salário');
    } else if (newType === 'expense' && category === 'Salário') {
      setCategory('Variáveis');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transaction) return;

    const vTitulo = validateText(title, 'título');
    const vValor = validateMoney(amount, 'valor');
    const vData = validateDate(date);
    const erro = firstError(vTitulo, vValor, vData);
    if (erro) { toast(erro, "warning"); return; }

    setIsLoading(true);

    try {
      const baseAmount = vValor.value as number;
      
      const { error } = await supabase.from('transactions').update({
        title,
        amount: baseAmount,
        type,
        category,
        // Receita não tem "onde foi gasto": se virou receita na edição, o
        // valor antigo não pode ficar para trás sujando o resumo do mês.
        subcategoria: type === 'expense' ? (subcategoria || null) : null,
        date
      }).eq('id', transaction.id);

      if (error) throw error;

      // Se o usuário trocou a categoria, o app aprende: a próxima sugestão
      // para um título parecido já vem corrigida. Falha aqui não atrapalha o
      // salvamento — aprender é bônus.
      if (transaction.category && transaction.category !== category) {
        const uid = await getUserId();
        if (uid) await recordCorrection(uid, title, transaction.category, category);
      }

      toast("🎉 Lançamento atualizado com sucesso!", "success");
      onClose();
      if (onSave) onSave();
      
    } catch (error: any) {
      console.error(error);
      toast("Erro ao salvar alterações: " + error.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-lg bg-neutral-900 border border-indigo-500/30 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-white">Editar Lançamento</h2>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto pr-2">
              
              <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10 shrink-0">
                <button type="button" onClick={() => handleTypeChange('expense')} className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors ${type === 'expense' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-neutral-400 hover:text-white'}`}>
                  <TrendingDown className="w-4 h-4" /> Despesa
                </button>
                <button type="button" onClick={() => handleTypeChange('income')} className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors ${type === 'income' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-400 hover:text-white'}`}>
                  <TrendingUp className="w-4 h-4" /> Receita
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Valor Total</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">R$</span>
                  <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1.5">Título do Lançamento</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-neutral-600 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">Categoria</label>
                  <div className="relative">
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-4 pr-10 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer">
                      {type === 'expense' ? (
                      <>
                        <option value="Variáveis">Variáveis</option>
                        <option value="Contas Fixas">Contas Fixas</option>
                        <option value="Cartões">Cartões</option>
                        <option value="Investimentos">Investimentos</option>
                        {customCategories.filter(c => c.type === 'expense').map(c => (
                           <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </>
                    ) : (
                      <>
                        <option value="Salário">Salário</option>
                        <option value="Investimentos">Investimentos</option>
                        <option value="Vendas">Vendas</option>
                        <option value="Outros">Outros</option>
                        {customCategories.filter(c => c.type === 'income').map(c => (
                           <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                        </>
                      )}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                  </div>

                  {/* Mesmo alerta do lançamento: compra de ativo é Despesa. */}
                  {type === 'income' && category === 'Investimentos' && (
                    <div className="mt-3 flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs leading-relaxed">
                        <p className="text-amber-200 font-semibold mb-1">Isso é uma venda ou resgate?</p>
                        <p className="text-neutral-400">
                          Se você <strong className="text-neutral-300">comprou</strong> o ativo, o certo é <strong className="text-neutral-300">Despesa</strong> — o dinheiro saiu da conta e virou patrimônio.
                        </p>
                        <button
                          type="button"
                          onClick={() => { setType('expense'); setCategory('Investimentos'); }}
                          className="mt-2 text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 cursor-pointer"
                        >
                          Corrigir para Despesa
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">Data</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                </div>
              </div>

              {type === 'expense' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-neutral-400 mb-1.5">
                    Onde foi o gasto <span className="text-neutral-600 font-normal">(opcional)</span>
                  </label>
                  <div className="relative">
                    <select value={subcategoria} onChange={(e) => setSubcategoria(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-4 pr-10 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer">
                      <option value="">Não classificado</option>
                      {SUBCATEGORIAS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-white/10">
                <button type="submit" disabled={isLoading} className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-indigo-500/25 active:scale-[0.98] flex items-center justify-center gap-2">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  {isLoading ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
