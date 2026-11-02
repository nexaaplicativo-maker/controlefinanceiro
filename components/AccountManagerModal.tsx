"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Trash2, Wallet, CreditCard, Building2, Loader2, Edit2, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";

interface Wallet {
  id: string;
  name: string;
  type: string;
  balance: number;
  user_id: string;
}

export function AccountManagerModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletType, setNewWalletType] = useState("bank");
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    if (isOpen) loadWallets();
  }, [isOpen]);

  const loadWallets = async () => {
    setLoading(true);
    const userId = await getUserId();
    if (!userId) {
      setLoading(false);
      toast("Sessão expirada. Faça login novamente.", "error");
      return;
    }
    setUserId(userId);
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (!error && data) setWallets(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
    setIsSaving(true);
    const { data, error } = await supabase
      .from('wallets')
      .insert([{ name: newWalletName.trim(), type: newWalletType, user_id: userId, balance: 0 }])
      .select();
    if (!error && data) {
      setWallets(prev => [...prev, data[0]]);
      setNewWalletName("");
      toast("Conta criada com sucesso! 💳", "success");
    } else {
      toast("Erro ao criar conta: " + (error?.message || 'Desconhecido'), "error");
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta conta? Transações vinculadas ficarão sem conta associada.")) return;
    const { error } = await supabase.from('wallets').delete().eq('id', id);
    if (!error) {
      setWallets(prev => prev.filter(w => w.id !== id));
      toast("Conta excluída.", "success");
    } else {
      toast("Erro ao excluir conta.", "error");
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('wallets').update({ name: editName.trim() }).eq('id', id);
    if (!error) {
      setWallets(prev => prev.map(w => w.id === id ? { ...w, name: editName.trim() } : w));
      toast("Conta renomeada.", "success");
      setEditingId(null);
    } else {
      toast("Erro ao renomear.", "error");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.div ref={a11yRef} role="dialog" aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-400" /> Minhas Contas
              </h2>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add new wallet form */}
            <form onSubmit={handleCreate} className="flex gap-2 mb-6 shrink-0">
              <div className="flex-1 flex gap-0 bg-black/20 border border-white/10 rounded-xl overflow-hidden">
                <select
                  value={newWalletType}
                  onChange={e => setNewWalletType(e.target.value)}
                  className="bg-transparent text-white text-sm outline-none px-3 py-2 border-r border-white/10 cursor-pointer"
                >
                  <option value="bank" className="bg-neutral-900">🏦 Conta</option>
                  <option value="credit" className="bg-neutral-900">💳 Cartão</option>
                </select>
                <input
                  type="text"
                  value={newWalletName}
                  onChange={e => setNewWalletName(e.target.value)}
                  placeholder="Ex: Nubank, Itaú, XP..."
                  className="flex-1 bg-transparent text-white placeholder-neutral-500 text-sm focus:outline-none px-3"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSaving || !newWalletName.trim()}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/40 text-white px-3 rounded-xl flex items-center justify-center transition-colors shrink-0"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </form>

            {/* Wallets list */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
              ) : wallets.length === 0 ? (
                <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/5">
                  <Wallet className="w-8 h-8 text-neutral-500 mx-auto mb-3" />
                  <p className="text-neutral-400 text-sm">Nenhuma conta cadastrada.</p>
                  <p className="text-neutral-500 text-xs mt-1">Crie sua primeira conta acima.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {wallets.map(wallet => (
                    <div key={wallet.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/8 transition-colors group">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${wallet.type === 'credit' ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {wallet.type === 'credit' ? <CreditCard className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingId === wallet.id ? (
                            <input
                              autoFocus
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleRename(wallet.id); if (e.key === 'Escape') setEditingId(null); }}
                              className="w-full bg-black/30 border border-indigo-500/50 rounded-lg px-2 py-1 text-white text-sm focus:outline-none"
                            />
                          ) : (
                            <h3 className="text-white font-medium truncate">{wallet.name}</h3>
                          )}
                          <p className="text-xs text-neutral-400">{wallet.type === 'credit' ? 'Cartão de Crédito' : 'Conta Bancária'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {editingId === wallet.id ? (
                          <button onClick={() => handleRename(wallet.id)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => { setEditingId(wallet.id); setEditName(wallet.name); }} className="p-2 text-neutral-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(wallet.id)} className="p-2 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
