"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, LineChart, Plus, Trash2, Pencil, Loader2, TrendingUp, TrendingDown, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "./Toast";
import { formatMoney as fmtMoney } from "../lib/format";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { confirmDialog } from "./ConfirmDialog";

/**
 * Patrimônio — o que você tem e quanto vale hoje.
 *
 * Complementa (não substitui) os lançamentos com categoria "Investimentos":
 *   - O lançamento registra o dinheiro saindo da conta. É fluxo de caixa.
 *   - A posição aqui registra o que você possui. É patrimônio.
 *
 * O valor de mercado é atualizado à mão: o app não consulta cotação. Preferi
 * assim a inventar integração com corretora — um campo que você edita quando
 * quiser é honesto sobre o que o app sabe.
 */

const KINDS: Record<string, string> = {
  acoes: 'Ações',
  fii: 'Fundos Imobiliários',
  renda_fixa: 'Renda Fixa',
  cripto: 'Cripto',
  outro: 'Outro',
};

type Position = {
  id: string;
  name: string;
  kind: string | null;
  invested_amount: number;
  current_value: number;
  updated_at?: string;
};

export function InvestmentsModal({
  isOpen,
  onClose,
  userId,
  showValues = true,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  showValues?: boolean;
  onSave?: () => void;
}) {
  const a11yRef = useModalA11y(isOpen, onClose);
  const formatMoney = (val: number) => fmtMoney(val, showValues);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [name, setName] = useState("");
  const [kind, setKind] = useState("acoes");
  const [invested, setInvested] = useState("");
  const [current, setCurrent] = useState("");

  useEffect(() => {
    if (isOpen) fetchPositions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function fetchPositions() {
    setIsLoading(true);
    const { data } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', userId)
      .order('current_value', { ascending: false });
    setPositions((data as Position[]) ?? []);
    setIsLoading(false);
  }


  const resetForm = () => {
    setName(""); setKind("acoes"); setInvested(""); setCurrent("");
    setEditingId(null); setIsAdding(false);
  };

  const startEdit = (p: Position) => {
    setEditingId(p.id);
    setIsAdding(false);
    setName(p.name);
    setKind(p.kind ?? 'outro');
    setInvested(String(p.invested_amount));
    setCurrent(String(p.current_value));
  };

  const handleSubmit = async () => {
    const investedNum = parseFloat(invested);
    const currentNum = parseFloat(current);

    if (!name.trim()) { toast("Dê um nome ao ativo.", "warning"); return; }
    if (isNaN(investedNum) || investedNum < 0) { toast("Informe quanto você aportou.", "warning"); return; }
    if (isNaN(currentNum) || currentNum < 0) { toast("Informe quanto vale hoje.", "warning"); return; }

    setIsSaving(true);
    const payload = {
      user_id: userId,
      name: name.trim(),
      kind,
      invested_amount: investedNum,
      current_value: currentNum,
    };

    const { error } = editingId
      ? await supabase.from('investments').update(payload).eq('id', editingId)
      : await supabase.from('investments').insert([payload]);

    setIsSaving(false);

    if (error) {
      toast("Erro ao salvar: " + error.message, "error");
      return;
    }
    toast(editingId ? "Posição atualizada." : "Posição adicionada. 📈", "success");
    resetForm();
    await fetchPositions();
    onSave?.();
  };

  const handleDelete = async (p: Position) => {
    const ok = await confirmDialog({
      title: `Remover "${p.name}" do patrimônio?`,
      message: 'Isto não apaga nenhum lançamento — só a posição.',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('investments').delete().eq('id', p.id);
    if (error) { toast("Erro ao remover.", "error"); return; }
    setPositions(prev => prev.filter(x => x.id !== p.id));
    toast("Posição removida.", "info");
    onSave?.();
  };

  const totalInvested = positions.reduce((a, p) => a + Number(p.invested_amount ?? 0), 0);
  const totalCurrent = positions.reduce((a, p) => a + Number(p.current_value ?? 0), 0);
  const totalReturn = totalCurrent - totalInvested;
  const returnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
  const isUp = totalReturn >= 0;

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
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-pos/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex justify-between items-center mb-5 shrink-0 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-pos/10 border border-pos/20 rounded-inner">
                  <LineChart className="w-5 h-5 text-pos" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink leading-tight">Patrimônio</h2>
                  <p className="text-xs text-ink-3">O que você tem e quanto vale hoje</p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-ink-2 hover:text-ink cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Resumo */}
            {positions.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-5 shrink-0 relative z-10">
                <div className="bg-white/5 border border-white/10 rounded-inner p-3.5">
                  <p className="text-xs text-ink-3 font-semibold mb-1">Aportado</p>
                  <p className="text-lg font-bold text-ink tracking-tight">{formatMoney(totalInvested)}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-inner p-3.5">
                  <p className="text-xs text-ink-3 font-semibold mb-1">Vale hoje</p>
                  <p className="text-lg font-bold text-ink tracking-tight">{formatMoney(totalCurrent)}</p>
                </div>
                <div className={`rounded-inner p-3.5 border ${isUp ? 'bg-pos/5 border-pos/20' : 'bg-neg/5 border-neg/20'}`}>
                  <p className="text-xs text-ink-3 font-semibold mb-1">Rendimento</p>
                  <p className={`text-lg font-bold tracking-tight flex items-center gap-1 ${isUp ? 'text-pos' : 'text-neg'}`}>
                    {isUp ? <TrendingUp className="w-4 h-4 shrink-0" /> : <TrendingDown className="w-4 h-4 shrink-0" />}
                    {showValues ? `${isUp ? '+' : ''}${returnPercent.toFixed(1)}%` : '••%'}
                  </p>
                  <p className="text-xs text-ink-3 mt-0.5">{showValues ? `${isUp ? '+' : ''}${formatMoney(totalReturn).replace('R$ ', 'R$ ')}` : ''}</p>
                </div>
              </div>
            )}

            <div className="overflow-y-auto pr-1 flex-1 relative z-10">

              {/* Formulário */}
              <AnimatePresence>
                {showForm && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="bg-black/30 border border-white/10 rounded-inner p-4 mb-4 flex flex-col gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-ink-3 font-semibold mb-1.5 block">Ativo</label>
                          <input
                            type="text" value={name} onChange={e => setName(e.target.value)}
                            placeholder="Ex: BBAS3, Tesouro Selic"
                            className="w-full bg-black/40 border border-white/10 rounded-field py-2.5 px-3 text-ink text-sm placeholder:text-ink-3 focus:outline-none focus:border-pos transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-ink-3 font-semibold mb-1.5 block">Tipo</label>
                          <select
                            value={kind} onChange={e => setKind(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-field py-2.5 px-3 text-ink text-sm focus:outline-none focus:border-pos transition-colors cursor-pointer"
                          >
                            {Object.entries(KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-ink-3 font-semibold mb-1.5 block">Quanto aportou</label>
                          <input
                            type="number" step="0.01" value={invested} onChange={e => setInvested(e.target.value)}
                            placeholder="0,00"
                            className="w-full bg-black/40 border border-white/10 rounded-field py-2.5 px-3 text-ink text-sm font-semibold placeholder:text-ink-3 focus:outline-none focus:border-pos transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-ink-3 font-semibold mb-1.5 block">Vale hoje</label>
                          <input
                            type="number" step="0.01" value={current} onChange={e => setCurrent(e.target.value)}
                            placeholder="0,00"
                            className="w-full bg-black/40 border border-white/10 rounded-field py-2.5 px-3 text-ink text-sm font-semibold placeholder:text-ink-3 focus:outline-none focus:border-pos transition-colors"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button onClick={resetForm} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-ink-2 hover:text-ink rounded-field text-sm font-semibold transition-colors cursor-pointer">
                          Cancelar
                        </button>
                        <button onClick={handleSubmit} disabled={isSaving} className="flex-1 bg-pos hover:bg-pos text-ink font-bold py-2.5 rounded-field text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer">
                          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> {editingId ? 'Atualizar' : 'Adicionar'}</>}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!showForm && (
                <button
                  onClick={() => { resetForm(); setIsAdding(true); }}
                  className="w-full mb-4 flex items-center justify-center gap-2 bg-pos/10 hover:bg-pos/20 text-pos border border-pos/20 py-3 rounded-inner font-semibold text-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Adicionar posição
                </button>
              )}

              {/* Lista */}
              {isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-ink-3 animate-spin" /></div>
              ) : positions.length === 0 ? (
                <div className="text-center py-8 px-4">
                  <LineChart className="w-8 h-8 text-ink-3 mx-auto mb-3" />
                  <p className="text-sm text-ink-2 mb-2">Nenhuma posição cadastrada.</p>
                  <p className="text-xs text-ink-3 leading-relaxed max-w-sm mx-auto">
                    Enquanto não houver posição, o app usa a soma dos seus aportes como patrimônio — ou seja, assume que o investimento vale exatamente o que você colocou.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {positions.map(p => {
                    const ret = Number(p.current_value) - Number(p.invested_amount);
                    const pct = Number(p.invested_amount) > 0 ? (ret / Number(p.invested_amount)) * 100 : 0;
                    const up = ret >= 0;
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-3 p-3.5 rounded-inner bg-white/5 border border-white/5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-ink truncate">{p.name}</p>
                            <span className="text-xs text-ink-3 bg-white/5 px-1.5 py-0.5 rounded shrink-0">{KINDS[p.kind ?? 'outro'] ?? 'Outro'}</span>
                          </div>
                          <p className="text-xs text-ink-3 mt-0.5">
                            Aportou {formatMoney(Number(p.invested_amount))}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-ink whitespace-nowrap">{formatMoney(Number(p.current_value))}</p>
                          <p className={`text-xs font-semibold ${up ? 'text-pos' : 'text-neg'}`}>
                            {showValues ? `${up ? '+' : ''}${pct.toFixed(1)}%` : '••%'}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => startEdit(p)} className="p-1.5 text-brand/60 hover:text-brand hover:bg-brand/10 rounded-lg transition-colors cursor-pointer" title="Editar">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(p)} className="p-1.5 text-neg/50 hover:text-neg hover:bg-neg/10 rounded-lg transition-colors cursor-pointer" title="Remover">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {positions.length > 0 && (
                <p className="text-xs text-ink-3 leading-relaxed mt-5 text-center">
                  O app não consulta cotação — atualize o "vale hoje" quando quiser. Isto é patrimônio, separado dos seus lançamentos de aporte.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
