"use client";

import { AnimatePresence, motion } from "motion/react";
import { X, CreditCard, CalendarClock, AlertTriangle, CheckCircle2, Clock, Trash2, Layers, TrendingDown } from "lucide-react";
import type { ProfileInsights } from "../lib/profile";
import { formatMoney as fmtMoney } from "../lib/format";
import { useModalA11y } from "../hooks/use-modal-a11y";

/**
 * Gestão de Cartões — separa o que já venceu do que ainda vai vencer.
 *
 * A pergunta que este modal responde não é "quanto gastei", e sim "quanto da
 * minha renda futura eu já comprometi". Parcela é dívida: o dinheiro do mês
 * que vem já tem dono antes de entrar na conta.
 *
 * As parcelas futuras são agrupadas por installment_group para o usuário ver a
 * compra inteira ("Geladeira 3/12 · faltam 9"), e não 9 linhas soltas.
 */

type Tx = {
  id: string;
  title?: string;
  amount?: number;
  date?: string;
  category?: string;
  is_paid?: boolean;
  installment_group?: string | null;
  installment_info?: string | null;
};

const CARD_CATEGORIES = ['Cartões', 'Cartões de Crédito'];

/** Remove o sufixo "(3/12)" que o TransactionModal adiciona ao parcelar. */
function baseTitle(title?: string): string {
  return (title ?? 'Sem título').replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
}

interface FutureGroup {
  key: string;
  title: string;
  total: number;
  count: number;
  nextDate?: string;
  info?: string | null;
}

export function CreditCardManagerModal({
  isOpen,
  onClose,
  transactions,
  activeMonth,
  activeYear,
  insights,
  showValues = true,
  onTogglePaid,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  transactions: Tx[];
  activeMonth: number;
  activeYear: number;
  insights: ProfileInsights;
  showValues?: boolean;
  onTogglePaid?: (id: string, current: boolean) => void;
  onDelete?: (id: string) => void;
}) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const formatMoney = (val: number) => fmtMoney(val, showValues);

  const monthKey = `${activeYear}-${String(activeMonth + 1).padStart(2, '0')}`;

  // Só agrupa com o modal aberto: o {isOpen && ...} esconde a renderização,
  // não a execução, e isto rodava a cada render do dashboard.
  const cardTxs = !isOpen ? [] : transactions.filter(t => CARD_CATEGORIES.includes(t.category ?? ''));

  // Fatura do mês ativo
  const fatura = cardTxs
    .filter(t => t.date?.slice(0, 7) === monthKey)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  const faturaTotal = fatura.reduce((acc, t) => acc + (t.amount ?? 0), 0);
  const faturaPendente = fatura.filter(t => t.is_paid === false).reduce((acc, t) => acc + (t.amount ?? 0), 0);

  // Parcelas que ainda vão vencer, agrupadas por compra
  const futuras = cardTxs.filter(t => (t.date?.slice(0, 7) ?? '') > monthKey);
  const futurasTotal = futuras.reduce((acc, t) => acc + (t.amount ?? 0), 0);

  const groupMap = new Map<string, FutureGroup>();
  for (const t of futuras) {
    // Sem installment_group, cada lançamento é a própria compra.
    const key = t.installment_group ?? `single-${t.id}`;
    const existing = groupMap.get(key);
    if (existing) {
      existing.total += t.amount ?? 0;
      existing.count += 1;
      if ((t.date ?? '') < (existing.nextDate ?? '9999')) {
        existing.nextDate = t.date;
        existing.info = t.installment_info;
      }
    } else {
      groupMap.set(key, {
        key,
        title: baseTitle(t.title),
        total: t.amount ?? 0,
        count: 1,
        nextDate: t.date,
        info: t.installment_info,
      });
    }
  }
  const futureGroups = [...groupMap.values()].sort((a, b) => b.total - a.total);

  // Quanto da renda mensal já está comprometida com parcelas futuras.
  const renda = insights.referenceIncome;
  const mesesComprometidos = renda > 0 ? futurasTotal / renda : 0;
  const faturaPercent = renda > 0 ? (faturaTotal / renda) * 100 : 0;
  const alerta = faturaPercent > insights.gargaloCritical;

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' }) : '—';

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

            {/* Cabeçalho */}
            <div className="flex justify-between items-center mb-5 shrink-0 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand/10 border border-brand/20 rounded-inner">
                  <CreditCard className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink leading-tight">Gestão de Cartões</h2>
                  <p className="text-xs text-ink-3">Quanto da sua renda já tem dono</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-2 gap-3 mb-5 shrink-0 relative z-10">
              <div className={`rounded-inner p-4 border ${alerta ? 'bg-neg/5 border-neg/20' : 'bg-white/5 border-white/10'}`}>
                <p className="text-xs text-ink-3 font-semibold mb-1.5">Fatura do mês</p>
                <p className={`text-2xl font-semibold tracking-tight ${alerta ? 'text-neg' : 'text-ink'}`}>{formatMoney(faturaTotal)}</p>
                {renda > 0 && (
                  <p className="text-xs text-ink-3 mt-1">{faturaPercent.toFixed(0)}% da sua renda</p>
                )}
              </div>
              <div className="rounded-inner p-4 border bg-white/5 border-white/10">
                <p className="text-xs text-ink-3 font-semibold mb-1.5">Parcelas futuras</p>
                <p className="text-2xl font-semibold tracking-tight text-warn">{formatMoney(futurasTotal)}</p>
                {renda > 0 && futurasTotal > 0 && (
                  <p className="text-xs text-ink-3 mt-1">{mesesComprometidos.toFixed(1)} meses de renda</p>
                )}
              </div>
            </div>

            {alerta && (
              <div className="flex items-start gap-2.5 bg-neg/5 border border-neg/20 rounded-inner p-3.5 mb-5 shrink-0 relative z-10">
                <AlertTriangle className="w-4 h-4 text-neg shrink-0 mt-0.5" />
                <p className="text-xs text-ink-2 leading-relaxed">
                  Sua fatura passou de {insights.gargaloCritical.toFixed(0)}% da renda, o teto do seu perfil. Cada nova parcela aqui é renda futura que você já gastou.
                </p>
              </div>
            )}

            {/* Listas */}
            <div className="flex-1 overflow-y-auto relative z-10 pr-1 flex flex-col gap-6">

              <section>
                <div className="flex items-center justify-between mb-3 sticky top-0 bg-surface py-1">
                  <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-brand" /> Fatura do Mês Atual
                  </h3>
                  {faturaPendente > 0 && (
                    <span className="text-xs font-bold text-warn bg-warn/10 px-2 py-1 rounded-full">
                      {formatMoney(faturaPendente)} em aberto
                    </span>
                  )}
                </div>

                {fatura.length === 0 ? (
                  <EmptyHint text="Nenhuma compra no cartão neste mês. Continue assim." positive />
                ) : (
                  <div className="flex flex-col gap-2">
                    {fatura.map(t => (
                      <div key={t.id} className={`flex items-center justify-between gap-3 p-3 rounded-field border transition-colors ${t.is_paid === false ? 'bg-warn/5 border-warn/10' : 'bg-white/5 border-white/5'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-ink truncate">{t.title || 'Sem título'}</p>
                            {t.installment_info && (
                              <span className="text-xs font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded shrink-0">{t.installment_info}</span>
                            )}
                          </div>
                          <p className="text-xs text-ink-3 mt-0.5">{formatDate(t.date)}</p>
                        </div>
                        <span className="text-sm font-bold text-ink whitespace-nowrap">{formatMoney(t.amount ?? 0)}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {onTogglePaid && t.is_paid !== undefined && (
                            <button
                              onClick={() => onTogglePaid(t.id, !!t.is_paid)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${t.is_paid ? 'text-pos/60 hover:text-pos hover:bg-pos/10' : 'text-warn/80 hover:text-warn hover:bg-warn/10'}`}
                              title={t.is_paid ? 'Marcar como pendente' : 'Marcar como pago'}
                            >
                              {t.is_paid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {onDelete && (
                            <button onClick={() => onDelete(t.id)} className="p-1.5 text-neg/50 hover:text-neg hover:bg-neg/10 rounded-lg transition-colors cursor-pointer" title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between mb-3 sticky top-0 bg-surface py-1">
                  <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <Layers className="w-4 h-4 text-warn" /> Parcelas Futuras
                  </h3>
                  {futureGroups.length > 0 && (
                    <span className="text-xs text-ink-3 font-medium">
                      {futureGroups.length} compra{futureGroups.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {futureGroups.length === 0 ? (
                  <EmptyHint text="Nenhuma parcela comprometendo seus próximos meses. Sua renda futura está livre." positive />
                ) : (
                  <div className="flex flex-col gap-2">
                    {futureGroups.map(g => (
                      <div key={g.key} className="flex items-center justify-between gap-3 p-3 rounded-field bg-white/5 border border-white/5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">{g.title}</p>
                          <p className="text-xs text-ink-3 mt-0.5">
                            {g.count > 1 ? `${g.count} parcelas restantes` : '1 parcela'} · próxima em {formatDate(g.nextDate)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-warn whitespace-nowrap">{formatMoney(g.total)}</p>
                          {g.info && <p className="text-xs text-ink-3">a partir de {g.info}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

            </div>

            {futurasTotal > 0 && (
              <div className="pt-4 mt-4 border-t border-white/10 shrink-0 relative z-10">
                <div className="flex items-center gap-2.5">
                  <TrendingDown className="w-4 h-4 text-ink-3 shrink-0" />
                  <p className="text-xs text-ink-3 leading-relaxed">
                    Somando fatura e parcelas, <strong className="text-ink-2">{formatMoney(faturaTotal + futurasTotal)}</strong> da sua renda já está comprometida com cartão.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function EmptyHint({ text, positive }: { text: string; positive?: boolean }) {
  return (
    <div className={`rounded-field border p-4 text-center ${positive ? 'bg-pos/5 border-pos/10' : 'bg-white/5 border-white/10'}`}>
      <p className={`text-xs ${positive ? 'text-pos/80' : 'text-ink-3'}`}>{text}</p>
    </div>
  );
}
