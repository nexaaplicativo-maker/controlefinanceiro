"use client";

import { useMemo } from "react";

import { motion, AnimatePresence } from "motion/react";
import { X, PieChart, AlertTriangle, Repeat, Coins, TrendingUp, TrendingDown } from "lucide-react";
import { formatMoney as fmtMoney } from "../lib/format";
import {
  breakdownByCategory, detectAnomalies, detectRecurring, detectInvisibleSpending,
  type Tx,
} from "../lib/insights-gastos";
import { useModalA11y } from "../hooks/use-modal-a11y";

/**
 * Raio-x do mês: para onde o dinheiro está indo.
 *
 * O app mostrava o número do mês sem nenhum contexto histórico. Aqui cada
 * categoria vem comparada com a mediana DO PRÓPRIO usuário — o que torna
 * "R$ 800 em variáveis" uma informação útil em vez de um número solto.
 */
export function SpendingInsightsModal({
  isOpen,
  onClose,
  monthTransactions,
  allTransactions,
  activeMonth,
  activeYear,
  income,
  showValues = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  monthTransactions: Tx[];
  allTransactions: Tx[];
  activeMonth: number;
  activeYear: number;
  income: number;
  showValues?: boolean;
}) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const formatMoney = (v: number) => fmtMoney(v, showValues);
  const currentMonth = `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}`;

  /**
   * Só calcula com o modal aberto.
   *
   * Sem este useMemo, as quatro análises rodavam no corpo do componente a
   * CADA render do dashboard — incluindo a cada tecla digitada na busca —
   * mesmo com o modal fechado, porque o `{isOpen && ...}` esconde a
   * renderização, não a execução. `detectRecurring` percorre o histórico
   * inteiro e agrupa por título: é a mais cara de todas.
   *
   * Durante a animação de saída o AnimatePresence reaproveita o resultado
   * anterior, então devolver null com o modal fechado é seguro.
   */
  const data = useMemo(() => {
    if (!isOpen) return null;
    const breakdown = breakdownByCategory({ monthTransactions, allTransactions, currentMonth, income });
    const recurring = detectRecurring(allTransactions);
    return {
      breakdown,
      anomalies: detectAnomalies(breakdown),
      recurring,
      invisible: detectInvisibleSpending(monthTransactions),
      recurringMonthly: recurring.reduce((a, r) => a + r.monthlyAmount, 0),
      totalGasto: breakdown.reduce((a, b) => a + b.amount, 0),
      semHistorico: breakdown.every(b => b.variationPercent === null),
    };
  }, [isOpen, monthTransactions, allTransactions, currentMonth, income]);

  const breakdown = data?.breakdown ?? [];
  const anomalies = data?.anomalies ?? [];
  const recurring = data?.recurring ?? [];
  const invisible = data?.invisible ?? { count: 0, total: 0, averageTicket: 0, topCategory: null };
  const recurringMonthly = data?.recurringMonthly ?? 0;
  const totalGasto = data?.totalGasto ?? 0;
  const semHistorico = data?.semHistorico ?? true;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          <motion.div ref={a11yRef} role="dialog" aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[88vh] sheet-panel rounded-t-card sm:rounded-card sheet-grab pb-safe sm:pb-0 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col"
          >
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-warn/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-center mb-5 shrink-0 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-warn/10 border border-warn/20 rounded-inner">
                  <PieChart className="w-5 h-5 text-warn" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink leading-tight">Para onde vai seu dinheiro</h2>
                  <p className="text-xs text-ink-3">Comparado com o seu próprio normal</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1 relative z-10 flex flex-col gap-5">

              {totalGasto === 0 ? (
                <div className="text-center py-10 px-4">
                  <PieChart className="w-8 h-8 text-ink-3 mx-auto mb-3" />
                  <p className="text-sm text-ink-2 mb-2">Nenhum gasto neste mês ainda.</p>
                  <p className="text-xs text-ink-3 leading-relaxed max-w-sm mx-auto">
                    Lance suas despesas para o Nexa comparar com os meses anteriores e apontar o que fugiu do padrão.
                  </p>
                </div>
              ) : (
                <>
                  {/* Anomalias primeiro: é o que exige ação */}
                  {anomalies.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold text-ink mb-2.5 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-warn" /> Fugiu do padrão
                      </h3>
                      <div className="flex flex-col gap-2">
                        {anomalies.map(a => (
                          <div key={a.category} className={`rounded-inner border p-3.5 ${a.severity === 'alta' ? 'bg-neg/5 border-neg/20' : 'bg-warn/5 border-warn/20'}`}>
                            <div className="flex items-start gap-2.5">
                              <TrendingUp className={`w-4 h-4 shrink-0 mt-0.5 ${a.severity === 'alta' ? 'text-neg' : 'text-warn'}`} />
                              <div className="min-w-0">
                                <p className="text-xs text-ink-2 leading-relaxed">{a.message}</p>
                                <p className="text-xs text-ink-3 mt-1">
                                  {formatMoney(a.amount)} este mês · seu normal é {formatMoney(a.median)}
                                  <span className={`ml-1.5 font-semibold ${a.severity === 'alta' ? 'text-neg' : 'text-warn'}`}>
                                    +{a.variationPercent.toFixed(0)}%
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Raio-x por categoria */}
                  <section>
                    <h3 className="text-sm font-semibold text-ink mb-2.5">Por categoria</h3>
                    {semHistorico && (
                      <p className="text-xs text-ink-3 mb-3 leading-relaxed">
                        Ainda não há meses anteriores para comparar. A partir do segundo mês de uso, cada categoria mostra se está acima ou abaixo do seu normal.
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      {breakdown.map(b => {
                        const subiu = (b.variationPercent ?? 0) > 0;
                        return (
                          <div key={b.category} className="bg-white/5 border border-white/5 rounded-inner p-3.5">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <span className="text-sm font-medium text-ink truncate">{b.category}</span>
                              <span className="text-sm font-bold text-ink whitespace-nowrap">{formatMoney(b.amount)}</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mb-2">
                              <div
                                className="h-full bg-gradient-to-r from-warn to-warn/60 rounded-full"
                                style={{ width: `${Math.min(100, b.percentOfIncome)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-ink-3">{b.percentOfIncome.toFixed(0)}% da renda</span>
                              {b.variationPercent === null ? (
                                <span className="text-ink-3">sem histórico</span>
                              ) : (
                                <span className={`flex items-center gap-1 font-semibold ${subiu ? 'text-neg' : 'text-pos'}`}>
                                  {subiu ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                  {subiu ? '+' : ''}{b.variationPercent.toFixed(0)}% vs. normal
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Recorrências */}
                  {recurring.length > 0 && (
                    <section>
                      <h3 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-ink-2" /> Se repete todo mês
                      </h3>
                      <p className="text-xs text-ink-3 mb-2.5">
                        {formatMoney(recurringMonthly)} por mês · <strong className="text-ink-2">{formatMoney(recurringMonthly * 12)} por ano</strong>
                      </p>
                      <div className="flex flex-col gap-2">
                        {recurring.slice(0, 8).map(r => (
                          <div key={r.pattern} className="flex items-center justify-between gap-3 bg-white/5 border border-white/5 rounded-field p-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-ink truncate">{r.displayName}</p>
                              <p className="text-xs text-ink-3">
                                {r.occurrences}x em {r.monthsSpan} {r.monthsSpan === 1 ? 'mês' : 'meses'} · {r.category}
                                {r.confidence < 0.7 && <span className="text-ink-3"> · possível</span>}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-ink whitespace-nowrap">{formatMoney(r.monthlyAmount)}</p>
                              <p className="text-xs text-ink-3 whitespace-nowrap">{formatMoney(r.yearlyAmount)}/ano</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Gastos invisíveis */}
                  {invisible.count >= 3 && (
                    <section className="bg-white/5 border border-white/10 rounded-inner p-4">
                      <h3 className="text-sm font-semibold text-ink mb-1.5 flex items-center gap-2">
                        <Coins className="w-4 h-4 text-brand" /> Gastos invisíveis
                      </h3>
                      <p className="text-xs text-ink-2 leading-relaxed">
                        <strong className="text-ink">{invisible.count} gastos pequenos</strong> somaram <strong className="text-brand">{formatMoney(invisible.total)}</strong> este mês,
                        com ticket médio de {formatMoney(invisible.averageTicket)}
                        {invisible.topCategory && <> — a maior parte em {invisible.topCategory}</>}.
                        Cada um parece pouco; juntos, não.
                      </p>
                    </section>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
