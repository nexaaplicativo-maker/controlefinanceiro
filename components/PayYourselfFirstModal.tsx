"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, PiggyBank, ShieldCheck, Zap, Loader2, AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import type { ProfileInsights } from "../lib/profile";
import { formatMoney } from "../lib/format";
import { hojeEmSaoPaulo } from "../lib/data";
import { moverNaMeta } from "../lib/aporte-meta";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";

/**
 * "Pague-se Primeiro" — registra o aporte ANTES do dinheiro virar consumo.
 *
 * O aporte entra em transactions como category 'Investimentos'. Isso é
 * proposital: assim ele aparece no bloco de Investimentos do dashboard e na
 * soma de patrimônio, sem poluir o gargalo.
 *
 * Regra que vem do perfil: em Modo Emergência (dívida cara ou gastando mais do
 * que ganha) o modal NÃO sugere aporte. Guardar a 1% ao mês enquanto se paga
 * 15% de rotativo destrói patrimônio — primeiro quita, depois guarda.
 */
export function PayYourselfFirstModal({
  isOpen,
  onClose,
  onSave,
  insights,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  insights: ProfileInsights;
}) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const suggested = insights.suggestedContribution;
  const blocked = !insights.shouldSuggestContribution;

  useEffect(() => {
    if (isOpen) setAmount("");
  }, [isOpen]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);

    if (!value || value <= 0) {
      toast("Informe um valor maior que zero.", "warning");
      return;
    }

    setIsLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) {
        toast("Sessão expirada. Faça login novamente.", "error");
        return;
      }

      // A meta vem PRIMEIRO: sem ela não há `goal_id`, e gravar a transação
      // solta devolveria a contagem dupla que o F1 corrigiu.
      const { data: goal } = await supabase
        .from('goals')
        .select('id, title, current_amount')
        .eq('user_id', userId)
        .eq('title', 'Reserva de Emergência')
        .maybeSingle();

      if (!goal) {
        toast("Crie a Reserva de Emergência no painel antes de guardar aqui.", "warning");
        return;
      }

      const r = moverNaMeta({
        userId,
        goalId: goal.id,
        tituloDaMeta: goal.title,
        valor: value,
        sentido: 'guardar',
        saldoAtualDaMeta: Number(goal.current_amount ?? 0),
        data: hojeEmSaoPaulo(),
      });

      if (!r.ok) {
        toast(r.erro, "warning");
        return;
      }

      const { error } = await supabase.from('transactions').insert([r.movimento.transacao]);
      if (error) throw error;

      await supabase
        .from('goals')
        .update({ current_amount: r.movimento.novoSaldoDaMeta })
        .eq('id', goal.id);

      toast(`💪 ${formatMoney(value)} pagos a você mesmo. Esse é o dinheiro que vira patrimônio.`, "success");
      setAmount("");
      onClose();
      onSave?.();
    } catch (err: any) {
      toast("Erro ao registrar aporte: " + err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          <motion.div ref={a11yRef} role="dialog" aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg sheet-panel rounded-t-card sm:rounded-card sheet-grab pb-safe sm:pb-0 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col"
          >
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-brand/[0.06] rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-center mb-6 shrink-0 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-pos/10 border border-pos/20 rounded-inner">
                  <PiggyBank className="w-5 h-5 text-pos" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink leading-tight">Pague-se Primeiro</h2>
                  <p className="text-xs text-ink-3">Antes das contas, antes do consumo</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {blocked ? (
              /* Estágio 1 — aportar aqui seria conselho ruim. */
              <div className="relative z-10">
                <div className="bg-neg/5 border border-neg/20 rounded-inner p-5 mb-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-neg shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-ink text-sm mb-1.5">Ainda não é hora de guardar</h3>
                      <p className="text-xs text-ink-2 leading-relaxed">
                        {insights.stage.priority}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-ink-2 leading-relaxed mb-5">
                  Dívida de cartão no rotativo custa cerca de <strong className="text-neg">15% ao mês</strong>. Reserva rende perto de <strong className="text-pos">1%</strong>. Guardar antes de quitar significa perder a diferença todo mês — por isso o Nexa não vai sugerir aporte enquanto você estiver aqui.
                </p>

                <button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-ink font-semibold py-3 rounded-field transition-colors cursor-pointer">
                  Entendi, vou atacar a dívida
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5 relative z-10">
                <div className="bg-pos/5 border border-pos/20 rounded-inner p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-pos shrink-0 mt-0.5" />
                    <p className="text-xs text-ink-2 leading-relaxed">
                      Sua estratégia prevê guardar <strong className="text-ink">{(insights.suggestedSavingsRate * 100).toFixed(0)}%</strong> da renda.
                      {insights.reserveIdeal > 0 && (
                        <> Sua reserva ideal é <strong className="text-ink">{formatMoney(insights.reserveIdeal)}</strong> — {insights.reserveMonths.toFixed(1)} de {(insights.reserveIdeal / Math.max(1, insights.monthlyCost)).toFixed(0)} meses já garantidos.</>
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-ink-2 mb-2 block">Quanto você vai guardar agora?</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 font-medium">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full bg-black/30 border border-white/10 rounded-field py-3.5 pl-12 pr-4 text-ink text-lg font-semibold placeholder:text-ink-3 focus:outline-none focus:border-pos transition-colors"
                    />
                  </div>
                </div>

                {suggested > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <QuickFill label={`Sugerido · ${formatMoney(suggested)}`} icon={<Zap className="w-3 h-3" />} highlighted onClick={() => setAmount(String(suggested))} />
                    <QuickFill label={formatMoney(Math.round(suggested / 2))} onClick={() => setAmount(String(Math.round(suggested / 2)))} />
                    <QuickFill label={formatMoney(suggested * 2)} icon={<TrendingUp className="w-3 h-3" />} onClick={() => setAmount(String(suggested * 2))} />
                  </div>
                )}

                <p className="text-xs text-ink-3 leading-relaxed">
                  O aporte é registrado como <strong className="text-ink-2">Investimentos</strong> — sai do seu saldo disponível, mas continua sendo seu dinheiro.
                </p>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-pos hover:bg-pos/85 text-canvas font-bold py-3.5 rounded-field flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-pos/25 active:scale-95 cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <><PiggyBank className="w-5 h-5" /> Guardar este valor</>
                  )}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function QuickFill({ label, onClick, icon, highlighted }: { label: string; onClick: () => void; icon?: React.ReactNode; highlighted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-field border transition-colors cursor-pointer ${
        highlighted
          ? 'bg-pos/10 border-pos/30 text-pos hover:bg-pos/20'
          : 'bg-white/5 border-white/10 text-ink-2 hover:text-ink hover:bg-white/10'
      }`}
    >
      {icon}{label}
    </button>
  );
}
