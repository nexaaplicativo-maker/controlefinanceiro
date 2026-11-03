"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Plus, Trash2, Pencil, Loader2, Check, AlertTriangle,
  TrendingDown, Zap, Snowflake, Flame, CalendarClock, CheckCircle2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { getUserId } from "../lib/session";
import { toast } from "./Toast";
import { formatMoney as fmtMoney } from "../lib/format";
import {
  DEBT_KINDS, EXPENSIVE_DEBT_RATE,
  isExpensive, monthlyInterestCost, minimumViablePayment,
  simulatePayoff, compareStrategies, summarizeDebts,
  type Debt, type DebtKind,
} from "../lib/debt";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { confirmDialog } from "./ConfirmDialog";

/**
 * Módulo de Dívidas.
 *
 * Antes disto o app só sabia `has_debt: boolean` — e o Estágio 1 mandava
 * "quitar a dívida cara" sem conseguir medir, acompanhar ou planejar nada.
 *
 * Aqui a dívida vira número: quanto custa por mês só para existir, em quanto
 * tempo zera a cada ritmo de pagamento, e qual ordem de quitação sai mais
 * barata.
 */

type Tab = 'lista' | 'plano';

export function DebtsModal({
  isOpen,
  onClose,
  userId,
  showValues = true,
  monthlyBudgetHint = 0,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  showValues?: boolean;
  /** Sobra mensal estimada, usada como palpite inicial do orçamento do plano */
  monthlyBudgetHint?: number;
  onSave?: () => void;
}) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [tab, setTab] = useState<Tab>('lista');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [name, setName] = useState("");
  const [creditor, setCreditor] = useState("");
  const [kind, setKind] = useState<DebtKind>('rotativo_cartao');
  const [balance, setBalance] = useState("");
  const [ratePercent, setRatePercent] = useState("");
  const [minPayment, setMinPayment] = useState("");

  const [budget, setBudget] = useState("");
  const [simPayment, setSimPayment] = useState("");
  const [simDebtId, setSimDebtId] = useState<string>("");

  const formatMoney = (v: number) => fmtMoney(v, showValues);

  useEffect(() => {
    if (isOpen) {
      fetchDebts();
      setBudget(monthlyBudgetHint > 0 ? String(Math.round(monthlyBudgetHint)) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function fetchDebts() {
    setIsLoading(true);
    const { data } = await supabase
      .from('debts')
      .select('*')
      .eq('user_id', userId)
      .order('monthly_rate', { ascending: false });
    const rows = (data as Debt[]) ?? [];
    setDebts(rows);
    if (rows.length && !simDebtId) setSimDebtId(rows[0].id);
    setIsLoading(false);
  }

  const resetForm = () => {
    setName(""); setCreditor(""); setKind('rotativo_cartao');
    setBalance(""); setRatePercent(""); setMinPayment("");
    setEditingId(null); setIsAdding(false);
  };

  const startEdit = (d: Debt) => {
    setEditingId(d.id); setIsAdding(false);
    setName(d.name);
    setCreditor(d.creditor ?? "");
    setKind(d.kind);
    setBalance(String(d.current_balance));
    // Guardamos fração no banco e mostramos porcentagem na tela.
    setRatePercent(String(round4(d.monthly_rate * 100)));
    setMinPayment(String(d.minimum_payment));
  };

  const handleSubmit = async () => {
    const balanceNum = parseFloat(balance);
    const rateNum = parseFloat(ratePercent);
    const minNum = parseFloat(minPayment) || 0;

    if (!name.trim()) { toast("Dê um nome à dívida.", "warning"); return; }
    if (isNaN(balanceNum) || balanceNum < 0) { toast("Informe o saldo devedor.", "warning"); return; }
    if (isNaN(rateNum) || rateNum < 0) { toast("Informe a taxa de juros ao mês.", "warning"); return; }
    if (rateNum > 200) { toast("Taxa acima de 200% ao mês — confira o valor.", "warning"); return; }

    setIsSaving(true);
    const payload = {
      user_id: userId,
      name: name.trim(),
      creditor: creditor.trim() || null,
      kind,
      current_balance: balanceNum,
      monthly_rate: rateNum / 100,
      minimum_payment: minNum,
      status: 'ativa' as const,
    };

    const { error } = editingId
      ? await supabase.from('debts').update(payload).eq('id', editingId)
      : await supabase.from('debts').insert([payload]);
    setIsSaving(false);

    if (error) { toast("Erro ao salvar: " + error.message, "error"); return; }
    toast(editingId ? "Dívida atualizada." : "Dívida cadastrada.", "success");
    resetForm();
    await fetchDebts();
    onSave?.();
  };

  const handleSettle = async (d: Debt) => {
    const { error } = await supabase
      .from('debts')
      .update({ status: 'quitada', current_balance: 0 })
      .eq('id', d.id);
    if (error) { toast("Erro ao marcar como quitada.", "error"); return; }

    // Mantém profiles.has_debt coerente: sem dívida cara ativa, o booleano
    // do onboarding não pode continuar dizendo que existe uma.
    const restantes = debts.filter(x => x.id !== d.id && x.status === 'ativa' && isExpensive(x));
    if (restantes.length === 0) {
      const uid = await getUserId();
      if (uid) await supabase.from('profiles').update({ has_debt: false }).eq('id', uid);
    }

    toast(`🎉 ${d.name} quitada!`, "success");
    await fetchDebts();
    onSave?.();
  };

  const handleDelete = async (d: Debt) => {
    const ok = await confirmDialog({
      title: `Remover "${d.name}"?`,
      message: 'Isto apaga o registro e o histórico de pagamentos dela.',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('debts').delete().eq('id', d.id);
    if (error) { toast("Erro ao remover.", "error"); return; }
    setDebts(prev => prev.filter(x => x.id !== d.id));
    toast("Dívida removida.", "info");
    onSave?.();
  };

  const ativas = debts.filter(d => d.status === 'ativa');
  const summary = summarizeDebts(debts);
  const budgetNum = parseFloat(budget) || 0;
  const comparison = ativas.length > 0 && budgetNum > 0
    ? compareStrategies(ativas, budgetNum)
    : null;

  const simDebt = ativas.find(d => d.id === simDebtId) ?? ativas[0] ?? null;
  const simPaymentNum = parseFloat(simPayment) || 0;
  const sim = simDebt && simPaymentNum > 0
    ? simulatePayoff(simDebt.current_balance, simDebt.monthly_rate, simPaymentNum)
    : null;

  const showForm = isAdding || editingId !== null;

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
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-brand/[0.06] rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-center mb-5 shrink-0 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-neg/10 border border-neg/20 rounded-inner">
                  <TrendingDown className="w-5 h-5 text-neg" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink leading-tight">Minhas Dívidas</h2>
                  <p className="text-xs text-ink-3">Quanto custam e quando acabam</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumo */}
            {ativas.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 shrink-0 relative z-10">
                <Stat label="Dívida total" value={formatMoney(summary.total)} />
                <Stat
                  label="Juros por mês"
                  value={formatMoney(summary.monthlyInterest)}
                  tone="rose"
                  hint="só para existir"
                />
                <Stat label="Parcelas mínimas" value={formatMoney(summary.requiredMinimum)} />
              </div>
            )}

            {summary.expensiveCount > 0 && (
              <div className="flex items-start gap-2.5 bg-neg/5 border border-neg/20 rounded-inner p-3.5 mb-4 shrink-0 relative z-10">
                <AlertTriangle className="w-4 h-4 text-neg shrink-0 mt-0.5" />
                <p className="text-xs text-ink-2 leading-relaxed">
                  <strong className="text-neg">{formatMoney(summary.expensiveMonthlyInterest)} por mês</strong> só de juros em dívida cara.
                  {summary.mostExpensive && (
                    <> A que mais te custa é <strong className="text-ink">{summary.mostExpensive.name}</strong> ({(summary.mostExpensive.monthly_rate * 100).toFixed(1)}% a.m.) — ataque essa primeiro.</>
                  )}
                </p>
              </div>
            )}

            {/* Abas */}
            {ativas.length > 0 && (
              <div className="flex gap-2 p-1 bg-white/5 rounded-inner border border-white/10 shrink-0 mb-4 relative z-10">
                <TabButton active={tab === 'lista'} onClick={() => setTab('lista')} label="Minhas dívidas" />
                <TabButton active={tab === 'plano'} onClick={() => setTab('plano')} label="Plano de quitação" />
              </div>
            )}

            <div className="overflow-y-auto pr-1 flex-1 relative z-10">

              {tab === 'lista' && (
                <>
                  <AnimatePresence>
                    {showForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="bg-black/30 border border-white/10 rounded-inner p-4 mb-4 flex flex-col gap-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Nome">
                              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Cartão Nubank" className={inputCls} />
                            </Field>
                            <Field label="Tipo">
                              <select value={kind} onChange={e => setKind(e.target.value as DebtKind)} className={`${inputCls} cursor-pointer`}>
                                {Object.entries(DEBT_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                              </select>
                            </Field>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Field label="Saldo devedor">
                              <input type="number" step="0.01" value={balance} onChange={e => setBalance(e.target.value)} placeholder="0,00" className={inputCls} />
                            </Field>
                            <Field label="Juros % ao mês">
                              <input type="number" step="0.01" value={ratePercent} onChange={e => setRatePercent(e.target.value)} placeholder="14" className={inputCls} />
                            </Field>
                            <Field label="Parcela mínima">
                              <input type="number" step="0.01" value={minPayment} onChange={e => setMinPayment(e.target.value)} placeholder="0,00" className={inputCls} />
                            </Field>
                          </div>

                          <p className="text-xs text-ink-3 leading-relaxed">
                            A taxa é <strong className="text-ink-2">ao mês</strong>, em porcentagem. Rotativo de cartão costuma passar de 14%. Acima de {(EXPENSIVE_DEBT_RATE * 100).toFixed(0)}% a.m. o app trata como dívida cara e prioriza a quitação.
                          </p>

                          <div className="flex gap-2 pt-1">
                            <button onClick={resetForm} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-ink-2 hover:text-ink rounded-field text-sm font-semibold transition-colors cursor-pointer">Cancelar</button>
                            <button onClick={handleSubmit} disabled={isSaving} className="flex-1 bg-neg hover:bg-neg text-ink font-bold py-2.5 rounded-field text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer">
                              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {editingId ? 'Atualizar' : 'Cadastrar'}</>}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!showForm && (
                    <button onClick={() => { resetForm(); setIsAdding(true); }} className="w-full mb-4 flex items-center justify-center gap-2 bg-neg/10 hover:bg-neg/20 text-neg border border-neg/20 py-3 rounded-inner font-semibold text-sm transition-colors cursor-pointer">
                      <Plus className="w-4 h-4" /> Cadastrar dívida
                    </button>
                  )}

                  {isLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-ink-3 animate-spin" /></div>
                  ) : debts.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <CheckCircle2 className="w-8 h-8 text-pos/60 mx-auto mb-3" />
                      <p className="text-sm text-ink-2 mb-2">Nenhuma dívida cadastrada.</p>
                      <p className="text-xs text-ink-3 leading-relaxed max-w-sm mx-auto">
                        Se você tem cartão no rotativo, cheque especial ou empréstimo, cadastre aqui para o Nexa calcular quanto custa e em quanto tempo acaba.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {debts.map(d => {
                        const cara = isExpensive(d) && d.status === 'ativa';
                        const juros = monthlyInterestCost(d);
                        const quitada = d.status === 'quitada';
                        return (
                          <div key={d.id} className={`p-3.5 rounded-inner border ${quitada ? 'bg-pos/5 border-pos/15' : cara ? 'bg-neg/5 border-neg/20' : 'bg-white/5 border-white/5'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`text-sm font-semibold truncate ${quitada ? 'text-pos line-through' : 'text-ink'}`}>{d.name}</p>
                                  {cara && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-neg/15 text-neg shrink-0 flex items-center gap-1"><Flame className="w-2.5 h-2.5" /> Cara</span>}
                                  {quitada && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-pos/15 text-pos shrink-0">Quitada</span>}
                                </div>
                                <p className="text-xs text-ink-3 mt-0.5">
                                  {DEBT_KINDS[d.kind]} · {(d.monthly_rate * 100).toFixed(1)}% a.m.
                                  {d.creditor ? ` · ${d.creditor}` : ''}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-sm font-bold whitespace-nowrap ${quitada ? 'text-ink-3' : 'text-ink'}`}>{formatMoney(d.current_balance)}</p>
                                {!quitada && juros > 0 && (
                                  <p className="text-xs text-neg font-semibold whitespace-nowrap">+{formatMoney(juros)}/mês</p>
                                )}
                              </div>
                            </div>

                            {!quitada && d.minimum_payment > 0 && d.minimum_payment <= minimumViablePayment(d.current_balance, d.monthly_rate) && (
                              <p className="text-xs text-warn mt-2 flex items-start gap-1.5 leading-relaxed">
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                Pagando só a mínima ({formatMoney(d.minimum_payment)}), esta dívida nunca zera — o juro é {formatMoney(juros)}.
                              </p>
                            )}

                            <div className="flex items-center gap-1 mt-2.5 justify-end">
                              {!quitada && (
                                <button onClick={() => handleSettle(d)} aria-label="Marcar como quitada" title="Marcar como quitada" className="p-1.5 text-pos/60 hover:text-pos hover:bg-pos/10 rounded-lg transition-colors cursor-pointer">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => startEdit(d)} aria-label="Editar" title="Editar" className="p-1.5 text-brand/60 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors cursor-pointer">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(d)} aria-label="Remover" title="Remover" className="p-1.5 text-neg/50 hover:text-neg hover:bg-neg/10 rounded-lg transition-colors cursor-pointer">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {tab === 'plano' && (
                <div className="flex flex-col gap-5">

                  {/* Simulador de uma dívida */}
                  <section className="bg-white/5 border border-white/10 rounded-inner p-4">
                    <h3 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-brand" /> Quando essa dívida acaba?
                    </h3>
                    <p className="text-xs text-ink-3 mb-3">Escolha a dívida e quanto você consegue pagar por mês.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <select value={simDebtId} onChange={e => setSimDebtId(e.target.value)} className={`${inputCls} cursor-pointer`}>
                        {ativas.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-sm">R$</span>
                        <input type="number" step="0.01" value={simPayment} onChange={e => setSimPayment(e.target.value)} placeholder="por mês" className={`${inputCls} pl-9`} />
                      </div>
                    </div>

                    {simDebt && simPaymentNum > 0 && (
                      sim?.months === null ? (
                        <div className="bg-neg/10 border border-neg/25 rounded-field p-3.5">
                          <p className="text-xs text-neg font-semibold mb-1 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Nesse ritmo, a dívida nunca zera
                          </p>
                          <p className="text-xs text-ink-2 leading-relaxed">
                            O juro é {formatMoney(monthlyInterestCost(simDebt))} por mês. Pagando {formatMoney(simPaymentNum)}, você não cobre nem o juro — o saldo só cresce.
                            Para começar a reduzir, pague <strong className="text-ink">mais de {formatMoney(minimumViablePayment(simDebt.current_balance, simDebt.monthly_rate))}</strong>.
                          </p>
                        </div>
                      ) : sim ? (
                        <div className="grid grid-cols-3 gap-2">
                          <Stat label="Quita em" value={`${sim.months} ${sim.months === 1 ? 'mês' : 'meses'}`} tone="emerald" />
                          <Stat label="Em" value={sim.payoffDate!.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })} />
                          <Stat label="Juros totais" value={formatMoney(sim.totalInterest)} tone="rose" />
                        </div>
                      ) : null
                    )}
                  </section>

                  {/* Comparação de estratégias */}
                  <section className="bg-white/5 border border-white/10 rounded-inner p-4">
                    <h3 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-warn" /> Qual ordem quitar primeiro?
                    </h3>
                    <p className="text-xs text-ink-3 mb-3">
                      Quanto você consegue destinar por mês ao total das dívidas?
                      {summary.requiredMinimum > 0 && <> O mínimo exigido é {formatMoney(summary.requiredMinimum)}.</>}
                    </p>

                    <div className="relative mb-3">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-sm">R$</span>
                      <input type="number" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} placeholder="orçamento mensal" className={`${inputCls} pl-9`} />
                    </div>

                    {comparison && !comparison.avalanche.feasible && (
                      <p className="text-xs text-neg bg-neg/10 border border-neg/25 rounded-field p-3 leading-relaxed">
                        Esse valor não cobre nem as parcelas mínimas, que somam {formatMoney(comparison.avalanche.requiredMinimum)}.
                      </p>
                    )}

                    {comparison && comparison.avalanche.feasible && comparison.avalanche.months !== null && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <StrategyCard
                            icon={<Flame className="w-4 h-4" />}
                            title="Avalanche"
                            subtitle="Maior juro primeiro"
                            months={comparison.avalanche.months}
                            interest={formatMoney(comparison.avalanche.totalInterest)}
                            recommended
                          />
                          <StrategyCard
                            icon={<Snowflake className="w-4 h-4" />}
                            title="Bola de neve"
                            subtitle="Menor saldo primeiro"
                            months={comparison.snowball.months}
                            interest={Number.isFinite(comparison.snowball.totalInterest) ? formatMoney(comparison.snowball.totalInterest) : '—'}
                          />
                        </div>

                        {comparison.interestSaved > 0 ? (
                          <p className="text-xs text-ink-2 mt-3 leading-relaxed">
                            A <strong className="text-pos">avalanche economiza {formatMoney(comparison.interestSaved)}</strong> em juros
                            {comparison.monthsSaved > 0 && <> e termina {comparison.monthsSaved} {comparison.monthsSaved === 1 ? 'mês' : 'meses'} antes</>}.
                            A bola de neve quita uma dívida mais cedo e motiva mais — se você precisa ver progresso rápido para não desistir, ela é uma escolha legítima.
                          </p>
                        ) : (
                          <p className="text-xs text-ink-3 mt-3 leading-relaxed">
                            Nesta carteira as duas estratégias dão praticamente no mesmo. Escolha a que te motivar mais.
                          </p>
                        )}

                        {comparison.avalanche.payoffOrder.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-white/5">
                            <p className="text-xs text-ink-3 font-semibold mb-2">Ordem pela avalanche</p>
                            <div className="flex flex-col gap-1.5">
                              {comparison.avalanche.payoffOrder.map((s, i) => (
                                <div key={s.debtId} className="flex items-center justify-between text-xs">
                                  <span className="text-ink-2"><span className="text-ink-3 mr-1.5">{i + 1}.</span>{s.name}</span>
                                  <span className="text-ink-3">mês {s.month}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const inputCls = "w-full bg-black/40 border border-white/10 rounded-field py-2.5 px-3 text-ink text-sm placeholder:text-ink-3 focus:outline-none focus:border-neg transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-ink-3 font-semibold mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'rose' | 'emerald'; hint?: string }) {
  const color = tone === 'rose' ? 'text-neg' : tone === 'emerald' ? 'text-pos' : 'text-ink';
  return (
    <div className="bg-white/5 border border-white/10 rounded-inner p-3.5">
      <p className="text-xs text-ink-3 font-semibold mb-1">{label}</p>
      <p className={`text-base font-bold tracking-tight ${color}`}>{value}</p>
      {hint && <p className="text-xs text-ink-3 mt-0.5">{hint}</p>}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={`flex-1 py-2 rounded-field text-sm font-medium transition-colors cursor-pointer ${active ? 'bg-neg/20 text-neg border border-neg/30' : 'text-ink-2 hover:text-ink'}`}>
      {label}
    </button>
  );
}

function StrategyCard({ icon, title, subtitle, months, interest, recommended }: {
  icon: React.ReactNode; title: string; subtitle: string;
  months: number | null; interest: string; recommended?: boolean;
}) {
  return (
    <div className={`rounded-inner border p-4 ${recommended ? 'bg-pos/5 border-pos/25' : 'bg-white/5 border-white/10'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={recommended ? 'text-pos' : 'text-ink-2'}>{icon}</span>
        <h4 className="text-sm font-bold text-ink">{title}</h4>
        {recommended && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-pos/15 text-pos">Melhor</span>}
      </div>
      <p className="text-xs text-ink-3 mb-3">{subtitle}</p>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-3">Quita em</span>
        <span className="text-sm font-bold text-ink">{months !== null ? `${months} meses` : '—'}</span>
      </div>
      <div className="flex items-baseline justify-between mt-1">
        <span className="text-xs text-ink-3">Juros totais</span>
        <span className="text-sm font-bold text-neg">{interest}</span>
      </div>
    </div>
  );
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
