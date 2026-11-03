"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, LogOut, Shield, User, Lock, Check, Settings, Tag, Download, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { confirmDialog } from "./ConfirmDialog";
import { getUserId } from "../lib/session";
import { exportAllDataAsJson, exportTransactionsAsCsv, baixarArquivo } from "../lib/export-data";
import { AccountManagerModal } from "./AccountManagerModal";
import { CategoryManagerModal } from "./CategoryManagerModal";
import { useModalA11y } from "../hooks/use-modal-a11y";

export function ProfileModal({ isOpen, onClose, userEmail, userRole }: { isOpen: boolean, onClose: () => void, userEmail: string, userRole: string }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [newPassword, setNewPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast("A senha deve ter pelo menos 6 caracteres.", "warning");
      return;
    }
    setIsUpdating(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsUpdating(false);
    if (error) {
      toast("Erro ao atualizar senha: " + error.message, "error");
    } else {
      toast("Senha atualizada com sucesso! 🔒", "success");
      setNewPassword("");
    }
  };

  const handleLGPDDelete = async () => {
    const ok = await confirmDialog({
      title: 'Excluir sua conta?',
      message: 'Todos os seus lançamentos, dívidas, metas e comprovantes serão apagados dos nossos servidores.\n\nIsto é irreversível. Considere exportar seus dados antes.',
      confirmLabel: 'Excluir tudo',
      danger: true,
    });
    if (!ok) return;

    const { error } = await supabase.rpc('delete_user');
    if (error) {
      toast("Erro ao excluir conta. Certifique-se de ter rodado o script SQL.", "error");
    } else {
      toast("Sua conta e seus dados foram excluídos com sucesso.", "success");
      handleLogout();
    }
  };

  /**
   * Portabilidade (LGPD). A política de privacidade promete que o usuário pode
   * levar os dados embora — promessa em política que o produto não cumpre é
   * pior que não prometer.
   */
  const handleExport = async (formato: 'json' | 'csv') => {
    setIsExporting(formato);
    try {
      const uid = await getUserId();
      if (!uid) { toast("Sessão expirada.", "error"); return; }

      const arquivo = formato === 'json'
        ? await exportAllDataAsJson(uid)
        : await exportTransactionsAsCsv(uid);

      baixarArquivo(arquivo);
      toast("Download iniciado.", "success");
    } catch (e: any) {
      toast("Erro ao exportar: " + e.message, "error");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
          
          <motion.div ref={a11yRef} role="dialog" aria-modal="true" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="relative w-full max-w-sm h-full bg-surface border-l border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.65)] p-6 pt-safe pb-safe flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl font-bold text-ink flex items-center gap-2">Meu Perfil</h2>
              <button onClick={onClose} aria-label="Fechar" className="p-2 text-ink-2 hover:text-ink bg-white/5 rounded-full"><X className="w-4 h-4" /></button>
            </div>

            {/* Miolo rolavel: antes tudo ficava no mesmo flex column com
                overflow-y-auto, e sem shrink-0 o flexbox COMPRIMIA os blocos
                de cima em vez de rolar — o avatar aparecia achatado. */}
            <div className="flex-1 overflow-y-auto -mr-2 pr-2 min-h-0">

            {/* Avatar / Info */}
            <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-card p-8 mb-6 text-center relative overflow-hidden">
              {userRole === 'admin' && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand to-brand"></div>}
              
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${userRole === 'admin' ? 'bg-brand/20 text-brand border border-brand/30' : 'bg-white/5 text-ink-2'}`}>
                {userRole === 'admin' ? <Shield className="w-10 h-10" /> : <User className="w-10 h-10" />}
              </div>
              
              <h3 className="text-lg font-bold text-ink truncate w-full">{userEmail || 'Carregando...'}</h3>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full mt-3 ${userRole === 'admin' ? 'bg-brand/20 text-brand' : 'bg-pos/20 text-pos'}`}>
                {userRole === 'admin' ? 'Dono (Admin)' : 'Cliente Premium'}
              </span>
            </div>

            {/* Ações Rápidas */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => setIsAccountOpen(true)}
                className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-brand/10 border border-white/10 hover:border-brand/30 rounded-inner transition-all group"
              >
                <Settings className="w-5 h-5 text-ink-2 group-hover:text-brand transition-colors" />
                <span className="text-xs font-medium text-ink-2 group-hover:text-ink transition-colors">Contas</span>
              </button>
              <button
                onClick={() => setIsCategoryOpen(true)}
                className="flex flex-col items-center gap-2 p-4 bg-white/5 hover:bg-brand/10 border border-white/10 hover:border-brand/30 rounded-inner transition-all group"
              >
                <Tag className="w-5 h-5 text-ink-2 group-hover:text-brand transition-colors" />
                <span className="text-xs font-medium text-ink-2 group-hover:text-ink transition-colors">Categorias</span>
              </button>
            </div>

            {/* Alterar Senha */}
            <div className="bg-white/5 border border-white/10 rounded-inner p-4 mb-6 shrink-0">
              <label className="text-xs font-medium text-ink-2 mb-2 block">Alterar Senha</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nova senha..."
                    className="w-full bg-white/5 border border-white/10 rounded-field py-2 pl-9 pr-3 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                  />
                </div>
                <button onClick={handleUpdatePassword} disabled={isUpdating || !newPassword} className="bg-brand hover:bg-brand disabled:bg-brand/50 text-ink px-3 rounded-field flex items-center justify-center transition-colors">
                  <Check className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Admin Link */}
            {userRole === 'admin' && (
              <a
                href="/admin"
                className="flex items-center justify-center gap-2 w-full py-3 mb-4 bg-brand/10 hover:bg-brand/20 text-brand border border-brand/20 rounded-field font-medium text-sm transition-colors"
              >
                <Shield className="w-4 h-4" /> Painel Administrativo
              </a>
            )}

            </div>

            <div className="space-y-3 shrink-0 pt-4">
              {/* Exportação antes da exclusão, de propósito: quem vem apagar a
                  conta deveria ver primeiro que pode levar os dados. */}
              <div>
                <p className="text-xs text-ink-3 font-semibold mb-2">Seus dados</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleExport('csv')}
                    disabled={isExporting !== null}
                    className="flex items-center justify-center gap-2 text-xs font-semibold bg-white/5 hover:bg-white/10 text-ink-2 hover:text-ink py-3 rounded-field transition-colors border border-white/10 disabled:opacity-50 cursor-pointer"
                  >
                    {isExporting === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Planilha
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    disabled={isExporting !== null}
                    className="flex items-center justify-center gap-2 text-xs font-semibold bg-white/5 hover:bg-white/10 text-ink-2 hover:text-ink py-3 rounded-field transition-colors border border-white/10 disabled:opacity-50 cursor-pointer"
                  >
                    {isExporting === 'json' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Tudo (JSON)
                  </button>
                </div>
                <div className="flex gap-3 mt-2.5 justify-center">
                  <a href="/termos" target="_blank" rel="noreferrer" className="text-xs text-ink-3 hover:text-ink-2 transition-colors">Termos de uso</a>
                  <span className="text-xs text-ink-3">·</span>
                  <a href="/privacidade" target="_blank" rel="noreferrer" className="text-xs text-ink-3 hover:text-ink-2 transition-colors">Privacidade</a>
                </div>
              </div>

              <button onClick={handleLGPDDelete} className="w-full text-xs font-bold text-neg hover:text-ink bg-neg/5 hover:bg-neg py-3 rounded-field transition-colors border border-neg/10 hover:border-neg cursor-pointer">
                Excluir Minha Conta Permanentemente
              </button>
              <button onClick={handleLogout} className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-ink w-full py-4 rounded-inner font-bold transition-all">
                <LogOut className="w-5 h-5" /> Sair do Sistema
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      <AccountManagerModal isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
      <CategoryManagerModal isOpen={isCategoryOpen} onClose={() => setIsCategoryOpen(false)} />
    </>
  );
}
