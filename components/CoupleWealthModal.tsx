"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Building, PiggyBank, Home, Save } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";

export function CoupleWealthModal({ isOpen, onClose, currentData, onSave }: any) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [wealth, setWealth] = useState("");
  const [emergency, setEmergency] = useState("");
  const [house, setHouse] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentData) {
      setWealth(currentData.joint_wealth || "0");
      setEmergency(currentData.emergency_fund || "0");
      setHouse(currentData.house_expenses || "0");
    }
  }, [currentData, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setLoading(true);
    const userId = await getUserId();
    if (!userId) {
      setLoading(false);
      toast("Sessão expirada. Faça login novamente.", "error");
      return;
    }
    const payload = {
      user_id: userId,
      joint_wealth: parseFloat(wealth) || 0,
      emergency_fund: parseFloat(emergency) || 0,
      house_expenses: parseFloat(house) || 0
    };

    let error;
    if (currentData && currentData.id) {
      const res = await supabase.from('couple_settings').update(payload).eq('id', currentData.id);
      error = res.error;
    } else {
      const res = await supabase.from('couple_settings').insert([payload]);
      error = res.error;
    }

    setLoading(false);
    if (!error) {
      toast("Cofre do casal atualizado! ❤️", "success");
      onSave(); 
      onClose();
    } else {
      toast("Erro ao salvar dados.", "error");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full max-w-md bg-neutral-900 border border-pink-500/30 rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Editar Valores do Casal</h2>
            <button onClick={onClose} aria-label="Fechar" className="p-2 text-neutral-400 hover:text-white bg-white/5 rounded-full"><X className="w-4 h-4" /></button>
          </div>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm text-neutral-400 mb-1 flex items-center gap-2"><Building className="w-4 h-4 text-pink-400"/> Patrimônio Conjunto (R$)</label>
              <input type="number" value={wealth} onChange={e => setWealth(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-pink-500 outline-none" />
            </div>
            <div>
              <label className="text-sm text-neutral-400 mb-1 flex items-center gap-2"><PiggyBank className="w-4 h-4 text-emerald-400"/> Reserva de Emergência (R$)</label>
              <input type="number" value={emergency} onChange={e => setEmergency(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-pink-500 outline-none" />
            </div>
            <div>
              <label className="text-sm text-neutral-400 mb-1 flex items-center gap-2"><Home className="w-4 h-4 text-rose-400"/> Despesas da Casa Mês (R$)</label>
              <input type="number" value={house} onChange={e => setHouse(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white focus:border-pink-500 outline-none" />
            </div>
          </div>

          <button onClick={handleSave} disabled={loading} className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
            {loading ? "Salvando..." : <><Save className="w-4 h-4" /> Atualizar Cofre</>}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
