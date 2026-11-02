"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Target } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";

export function CoupleGoalModal({ isOpen, onClose, selectedGoal, onSave }: any) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    const userId = await getUserId();
    if (!userId) {
      setLoading(false);
      toast("Sessão expirada. Faça login novamente.", "error");
      return;
    }
    let error;
    if (selectedGoal) {
      const newTotal = Number(selectedGoal.current_amount) + Number(addAmount);
      const res = await supabase.from('couple_goals').update({ current_amount: newTotal }).eq('id', selectedGoal.id);
      error = res.error;
    } else {
      const res = await supabase.from('couple_goals').insert([{
        user_id: userId,
        title,
        target_amount: Number(targetAmount),
        current_amount: 0,
        color: 'pink',
        icon: 'Target'
      }]);
      error = res.error;
    }

    setLoading(false);
    if (!error) {
      setTitle(""); setTargetAmount(""); setAddAmount("");
      toast(selectedGoal ? "Depósito realizado na meta! 💸" : "Nova meta criada! 🎯", "success");
      onSave();
      onClose();
    } else {
      toast("Erro ao salvar.", "error");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-neutral-900 border border-pink-500/30 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-pink-500" />
              {selectedGoal ? "Depositar na Meta" : "Nova Meta do Casal"}
            </h2>
            <button onClick={onClose} aria-label="Fechar" className="p-2 text-neutral-400 hover:text-white bg-white/5 rounded-full"><X className="w-4 h-4" /></button>
          </div>
          
          <div className="space-y-4 mb-6">
            {selectedGoal ? (
              <div>
                <label className="text-sm text-neutral-400 mb-1 block">Valor a adicionar (R$)</label>
                <input type="number" value={addAmount} onChange={e => setAddAmount(e.target.value)} placeholder="Ex: 500" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-pink-500 outline-none" />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm text-neutral-400 mb-1 block">Nome da Meta</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Casamento, Carro Novo..." className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-pink-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm text-neutral-400 mb-1 block">Qual o valor total necessário? (R$)</label>
                  <input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="Ex: 50000" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-pink-500 outline-none" />
                </div>
              </>
            )}
          </div>

          <button onClick={handleSave} disabled={loading} className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
            {loading ? "Salvando..." : <><Plus className="w-4 h-4" /> Salvar</>}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
