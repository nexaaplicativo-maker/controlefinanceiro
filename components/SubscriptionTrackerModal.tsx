"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, Search, AlertTriangle, ShieldAlert, CreditCard, Sparkles, TrendingDown } from "lucide-react";
import { formatMoney } from "../lib/format";
import { detectRecurring } from "../lib/insights-gastos";
import { useModalA11y } from "../hooks/use-modal-a11y";

export function SubscriptionTrackerModal({ isOpen, onClose, transactions }: { isOpen: boolean, onClose: () => void, transactions: any[] }) {
  const a11yRef = useModalA11y(isOpen, onClose);
  if (!isOpen) return null;

  // Detecção por PADRÃO, não por dicionário de marcas.
  //
  // Antes isto era uma lista de 21 palavras ('netflix', 'spotify'...) que não
  // detectava recorrência: detectava marcas que alguém digitou um dia. Perdia
  // Alura, seguro do carro, mensalidade do contador e qualquer serviço
  // regional ou novo — e marcava TODA despesa de "Contas Fixas" como
  // assinatura.
  //
  // Agora: mesmo título normalizado, valor estável, em meses distintos.
  const detected = detectRecurring(transactions)
    // Defesa extra: aporte nunca é "vazamento". A detecção já exclui, mas
    // custa uma linha garantir que nenhuma mudança futura lá reintroduza isso.
    .filter(r => r.category !== 'Investimentos');

  /**
   * Recorrente não é sinônimo de ruim.
   *
   * Antes toda despesa repetida era pintada de vermelho e ganhava
   * "Sugestão: Cancelar?" se passasse de R$ 40 e não estivesse numa lista
   * fixa de palavras ('agua', 'luz', 'iptu'...). Ou seja: o mesmo erro do
   * dicionário que a detecção já tinha abandonado, só que na apresentação —
   * e plano de saúde, mensalidade ou aporte apareciam como vilões.
   *
   * Agora a classificação usa a CATEGORIA, que o app já conhece.
   */
  const classify = (category: string): 'essencial' | 'revisar' => (
    category === 'Contas Fixas' ? 'essencial' : 'revisar'
  );

  const uniqueSubscriptions = detected.map(r => ({
    id: r.pattern,
    title: r.displayName,
    amount: r.monthlyAmount,
    category: r.category,
    occurrences: r.occurrences,
    monthsSpan: r.monthsSpan,
    confidence: r.confidence,
    kind: classify(r.category),
  }));

  const totalMonthly = uniqueSubscriptions.reduce((acc, t) => acc + t.amount, 0);
  const totalYearly = totalMonthly * 12;

  const revisaveis = uniqueSubscriptions.filter(s => s.kind === 'revisar');
  const totalRevisavel = revisaveis.reduce((a, s) => a + s.amount, 0);


  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />
        
        <motion.div ref={a11yRef} role="dialog" aria-modal="true" 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg sheet-panel rounded-t-card sm:rounded-card sheet-grab pb-safe sm:pb-0 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden"
        >
          {/* Fundo brilhante estilo Raio-X */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
             <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand/[0.06] rounded-full blur-3xl"></div>
             <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-brand/[0.06] rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-ink flex items-center gap-2">
                <Search className="w-5 h-5 text-neg" />
                Caçador de Assinaturas
              </h2>
              <button onClick={onClose} aria-label="Fechar" className="p-2 text-ink-2 hover:text-ink bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-ink-2 mb-6">
              Gastos que se repetem todo mês. Nem todos são ruins — contas fixas aparecem aqui porque são recorrentes, não porque você deveria cancelá-las.
            </p>

            <div className="mb-6 bg-black/30 rounded-inner p-4 border border-white/10 relative z-10 overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-brand/[0.06] rounded-full blur-2xl"></div>

              <div className="flex justify-between items-center mb-2">
                <span className="text-ink-2 font-medium text-sm">Compromisso mensal</span>
                <span className="text-ink font-bold">{formatMoney(totalMonthly)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <span className="text-ink-2 font-medium text-sm">Ao longo de um ano</span>
                <span className="text-ink font-bold text-xl">{formatMoney(totalYearly)}</span>
              </div>

              {totalRevisavel > 0 && (
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/5">
                  <span className="text-warn font-medium flex items-center gap-1 text-sm">
                    <AlertTriangle className="w-4 h-4" /> Vale revisar
                  </span>
                  <span className="text-warn font-bold">{formatMoney(totalRevisavel)}<span className="text-ink-3 text-xs font-normal">/mês</span></span>
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
              {uniqueSubscriptions.length === 0 ? (
                <div className="text-center py-8">
                  <ShieldAlert className="w-12 h-12 text-ink-3 mx-auto mb-3" />
                  <p className="text-ink-2 text-sm">Nenhuma assinatura detectada. Seu dinheiro está seguro!</p>
                </div>
              ) : (
                uniqueSubscriptions.map((sub, idx) => {
                  const yearly = sub.amount * 12;
                  const essencial = sub.kind === 'essencial';

                  return (
                    <div key={idx} className="flex flex-col p-3 rounded-inner bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${essencial ? 'bg-white/10' : 'bg-warn/10'}`}>
                            <CreditCard className={`w-4 h-4 ${essencial ? 'text-ink-2' : 'text-warn'}`} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-ink font-medium block truncate">{sub.title}</span>
                            <span className="text-xs text-ink-3">
                              {sub.category} · {sub.occurrences}x em {sub.monthsSpan} {sub.monthsSpan === 1 ? 'mês' : 'meses'}
                              {sub.confidence < 0.7 && ' · possível'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-ink font-bold text-sm">{formatMoney(sub.amount)}<span className="text-ink-3 text-xs font-normal">/mês</span></div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pl-11 gap-2 flex-wrap">
                        <span className="text-ink-2 text-xs font-medium bg-white/5 px-2 py-0.5 rounded-md">
                          {formatMoney(yearly)} ao ano
                        </span>

                        {/* Sugestão só para o que é de fato discricionário.
                            Conta fixa é compromisso, não desperdício. */}
                        {!essencial && sub.amount > 40 && (
                          <span className="text-xs text-warn flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Ainda usa?
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/10 relative z-10">
               <p className="text-xs text-ink-2 text-center flex items-center justify-center gap-1">
                 <Sparkles className="w-3 h-3 text-brand" /> 
                 Reveja essas assinaturas. A maioria não usamos o suficiente para justificar o custo anual.
               </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
