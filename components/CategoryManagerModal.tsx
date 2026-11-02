"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Trash2, Tag, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { confirmDialog } from "./ConfirmDialog";

export function CategoryManagerModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<'expense' | 'income'>('expense');

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  async function fetchCategories() {
    setIsLoading(true);
    const userId = await getUserId();
    if (!userId) {
      setIsLoading(false);
      toast("Sessão expirada. Faça login novamente.", "error");
      return;
    }
    const { data } = await supabase.from('categories').select('*').eq('user_id', userId).order('name', { ascending: true });
    if (data) setCategories(data);
    setIsLoading(false);
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast("Preencha o nome da categoria.", "warning");
      return;
    }
    
    const userId = await getUserId();
    const { data, error } = await supabase.from('categories').insert([{
      user_id: userId,
      name,
      type
    }]).select();

    if (error) {
      toast("Erro ao criar categoria. Verifique se rodou o script SQL no Supabase.", "error");
    } else if (data) {
      setCategories([...categories, data[0]].sort((a,b) => a.name.localeCompare(b.name)));
      setIsCreating(false);
      setName("");
      toast("Categoria criada com sucesso!", "success");
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog({ title: "Apagar esta categoria?", message: "Ela desaparecerá das opções de lançamento. Os lançamentos já feitos continuam como estão.", confirmLabel: "Apagar", danger: true }))) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) setCategories(categories.filter(c => c.id !== id));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Tag className="w-5 h-5 text-indigo-400"/> Categorias</h2>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto pr-2 pb-4 flex flex-col gap-4">
              
              {!isCreating && (
                <button onClick={() => setIsCreating(true)} className="w-full flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 py-3 rounded-xl font-medium transition-all cursor-pointer">
                  <Plus className="w-4 h-4" /> Nova Categoria
                </button>
              )}

              {isCreating && (
                <form onSubmit={handleCreate} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col gap-4">
                  <h3 className="font-semibold text-white">Criar Nova Categoria</h3>
                  
                  <div className="flex gap-2 bg-black/20 p-1 rounded-xl">
                    <button type="button" onClick={() => setType('expense')} className={`flex-1 py-2 flex justify-center items-center gap-1 rounded-lg text-sm font-medium ${type === 'expense' ? 'bg-rose-500/20 text-rose-400' : 'text-neutral-500 hover:text-neutral-300'}`}><TrendingDown className="w-3 h-3"/> Despesa</button>
                    <button type="button" onClick={() => setType('income')} className={`flex-1 py-2 flex justify-center items-center gap-1 rounded-lg text-sm font-medium ${type === 'income' ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'}`}><TrendingUp className="w-3 h-3"/> Receita</button>
                  </div>

                  <input type="text" placeholder="Nome (Ex: Viagens, Ifood...)" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" required autoFocus />
                  
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => setIsCreating(false)} className="flex-1 py-3 text-neutral-400 bg-black/20 hover:bg-white/5 rounded-xl transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-xl transition-colors">Salvar</button>
                  </div>
                </form>
              )}

              <div className="flex flex-col gap-2 mt-2">
                <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">Suas Categorias</h3>
                {isLoading ? (
                  <p className="text-center text-neutral-500 py-4">Carregando...</p>
                ) : categories.length === 0 ? (
                  <p className="text-center text-neutral-500 py-4 text-sm">Nenhuma categoria criada. Crie uma acima ou use as padrões.</p>
                ) : (
                  categories.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center bg-white/5 border border-white/10 p-3 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${cat.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                        <span className="text-white font-medium">{cat.name}</span>
                      </div>
                      <button onClick={() => handleDelete(cat.id)} className="p-2 text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))
                )}
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
