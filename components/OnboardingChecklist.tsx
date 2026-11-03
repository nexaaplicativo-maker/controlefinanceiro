"use client";

import { motion, AnimatePresence } from "motion/react";
import { Check, ArrowRight, Rocket } from "lucide-react";
import { getOnboardingState, type StepId } from "../lib/onboarding";

/**
 * Primeiros passos no dashboard.
 *
 * Conta nova via zeros em todas as telas, não entendia o que fazer e fechava.
 * Esta lista dá o caminho: renda → contas fixas → dívidas → diagnóstico.
 *
 * Some sozinha quando os quatro passos estão cumpridos — nada de "não mostrar
 * novamente", porque o estado vem dos dados e se resolve sozinho.
 */
export function OnboardingChecklist({
  transactions,
  hasDebtsRegistered,
  declaredNoDebt,
  onAction,
  onSecondaryAction,
}: {
  transactions: Array<{ type?: string; category?: string }>;
  hasDebtsRegistered: boolean;
  declaredNoDebt: boolean;
  onAction: (step: StepId) => void;
  onSecondaryAction: (step: StepId) => void;
}) {
  const state = getOnboardingState({ transactions, hasDebtsRegistered, declaredNoDebt });

  if (state.complete) return null;

  const progresso = (state.completedCount / state.total) * 100;

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      aria-label="Primeiros passos"
      className="mb-6 bg-gradient-to-br from-brand/10 to-brand/5 border border-brand/20 rounded-card p-5 md:p-6 relative overflow-hidden"
    >
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand/[0.06] rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-brand/15 border border-brand/25 rounded-inner flex items-center justify-center shrink-0">
              <Rocket className="w-5 h-5 text-brand" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-ink text-base leading-tight">Vamos começar</h2>
              <p className="text-xs text-ink-2 mt-0.5">
                {state.completedCount} de {state.total} passos — leva uns 3 minutos
              </p>
            </div>
          </div>

          <span className="text-sm font-bold text-brand shrink-0 tabular-nums">
            {Math.round(progresso)}%
          </span>
        </div>

        <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden mb-5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progresso}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-brand to-brand rounded-full"
          />
        </div>

        <div className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {state.steps.map(step => {
              const atual = state.currentStep?.id === step.id;

              return (
                <motion.div
                  key={step.id}
                  layout
                  className={`flex items-start gap-3 rounded-inner border p-3.5 transition-colors ${
                    step.done
                      ? 'bg-pos/5 border-pos/15'
                      : atual
                        ? 'bg-white/5 border-brand/30'
                        : 'bg-white/5 border-white/5'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                    step.done ? 'bg-pos border-pos' : atual ? 'border-brand' : 'border-white/15'
                  }`}>
                    {step.done && <Check className="w-3 h-3 text-ink" strokeWidth={3} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold leading-snug ${
                      step.done ? 'text-ink-2 line-through' : 'text-ink'
                    }`}>
                      {step.title}
                    </p>

                    {/* A descrição só aparece no passo atual: mostrar todas de
                        uma vez transforma o guia num muro de texto. */}
                    {atual && (
                      <>
                        <p className="text-xs text-ink-2 mt-1 leading-relaxed">{step.description}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <button
                            onClick={() => onAction(step.id)}
                            className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand text-ink text-xs font-bold px-4 py-2.5 rounded-field transition-colors cursor-pointer"
                          >
                            {step.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
                          </button>

                          {step.secondaryLabel && (
                            <button
                              onClick={() => onSecondaryAction(step.id)}
                              className="text-xs font-semibold text-ink-2 hover:text-ink px-3 py-2.5 rounded-field hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              {step.secondaryLabel}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.section>
  );
}
