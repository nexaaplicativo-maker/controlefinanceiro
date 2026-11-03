"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Bug, Lightbulb, HelpCircle, MessageSquare, Loader2, Check, AlertTriangle, Monitor } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { toast } from "./Toast";

/**
 * Caixa de entrada do beta: feedback e erros.
 *
 * O widget de feedback foi construído sem a leitura — dava para enviar e não
 * havia onde ler, só consultando o banco à mão. Retorno que ninguém lê não é
 * canal de feedback, é formulário decorativo.
 *
 * Os erros vêm na mesma tela de propósito: no beta, metade do "feedback" que
 * importa é falha que o usuário nem reportou.
 */

type Aba = 'feedback' | 'erros';

const TIPOS: Record<string, { label: string; icon: typeof Bug; color: string }> = {
  bug:      { label: 'Quebrou',   icon: Bug,        color: 'text-neg' },
  sugestao: { label: 'Ideia',     icon: Lightbulb,  color: 'text-warn' },
  duvida:   { label: 'Dúvida',    icon: HelpCircle, color: 'text-brand' },
  outro:    { label: 'Outro',     icon: MessageSquare, color: 'text-ink-2' },
};

interface FeedbackRow {
  id: string;
  email: string | null;
  kind: string;
  message: string;
  status: string;
  created_at: string;
  context: { url?: string; userAgent?: string; viewport?: string } | null;
}

interface ErrorRow {
  id: string;
  message: string;
  stack: string | null;
  created_at: string;
  context: { url?: string; userAgent?: string } | null;
}

export function FeedbackInboxModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const a11yRef = useModalA11y(isOpen, onClose);

  const [aba, setAba] = useState<Aba>('feedback');
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [erros, setErros] = useState<ErrorRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [faltaSql, setFaltaSql] = useState(false);

  useEffect(() => {
    if (isOpen) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function carregar() {
    setIsLoading(true);
    const [fb, er] = await Promise.all([
      supabase.rpc('admin_feedback_list'),
      supabase.from('error_log').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    // Mensagem específica quando o SQL do beta ainda não foi aplicado, para
    // não parecer falha de permissão.
    // Se a funcao nova ainda nao existe, cai na leitura direta da tabela —
    // mostra a mensagem sem o e-mail, em vez de nao mostrar nada.
    if (fb.error) {
      const direto = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(100);
      if (direto.error) setFaltaSql(true);
      setFeedbacks((direto.data as FeedbackRow[]) ?? []);
      setErros((er.data as ErrorRow[]) ?? []);
      setIsLoading(false);
      return;
    }

    setFeedbacks((fb.data as FeedbackRow[]) ?? []);
    setErros((er.data as ErrorRow[]) ?? []);
    setIsLoading(false);
  }

  async function marcar(id: string, status: string) {
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id);
    if (error) { toast("Erro ao atualizar: " + error.message, "error"); return; }
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  }

  const novos = feedbacks.filter(f => f.status === 'novo').length;

  const quando = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          <motion.div
            ref={a11yRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inbox-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl max-h-[88vh] sheet-panel rounded-t-card sm:rounded-card sheet-grab pb-safe sm:pb-0 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col"
          >
            <div className="flex justify-between items-center mb-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand/10 border border-brand/20 rounded-inner">
                  <MessageSquare className="w-5 h-5 text-brand" />
                </div>
                <div>
                  <h2 id="inbox-title" className="text-xl font-bold text-ink leading-tight">Caixa de entrada</h2>
                  <p className="text-xs text-ink-3">
                    {novos > 0 ? `${novos} não ${novos === 1 ? 'lido' : 'lidos'}` : 'Tudo lido'}
                    {erros.length > 0 && ` · ${erros.length} ${erros.length === 1 ? 'erro' : 'erros'}`}
                  </p>
                </div>
              </div>
              <button onClick={onClose} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-ink-2 hover:text-ink transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2 p-1 bg-white/5 rounded-inner border border-white/10 shrink-0 mb-4">
              <button onClick={() => setAba('feedback')} className={`flex-1 py-2 rounded-field text-sm font-medium transition-colors cursor-pointer ${aba === 'feedback' ? 'bg-brand/20 text-brand border border-brand/30' : 'text-ink-2 hover:text-ink'}`}>
                Feedback {feedbacks.length > 0 && `(${feedbacks.length})`}
              </button>
              <button onClick={() => setAba('erros')} className={`flex-1 py-2 rounded-field text-sm font-medium transition-colors cursor-pointer ${aba === 'erros' ? 'bg-neg/20 text-neg border border-neg/30' : 'text-ink-2 hover:text-ink'}`}>
                Erros {erros.length > 0 && `(${erros.length})`}
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1">
              {faltaSql ? (
                <div className="text-center py-10 px-4">
                  <AlertTriangle className="w-8 h-8 text-warn/70 mx-auto mb-3" />
                  <p className="text-sm text-ink-2 mb-2">Tabelas do beta ainda não existem.</p>
                  <p className="text-xs text-ink-3 leading-relaxed max-w-sm mx-auto">
                    Rode <code className="text-ink-2">supabase/2026-10-02-beta-fechado.sql</code> no painel do Supabase.
                  </p>
                </div>
              ) : isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-ink-3 animate-spin" /></div>
              ) : aba === 'feedback' ? (
                feedbacks.length === 0 ? (
                  <Vazio texto="Nenhum feedback ainda. Quando alguém enviar pelo botão de mensagem, aparece aqui." />
                ) : (
                  <div className="flex flex-col gap-2">
                    {feedbacks.map(f => {
                      const tipo = TIPOS[f.kind] ?? TIPOS.outro;
                      const Icon = tipo.icon;
                      const novo = f.status === 'novo';

                      return (
                        <div key={f.id} className={`rounded-inner border p-4 ${novo ? 'bg-white/5 border-brand/20' : 'bg-white/5 border-white/5'}`}>
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className={`w-4 h-4 shrink-0 ${tipo.color}`} />
                              <span className="text-xs font-semibold text-ink-2">{tipo.label}</span>
                              {novo && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-brand/15 text-brand">Novo</span>}
                            </div>
                            <span className="text-xs text-ink-3 shrink-0">{quando(f.created_at)}</span>
                          </div>

                          {f.email && (
                            <p className="text-xs text-brand/80 mb-2 selectable">{f.email}</p>
                          )}

                          <p className="text-sm text-ink leading-relaxed whitespace-pre-line mb-3 selectable">{f.message}</p>

                          {f.context?.url && (
                            <p className="text-xs text-ink-3 flex items-center gap-1.5 mb-3">
                              <Monitor className="w-3 h-3 shrink-0" />
                              {f.context.url}
                              {f.context.viewport && ` · ${f.context.viewport}`}
                            </p>
                          )}

                          <div className="flex gap-2">
                            {f.status !== 'lido' && (
                              <button onClick={() => marcar(f.id, 'lido')} className="text-xs font-semibold text-ink-2 hover:text-ink bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                                Marcar como lido
                              </button>
                            )}
                            {f.status !== 'resolvido' && (
                              <button onClick={() => marcar(f.id, 'resolvido')} className="text-xs font-semibold text-pos hover:text-pos bg-pos/10 hover:bg-pos/20 px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1">
                                <Check className="w-3 h-3" /> Resolvido
                              </button>
                            )}
                            {f.status === 'resolvido' && (
                              <span className="text-xs text-pos/70 px-1 py-1.5">✓ Resolvido</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                erros.length === 0 ? (
                  <Vazio texto="Nenhum erro registrado. Boa notícia." />
                ) : (
                  <div className="flex flex-col gap-2">
                    {erros.map(e => (
                      <div key={e.id} className="rounded-inner border border-neg/15 bg-neg/5 p-4">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <span className="text-sm font-semibold text-neg break-words min-w-0 selectable">{e.message}</span>
                          <span className="text-xs text-ink-3 shrink-0">{quando(e.created_at)}</span>
                        </div>
                        {e.context?.url && (
                          <p className="text-xs text-ink-3 mb-2">em {e.context.url}</p>
                        )}
                        {e.stack && (
                          <details className="mt-2">
                            <summary className="text-xs text-ink-3 cursor-pointer hover:text-ink-2">Ver detalhe técnico</summary>
                            <pre className="text-xs text-ink-3 mt-2 overflow-x-auto whitespace-pre-wrap break-all selectable">{e.stack.slice(0, 1500)}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="text-center py-12 px-6">
      <MessageSquare className="w-8 h-8 text-ink-3 mx-auto mb-3" />
      <p className="text-xs text-ink-3 leading-relaxed max-w-sm mx-auto">{texto}</p>
    </div>
  );
}
