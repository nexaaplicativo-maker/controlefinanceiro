"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Bot, Loader2, RefreshCw, Sparkles } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { supabase } from "../lib/supabase";
import { STRATEGIES, DEFAULT_STRATEGY, type ProfileInsights, type StrategyId } from "../lib/profile";
import { buildAdvisorContext } from "../lib/advisor-context";
import type { Debt } from "../lib/debt";
import { getUserId, getAccessToken } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";

/**
 * Conselheiro IA.
 *
 * Substitui o antigo FinancialPlannerModal, que tinha duas abas. A aba
 * "Calculadora" saiu: ela simulava a divisão ideal do salário, mas o dashboard
 * já mostra o real comparado com esse ideal — e pior, respondia com números
 * diferentes (reserva = salário × 6, quando o certo é custo de vida × 6).
 *
 * Duas correções em relação ao que existia:
 *   1. A estratégia enviada à IA vem do perfil salvo no banco, não de um
 *      useState local que resetava a cada abertura.
 *   2. O conselho podia ser buscado uma única vez por carga de página
 *      (`if (advice) return`), então trocar de mês nunca atualizava a análise.
 *      Agora ele é reemitido quando o mês muda, e há um botão de refazer.
 */
export function AdvisorModal({
  isOpen,
  onClose,
  currentIncome,
  currentExpense,
  balance,
  transactions,
  insights,
  strategyId,
  allTransactions,
  debts,
  activeMonth,
  activeYear,
  incomeType,
  periodKey,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentIncome: number;
  currentExpense: number;
  balance: number;
  transactions: any[];
  insights: ProfileInsights;
  strategyId?: StrategyId | null;
  allTransactions: any[];
  debts: Debt[];
  activeMonth: number;
  activeYear: number;
  incomeType?: string | null;
  /** Muda quando o usuário troca de mês — invalida o conselho em cache. */
  periodKey: string;
}) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [advice, setAdvice] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);

  // Guarda síncrona: o StrictMode monta o efeito duas vezes em dev, e
  // setIsFetching não é imediato o bastante para barrar a segunda chamada.
  const inFlight = useRef(false);

  const strategy = STRATEGIES[strategyId ?? DEFAULT_STRATEGY] ?? STRATEGIES[DEFAULT_STRATEGY];

  const fetchAdvice = async (force = false) => {
    if (inFlight.current) return;
    if (!force && fetchedFor === periodKey && advice) return;

    inFlight.current = true;
    setIsFetching(true);
    try {
      const token = await getAccessToken() ?? '';

      // Conselho do mês anterior: é o que permite ao advisor cobrar o que foi
      // combinado em vez de começar do zero toda vez.
      const uid = await getUserId();
      let previousAdvice: { period: string; advice: string } | null = null;
      if (uid) {
        const { data } = await supabase
          .from('advice_history')
          .select('period, advice')
          .eq('user_id', uid)
          .lt('period', periodKeyToPeriod(periodKey))
          .order('period', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) previousAdvice = data as { period: string; advice: string };
      }

      const context = buildAdvisorContext({
        insights,
        allTransactions,
        monthTransactions: transactions,
        debts,
        reserveAmount: insights.reserveAmount,
        activeMonth,
        activeYear,
        strategyId,
        incomeType,
        previousAdvice,
      });

      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ context }),
      });

      const data = await res.json();
      setAdvice(data.advice || data.error || "Ocorreu um erro ao gerar seu conselho.");
      setFetchedFor(periodKey);
    } catch {
      setAdvice("Não foi possível conectar com a IA no momento.");
    } finally {
      inFlight.current = false;
      setIsFetching(false);
    }
  };

  // Busca ao abrir, e rebusca se o mês mudou desde a última análise.
  useEffect(() => {
    if (isOpen && fetchedFor !== periodKey) void fetchAdvice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, periodKey]);

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
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-brand/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-center mb-5 shrink-0 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand/10 border border-brand/20 rounded-inner">
                  <Bot className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink leading-tight">Conselheiro IA</h2>
                  <p className="text-xs text-ink-3">{strategy.name} · {insights.stage.label}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fetchAdvice(true)}
                  disabled={isFetching}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink disabled:opacity-40 cursor-pointer"
                  title="Gerar novo conselho"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto pr-1 flex-1 relative z-10">
              {isFetching ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-9 h-9 text-brand animate-spin mb-4" />
                  <p className="text-ink-2 font-medium text-sm">Analisando suas finanças...</p>
                  <p className="text-ink-3 text-xs mt-1">Isso leva alguns segundos</p>
                </div>
              ) : advice ? (
                <div className="prose prose-invert prose-sm prose-p:text-ink-2 prose-li:text-ink-2 prose-strong:text-brand prose-headings:text-ink bg-white/5 border border-white/10 rounded-inner p-5">
                  <ReactMarkdown>{advice}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="w-8 h-8 text-ink-3 mb-3" />
                  <p className="text-ink-3 text-sm">Nenhum conselho ainda.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * periodKey chega como "2026-9" (mês base zero, vindo do dashboard).
 * O banco grava a competência como "2026-10". Esta conversão evita comparar
 * strings de formatos diferentes ao buscar o conselho do mês anterior.
 */
function periodKeyToPeriod(key: string): string {
  const [year, monthIndex] = key.split('-').map(Number);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}
