"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Wallet, ChevronRight, ChevronLeft, Briefcase, TrendingUp, CreditCard, Target, ShieldCheck, Loader2, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import type { IncomeType, MainGoal, StrategyId } from "../lib/profile";

/**
 * Onboarding — as 4 perguntas que calibram o app ao usuário.
 *
 * Antes isto era só 3 slides de marketing com um flag em localStorage. O flag
 * era por navegador: trocar de celular fazia o "onboarding" reaparecer, e nada
 * do que o usuário via era gravado.
 *
 * Agora as respostas vão para public.profiles e alimentam o lib/profile.ts,
 * que define os limites de alerta e as metas de reserva DESTE usuário.
 * O controle de "já respondeu" é onboarded_at no banco — segue a conta, não o
 * aparelho.
 */

/** O objetivo declarado define a estratégia inicial, sem virar uma 5ª pergunta. */
const GOAL_TO_STRATEGY: Record<MainGoal, StrategyId> = {
  quitar_dividas: '80_20',   // simplista: o que importa é sobrar para quitar
  reserva:        '50_30_20',
  organizar:      '50_30_20',
  investir:       '40_20_40', // FIRE
};

export function WelcomeModal({
  isOpen,
  userId,
  suggestedIncome,
  onComplete,
}: {
  isOpen: boolean;
  userId: string;
  suggestedIncome?: number;
  onComplete?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const [income, setIncome] = useState(suggestedIncome && suggestedIncome > 0 ? String(suggestedIncome) : "");
  const [incomeType, setIncomeType] = useState<IncomeType | null>(null);
  const [hasDebt, setHasDebt] = useState<boolean | null>(null);
  const [mainGoal, setMainGoal] = useState<MainGoal | null>(null);

  if (!isOpen) return null;

  const TOTAL_STEPS = 5; // boas-vindas + 4 perguntas

  const canAdvance =
    step === 0 ? true :
    step === 1 ? parseFloat(income) >= 0 && income !== "" :
    step === 2 ? incomeType !== null :
    step === 3 ? hasDebt !== null :
    step === 4 ? mainGoal !== null :
    false;

  const handleFinish = async () => {
    if (!userId || !mainGoal) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        monthly_income: parseFloat(income) || 0,
        income_type: incomeType,
        has_debt: hasDebt,
        main_goal: mainGoal,
        strategy: GOAL_TO_STRATEGY[mainGoal],
        onboarded_at: new Date().toISOString(),
      })
      .eq('id', userId);

    setIsSaving(false);

    if (error) {
      toast("Não consegui salvar seu perfil: " + error.message, "error");
      return;
    }

    toast("Perfil calibrado! O Nexa agora fala a sua língua. 🎯", "success");
    onComplete?.();
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
    else handleFinish();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: "spring", bounce: 0.4 }}
          className="relative w-full max-w-sm sheet-panel rounded-t-card sm:rounded-card sheet-grab pb-safe sm:pb-0 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col"
        >
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-brand/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-brand/20 rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10 w-full">
            <AnimatePresence mode="wait">

              {step === 0 && (
                <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-brand to-brand rounded-inner flex items-center justify-center shadow-lg shadow-brand/30 mb-6">
                    <Wallet className="w-8 h-8 text-ink" />
                  </div>
                  <h2 className="text-2xl font-bold text-ink mb-2">Bem-vindo ao Nexa</h2>
                  <p className="text-ink-2 text-sm leading-relaxed">
                    Quatro perguntas rápidas e o app passa a trabalhar com os seus números — não com uma média genérica.
                  </p>
                </motion.div>
              )}

              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col">
                  <StepHeader icon={<TrendingUp className="w-6 h-6 text-pos" />} title="Quanto você ganha por mês?" subtitle="Some tudo que entra. Dá para ajustar depois." />
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3 font-medium">R$</span>
                    <input
                      type="number"
                      autoFocus
                      value={income}
                      onChange={e => setIncome(e.target.value)}
                      placeholder="3000"
                      className="w-full bg-black/50 border border-white/10 rounded-field py-3.5 pl-12 pr-4 text-ink text-lg font-semibold placeholder:text-ink-3 focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>
                  {suggestedIncome && suggestedIncome > 0 && (
                    <p className="text-xs text-ink-3 mt-2.5 leading-relaxed">
                      Calculamos R$ {suggestedIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} a partir dos seus lançamentos. Corrija se não bater.
                    </p>
                  )}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col">
                  <StepHeader icon={<Briefcase className="w-6 h-6 text-ink-2" />} title="Essa renda é previsível?" subtitle="Renda instável exige uma reserva maior." />
                  <div className="flex flex-col gap-2.5 mt-2">
                    <ChoiceButton selected={incomeType === 'fixa'} onClick={() => setIncomeType('fixa')} title="Fixa" description="CLT, aposentadoria, aluguel — cai todo mês igual" />
                    <ChoiceButton selected={incomeType === 'variavel'} onClick={() => setIncomeType('variavel')} title="Variável" description="Autônomo, comissão, vendas — muda todo mês" />
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col">
                  <StepHeader icon={<CreditCard className="w-6 h-6 text-neg" />} title="Tem dívida cara rolando?" subtitle="Rotativo do cartão, cheque especial ou empréstimo." />
                  <div className="flex flex-col gap-2.5 mt-2">
                    <ChoiceButton selected={hasDebt === true} onClick={() => setHasDebt(true)} title="Sim, tenho" description="O app vai priorizar quitar antes de sugerir investir" />
                    <ChoiceButton selected={hasDebt === false} onClick={() => setHasDebt(false)} title="Não tenho" description="Estou em dia com o cartão e sem empréstimo" />
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col">
                  <StepHeader icon={<Target className="w-6 h-6 text-brand" />} title="O que você quer primeiro?" subtitle="Isso define o que o Nexa vai cobrar de você." />
                  <div className="flex flex-col gap-2.5 mt-2">
                    <ChoiceButton selected={mainGoal === 'quitar_dividas'} onClick={() => setMainGoal('quitar_dividas')} title="Sair das dívidas" icon={<CreditCard className="w-4 h-4" />} />
                    <ChoiceButton selected={mainGoal === 'reserva'} onClick={() => setMainGoal('reserva')} title="Montar minha reserva" icon={<ShieldCheck className="w-4 h-4" />} />
                    <ChoiceButton selected={mainGoal === 'investir'} onClick={() => setMainGoal('investir')} title="Investir e crescer patrimônio" icon={<TrendingUp className="w-4 h-4" />} />
                    <ChoiceButton selected={mainGoal === 'organizar'} onClick={() => setMainGoal('organizar')} title="Só organizar minha vida" icon={<Sparkles className="w-4 h-4" />} />
                  </div>
                </motion.div>
              )}

            </AnimatePresence>

            {/* Indicador de progresso */}
            <div className="flex gap-1.5 justify-center mt-8 mb-5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-brand' : i < step ? 'w-2 bg-brand/40' : 'w-2 bg-white/20'}`}></div>
              ))}
            </div>

            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep(s => s - 1)}
                  disabled={isSaving}
                  className="px-4 bg-white/5 hover:bg-white/10 text-ink-2 hover:text-ink rounded-field transition-colors disabled:opacity-40 cursor-pointer"
                  aria-label="Voltar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!canAdvance || isSaving}
                className="flex-1 bg-brand text-canvas font-bold py-3.5 rounded-field transition-all shadow-lg hover:bg-brand-strong active:scale-95 flex justify-center items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <>
                    {step === 0 ? "Começar" : step === TOTAL_STEPS - 1 ? "Concluir" : "Avançar"}
                    {step === TOTAL_STEPS - 1 ? <Check className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function StepHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="mb-5">
      <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-inner flex items-center justify-center mb-4">{icon}</div>
      <h2 className="text-xl font-bold text-ink mb-1.5 leading-snug">{title}</h2>
      <p className="text-ink-2 text-xs leading-relaxed">{subtitle}</p>
    </div>
  );
}

function ChoiceButton({ selected, onClick, title, description, icon }: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-field border transition-all active:scale-[0.98] cursor-pointer flex items-center gap-3 ${
        selected
          ? 'bg-brand/15 border-brand/50 text-ink'
          : 'bg-black/30 border-white/10 text-ink-2 hover:border-white/20 hover:bg-white/5'
      }`}
    >
      {icon && <span className={selected ? 'text-brand' : 'text-ink-3'}>{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-sm">{title}</span>
        {description && <span className="block text-xs text-ink-3 mt-0.5 leading-snug">{description}</span>}
      </span>
      <span className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center ${selected ? 'bg-brand border-brand' : 'border-white/20'}`}>
        {selected && <Check className="w-2.5 h-2.5 text-ink" strokeWidth={3} />}
      </span>
    </button>
  );
}
