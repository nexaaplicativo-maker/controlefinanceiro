"use client";

import { useState } from "react";
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

  /* Sincroniza os campos com os dados recebidos DURANTE O RENDER, não num
     efeito.
     É o padrão que o React documenta para "ajustar estado quando uma prop
     muda": o render é descartado e refeito na hora, sem pintar a tela com o
     valor velho. O efeito fazia a mesma coisa um render depois — e esse
     render intermediário era o que mostrava o formulário com o conteúdo da
     abertura anterior por um instante. */
  const [sincronizadoCom, setSincronizadoCom] = useState<any>(null);
  const fonte = isOpen ? currentData : null;
  if (fonte !== sincronizadoCom) {
    setSincronizadoCom(fonte);
    if (fonte) {
      setWealth(fonte.joint_wealth || "0");
      setEmergency(fonte.emergency_fund || "0");
      setHouse(fonte.house_expenses || "0");
    }
  }

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
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
        <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative w-full sm:max-w-md sheet-panel sheet-grab rounded-t-card sm:rounded-card p-6 pb-safe sm:pb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-ink">Editar Valores do Casal</h2>
            <button onClick={onClose} aria-label="Fechar" className="p-2 text-ink-2 hover:text-ink bg-white/5 rounded-full"><X className="w-4 h-4" /></button>
          </div>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm text-ink-2 mb-1 flex items-center gap-2"><Building className="w-4 h-4 text-ink-2"/> Patrimônio Conjunto (R$)</label>
              <input type="number" value={wealth} onChange={e => setWealth(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-field p-3 text-ink focus:border-brand/60 outline-none" />
            </div>
            <div>
              <label className="text-sm text-ink-2 mb-1 flex items-center gap-2"><PiggyBank className="w-4 h-4 text-pos"/> Reserva de Emergência (R$)</label>
              <input type="number" value={emergency} onChange={e => setEmergency(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-field p-3 text-ink focus:border-brand/60 outline-none" />
            </div>
            <div>
              <label className="text-sm text-ink-2 mb-1 flex items-center gap-2"><Home className="w-4 h-4 text-neg"/> Despesas da Casa Mês (R$)</label>
              <input type="number" value={house} onChange={e => setHouse(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-field p-3 text-ink focus:border-brand/60 outline-none" />
            </div>
          </div>

          <button onClick={handleSave} disabled={loading} className="w-full bg-brand hover:bg-brand-strong text-canvas font-bold py-3 rounded-field flex items-center justify-center gap-2">
            {loading ? "Salvando..." : <><Save className="w-4 h-4" /> Atualizar Cofre</>}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
