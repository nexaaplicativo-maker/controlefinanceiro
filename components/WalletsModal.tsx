"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Wallet, Trash2, Plus, CreditCard, Building2, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { useModalA11y } from "../hooks/use-modal-a11y";

export function WalletsModal({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletType, setNewWalletType] = useState("bank"); // bank or credit
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      loadWallets();
    }
  }, [isOpen, userId]);

  const loadWallets = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId).order('created_at', { ascending: true });
    if (!error && data) {
      setWallets(data);
    }
    setLoading(false);
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
    setIsSaving(true);
    
    const { data, error } = await supabase.from('wallets').insert([{
      name: newWalletName,
      type: newWalletType,
      user_id: userId,
      // `balance` existe na tabela mas nunca é lido nem atualizado: o saldo da
      // carteira é sempre calculado somando as transações. Gravar 0 aqui dava
      // a impressão de um campo mantido, que induziria alguém a confiar nele.
    }]).select();

    if (!error && data) {
      setWallets([...wallets, data[0]]);
      setNewWalletName("");
      toast("Carteira criada com sucesso! 💳", "success");
    } else {
      toast("Erro ao criar carteira: " + (error?.message || 'Desconhecido'), "error");
    }
    setIsSaving(false);
  };

  const handleDeleteWallet = async (id: string) => {
    if (confirm("Tem certeza? Transações ligadas a esta carteira ficarão sem carteira vinculada.")) {
      const { error } = await supabase.from('wallets').delete().eq('id', id);
      if (!error) {
        setWallets(wallets.filter(w => w.id !== id));
        toast("Carteira excluída.", "success");
      } else {
        toast("Erro ao excluir carteira.", "error");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
        
        <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="relative w-full sm:max-w-md sheet-panel sheet-grab shadow-[0_24px_60px_rgba(0,0,0,0.65)] rounded-t-card sm:rounded-card p-6 pb-safe sm:pb-6 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-ink flex items-center gap-2">
              <Wallet className="w-5 h-5 text-brand" /> Minhas Carteiras
            </h2>
            <button onClick={onClose} aria-label="Fechar" className="p-2 text-ink-2 hover:text-ink bg-white/5 rounded-full"><X className="w-4 h-4" /></button>
          </div>

          <form onSubmit={handleCreateWallet} className="flex gap-2 mb-6">
            <div className="flex-1 flex gap-2 bg-white/5 p-1 border border-white/10 rounded-field">
              <select value={newWalletType} onChange={(e) => setNewWalletType(e.target.value)} className="bg-transparent text-ink text-sm outline-none px-2 border-r border-white/10">
                <option value="bank" className="bg-surface">Conta</option>
                <option value="credit" className="bg-surface">Cartão</option>
              </select>
              <input 
                type="text" 
                value={newWalletName} onChange={e => setNewWalletName(e.target.value)}
                placeholder="Ex: Nubank, Itaú..."
                className="flex-1 bg-transparent text-ink placeholder-neutral-500 text-sm focus:outline-none px-2"
                required
              />
            </div>
            <button type="submit" disabled={isSaving || !newWalletName.trim()} className="bg-brand hover:bg-brand disabled:bg-brand/50 text-ink p-3 rounded-field flex items-center justify-center transition-colors">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </form>

          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand" /></div>
          ) : wallets.length === 0 ? (
            <div className="text-center py-8 bg-white/5 rounded-inner border border-white/5">
              <Wallet className="w-8 h-8 text-ink-3 mx-auto mb-3" />
              <p className="text-ink-2 text-sm">Nenhuma carteira criada.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-inner hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-field flex items-center justify-center ${wallet.type === 'credit' ? 'bg-brand/20 text-brand' : 'bg-pos/20 text-pos'}`}>
                      {wallet.type === 'credit' ? <CreditCard className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="text-ink font-medium">{wallet.name}</h3>
                      <p className="text-xs text-ink-2">{wallet.type === 'credit' ? 'Cartão de Crédito' : 'Conta Bancária'}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteWallet(wallet.id)} className="p-2 text-ink-3 hover:text-neg hover:bg-neg/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
