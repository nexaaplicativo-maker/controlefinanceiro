"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, SlidersHorizontal, Loader2, Check, TrendingUp, Briefcase, CreditCard, Target } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { STRATEGIES, DEFAULT_STRATEGY, type FinancialProfile, type IncomeType, type MainGoal, type StrategyId } from "../lib/profile";
import { useModalA11y } from "../hooks/use-modal-a11y";

/**
 * Edição do perfil financeiro depois do onboarding.
 *
 * Até aqui as respostas do onboarding eram gravadas uma vez e não havia tela
 * nenhuma para mudá-las: errar "tenho dívida" significava rodar UPDATE no SQL
 * Editor do Supabase. Como essas respostas definem os limites de alerta, as
 * metas de reserva e o bloqueio de aporte em Modo Emergência, ficar preso numa
 * resposta errada desregula o app inteiro.
 *
 * Aqui a estratégia é escolhida direto, e não derivada do objetivo como no
 * onboarding — quem já usa o app sabe o que quer ajustar.
 */
export function ProfileSettingsModal({
  isOpen,
  onClose,
  profile,
  userId,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile: FinancialProfile | null;
  userId: string;
  onSave?: () => void;
}) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [income, setIncome] = useState("");
  const [incomeType, setIncomeType] = useState<IncomeType | null>(null);
  const [hasDebt, setHasDebt] = useState<boolean | null>(null);
  const [mainGoal, setMainGoal] = useState<MainGoal | null>(null);
  const [strategy, setStrategy] = useState<StrategyId>(DEFAULT_STRATEGY);
  const [isSaving, setIsSaving] = useState(false);

  // Recarrega os valores atuais toda vez que abre, para não mostrar
  // um estado velho depois de uma edição anterior.
  useEffect(() => {
    if (!isOpen) return;
    setIncome(profile?.monthly_income != null ? String(profile.monthly_income) : "");
    setIncomeType(profile?.income_type ?? null);
    setHasDebt(profile?.has_debt ?? null);
    setMainGoal(profile?.main_goal ?? null);
    setStrategy(profile?.strategy ?? DEFAULT_STRATEGY);
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        monthly_income: income === "" ? null : parseFloat(income),
        income_type: incomeType,
        has_debt: hasDebt,
        main_goal: mainGoal,
        strategy,
        onboarded_at: profile?.onboarded_at ?? new Date().toISOString(),
      })
      .eq('id', userId);

    setIsSaving(false);

    if (error) {
      toast("Erro ao salvar perfil: " + error.message, "error");
      return;
    }
    toast("Perfil atualizado. Limites recalibrados. 🎯", "success");
    onSave?.();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />

        <motion.div ref={a11yRef} role="dialog" aria-modal="true"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg max-h-[88vh] sheet-panel rounded-t-card sm:rounded-card sheet-grab pb-safe sm:pb-0 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col"
        >
          <div className="absolute -top-24 -right-24 w-56 h-56 bg-brand/[0.06] rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex justify-between items-center mb-5 shrink-0 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand/10 border border-brand/20 rounded-inner">
                <SlidersHorizontal className="w-5 h-5 text-brand" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink leading-tight">Perfil financeiro</h2>
                <p className="text-xs text-ink-3">Define os limites e metas do seu painel</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto pr-1 flex-1 flex flex-col gap-6 relative z-10">

            <Field icon={<TrendingUp className="w-4 h-4 text-pos" />} label="Renda mensal" hint="Usada como referência enquanto não houver receitas lançadas.">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 text-sm">R$</span>
                <input
                  type="number"
                  value={income}
                  onChange={e => setIncome(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-black/30 border border-white/10 rounded-field py-3 pl-12 pr-4 text-ink font-semibold placeholder:text-ink-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>
            </Field>

            <Field icon={<Briefcase className="w-4 h-4 text-ink-2" />} label="Tipo de renda" hint="Renda variável exige o dobro de reserva.">
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={incomeType === 'fixa'} onClick={() => setIncomeType('fixa')} label="Fixa" />
                <Choice selected={incomeType === 'variavel'} onClick={() => setIncomeType('variavel')} label="Variável" />
              </div>
            </Field>

            <Field icon={<CreditCard className="w-4 h-4 text-neg" />} label="Tem dívida cara?" hint="Se sim, o app prioriza quitar antes de sugerir aporte.">
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={hasDebt === true} onClick={() => setHasDebt(true)} label="Sim, tenho" />
                <Choice selected={hasDebt === false} onClick={() => setHasDebt(false)} label="Não tenho" />
              </div>
            </Field>

            <Field icon={<Target className="w-4 h-4 text-brand" />} label="Estratégia" hint="Define o teto de consumo e quanto você deveria guardar.">
              <div className="flex flex-col gap-2">
                {Object.values(STRATEGIES).map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStrategy(s.id)}
                    className={`w-full text-left px-4 py-3 rounded-field border transition-all active:scale-[0.98] cursor-pointer flex items-start gap-3 ${
                      strategy === s.id ? 'bg-brand/15 border-brand/50' : 'bg-black/30 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${strategy === s.id ? 'bg-brand border-brand' : 'border-white/20'}`}>
                      {strategy === s.id && <Check className="w-2.5 h-2.5 text-ink" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block font-semibold text-sm ${strategy === s.id ? 'text-ink' : 'text-ink-2'}`}>{s.name}</span>
                      <span className="block text-xs text-ink-3 mt-0.5 leading-snug">{s.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Field>

            <Field icon={<Target className="w-4 h-4 text-warn" />} label="Objetivo principal" hint="Orienta o que o painel destaca.">
              <div className="grid grid-cols-2 gap-2">
                <Choice selected={mainGoal === 'quitar_dividas'} onClick={() => setMainGoal('quitar_dividas')} label="Sair das dívidas" />
                <Choice selected={mainGoal === 'reserva'} onClick={() => setMainGoal('reserva')} label="Montar reserva" />
                <Choice selected={mainGoal === 'investir'} onClick={() => setMainGoal('investir')} label="Investir" />
                <Choice selected={mainGoal === 'organizar'} onClick={() => setMainGoal('organizar')} label="Organizar" />
              </div>
            </Field>

          </div>

          <div className="pt-5 mt-1 shrink-0 relative z-10">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-brand hover:bg-brand text-ink font-bold py-3.5 rounded-field flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-brand/25 active:scale-95 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-4 h-4" /> Salvar perfil</>}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function Field({ icon, label, hint, children }: { icon: React.ReactNode; label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
      </div>
      <p className="text-xs text-ink-3 mb-3 leading-relaxed">{hint}</p>
      {children}
    </div>
  );
}

function Choice({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-field border text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${
        selected ? 'bg-brand/15 border-brand/50 text-ink' : 'bg-black/30 border-white/10 text-ink-2 hover:border-white/20 hover:text-ink-2'
      }`}
    >
      {selected && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
      {label}
    </button>
  );
}
