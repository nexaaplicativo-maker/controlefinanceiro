"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, Check, Lock, Route } from "lucide-react";
import { getStageLadder, type ProfileInsights } from "../lib/profile";
import { formatMoney as fmtMoney } from "../lib/format";
import { useModalA11y } from "../hooks/use-modal-a11y";

/**
 * Mapa dos 5 estágios financeiros.
 *
 * A faixa do dashboard mostrava "Estágio 1/5" e mais nada — o usuário via um
 * número que parecia nota baixa, sem saber quais eram os outros quatro degraus
 * nem quanto faltava para o próximo. Aqui a escada aparece inteira, com o
 * critério de cada degrau calculado sobre os números reais da pessoa.
 */

const ACCENT_DOT: Record<string, string> = {
  rose: 'bg-neg', amber: 'bg-warn', blue: 'bg-brand',
  indigo: 'bg-brand', emerald: 'bg-pos',
};

const ACCENT_TEXT: Record<string, string> = {
  rose: 'text-neg', amber: 'text-warn', blue: 'text-ink-2',
  indigo: 'text-brand', emerald: 'text-pos',
};

const ACCENT_PANEL: Record<string, string> = {
  rose: 'bg-neg/5 border-neg/30', amber: 'bg-warn/5 border-warn/30',
  blue: 'bg-white/5 border-white/30', indigo: 'bg-brand/5 border-brand/30',
  emerald: 'bg-pos/5 border-pos/30',
};

export function StageRoadmapModal({
  isOpen,
  onClose,
  insights,
  showValues = true,
  onEditProfile,
}: {
  isOpen: boolean;
  onClose: () => void;
  insights: ProfileInsights;
  showValues?: boolean;
  onEditProfile?: () => void;
}) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const formatMoney = (val: number) => fmtMoney(val, showValues);
  const ladder = getStageLadder(insights);


  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
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
                  <Route className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink leading-tight">Sua jornada financeira</h2>
                  <p className="text-xs text-ink-3">Onde você está e o que vem depois</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1 relative z-10">
              <div className="relative">
                {/* Trilho vertical que conecta os degraus */}
                <div className="absolute left-[15px] top-4 bottom-4 w-px bg-white/10" />

                <div className="flex flex-col gap-3">
                  {ladder.map(step => {
                    const { stage, status, goal, remaining, target } = step;
                    const isCurrent = status === 'current';
                    const isDone = status === 'done';

                    return (
                      <div key={stage.id} className="flex gap-4 relative">
                        {/* Marcador */}
                        <div className="shrink-0 relative z-10 pt-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            isDone
                              ? `${ACCENT_DOT[stage.accent]} border-transparent`
                              : isCurrent
                                ? `bg-surface ${stage.accent === 'rose' ? 'border-neg' : stage.accent === 'amber' ? 'border-warn' : stage.accent === 'blue' ? 'border-brand' : stage.accent === 'indigo' ? 'border-brand' : 'border-pos'}`
                                : 'bg-surface border-white/10'
                          }`}>
                            {isDone ? (
                              <Check className="w-4 h-4 text-ink" strokeWidth={3} />
                            ) : isCurrent ? (
                              <span className={`text-xs font-bold ${ACCENT_TEXT[stage.accent]}`}>{stage.level}</span>
                            ) : (
                              <Lock className="w-3 h-3 text-ink-3" />
                            )}
                          </div>
                        </div>

                        {/* Conteúdo */}
                        <div className={`flex-1 min-w-0 rounded-inner border p-4 transition-colors ${
                          isCurrent ? ACCENT_PANEL[stage.accent] : 'bg-white/[0.02] border-white/5'
                        }`}>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className={`font-bold text-sm ${isCurrent ? 'text-ink' : isDone ? 'text-ink-2' : 'text-ink-3'}`}>
                              {stage.label}
                            </h3>
                            {isCurrent && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ACCENT_TEXT[stage.accent]} bg-white/5`}>
                                Você está aqui
                              </span>
                            )}
                            {isDone && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full text-pos bg-pos/10">
                                Concluído
                              </span>
                            )}
                          </div>

                          <p className={`text-xs leading-relaxed ${isCurrent ? 'text-ink-2' : 'text-ink-3'}`}>
                            {goal}
                          </p>

                          {/* Quanto falta — só quando o critério é financeiro e ainda não foi batido */}
                          {!isDone && target !== null && remaining !== null && remaining > 0 && (
                            <div className="mt-3 pt-3 border-t border-white/5 flex items-baseline justify-between gap-2">
                              <span className="text-xs text-ink-3 font-semibold">Faltam</span>
                              <span className={`text-sm font-bold ${isCurrent ? ACCENT_TEXT[stage.accent] : 'text-ink-2'}`}>
                                {formatMoney(remaining)}
                              </span>
                            </div>
                          )}

                          {isCurrent && (
                            <div className="mt-3 pt-3 border-t border-white/5">
                              <p className="text-xs text-ink-3 font-semibold mb-1">Sua prioridade agora</p>
                              <p className="text-xs text-ink-2 leading-relaxed">{stage.priority}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {insights.monthlyCost <= 0 && (
                <p className="text-xs text-ink-3 leading-relaxed mt-5 text-center">
                  Lance algumas despesas para o Nexa calcular seu custo de vida — é ele que define os valores de cada degrau.
                </p>
              )}

              {/* O estágio sai das respostas do perfil. Se ele parecer errado,
                  o caminho para corrigir precisa estar aqui, não no SQL. */}
              {onEditProfile && (
                <div className="mt-6 pt-4 border-t border-white/5 text-center">
                  <p className="text-xs text-ink-3 mb-2">Esse não é o seu caso?</p>
                  <button
                    onClick={onEditProfile}
                    className="text-xs text-brand hover:text-brand font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    Ajustar meu perfil financeiro
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
