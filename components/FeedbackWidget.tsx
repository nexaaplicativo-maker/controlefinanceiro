"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, X, Bug, Lightbulb, HelpCircle, Loader2, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getUserId } from "../lib/session";
import { useModalA11y } from "../hooks/use-modal-a11y";
import { toast } from "./Toast";

/**
 * Canal de feedback dentro do app.
 *
 * É o produto do beta: sem isto o retorno se perde no WhatsApp e some. Fica
 * sempre acessível, de propósito — se a pessoa precisa procurar onde reclamar,
 * ela não reclama, só para de usar.
 *
 * Captura o contexto técnico junto (tela, navegador, tamanho) porque "não
 * funcionou" sem contexto é irreproduzível, e beta tester não vai saber
 * descrever o ambiente dele.
 */

const TIPOS = [
  { id: 'bug',       label: 'Algo quebrou',  icon: Bug,         color: 'text-neg',    bg: 'bg-neg/10 border-neg/30' },
  { id: 'sugestao',  label: 'Tenho ideia',   icon: Lightbulb,   color: 'text-warn',   bg: 'bg-warn/10 border-warn/30' },
  { id: 'duvida',    label: 'Não entendi',   icon: HelpCircle,  color: 'text-brand',  bg: 'bg-brand/10 border-brand/30' },
] as const;

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [kind, setKind] = useState<string>('bug');
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const a11yRef = useModalA11y(isOpen, () => setIsOpen(false));

  const enviar = async () => {
    if (message.trim().length < 5) {
      toast("Escreva um pouco mais para eu conseguir ajudar.", "warning");
      return;
    }

    setIsSending(true);
    const uid = await getUserId();

    const { error } = await supabase.from('feedback').insert([{
      user_id: uid,
      kind,
      message: message.trim(),
      context: {
        url: typeof window !== 'undefined' ? window.location.pathname : null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
        at: new Date().toISOString(),
      },
    }]);
    setIsSending(false);

    if (error) {
      toast("Não consegui enviar: " + error.message, "error");
      return;
    }

    setEnviado(true);
    setMessage("");
    // Dá tempo de ver a confirmação antes de fechar.
    setTimeout(() => { setIsOpen(false); setEnviado(false); }, 1800);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Enviar feedback"
        title="Enviar feedback"
        className="fixed bottom-above-nav md:bottom-6 left-4 z-40 w-11 h-11 rounded-full bg-surface/90 border border-white/10 backdrop-blur-xl text-ink-2 hover:text-ink hover:border-white/20 shadow-xl flex items-center justify-center transition-colors cursor-pointer"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />

            <motion.div
              ref={a11yRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md sheet-panel rounded-card p-6 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
            >
              {enviado ? (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-pos/10 border border-pos/20 rounded-inner flex items-center justify-center mx-auto mb-4">
                    <Check className="w-6 h-6 text-pos" />
                  </div>
                  <p className="text-ink font-bold mb-1">Recebido!</p>
                  <p className="text-xs text-ink-3">Obrigado — isso ajuda mais do que parece.</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-5">
                    <div>
                      <h2 id="feedback-title" className="text-lg font-bold text-ink leading-snug">Como está sendo?</h2>
                      <p className="text-xs text-ink-3 mt-0.5">O Nexa está em beta — seu retorno molda o que vem depois.</p>
                    </div>
                    <button onClick={() => setIsOpen(false)} aria-label="Fechar" className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-ink-2 hover:text-ink transition-colors cursor-pointer shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {TIPOS.map(t => {
                      const Icon = t.icon;
                      const ativo = kind === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setKind(t.id)}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-field border text-xs font-semibold transition-colors cursor-pointer ${
                            ativo ? t.bg + ' text-ink' : 'bg-black/30 border-white/10 text-ink-2 hover:text-ink'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${ativo ? t.color : ''}`} />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={4}
                    autoFocus
                    aria-label="Sua mensagem"
                    placeholder={
                      kind === 'bug' ? 'O que você estava fazendo quando quebrou?'
                      : kind === 'sugestao' ? 'O que faria o app te ajudar mais?'
                      : 'O que ficou confuso?'
                    }
                    className="w-full bg-black/40 border border-white/10 rounded-field p-3.5 text-ink text-sm placeholder:text-ink-3 focus:outline-none focus:border-brand transition-colors resize-none mb-3"
                  />

                  <p className="text-xs text-ink-3 mb-4 leading-relaxed">
                    Enviamos junto a tela em que você está e o navegador, para eu conseguir reproduzir. Nenhum valor ou lançamento seu vai nesta mensagem.
                  </p>

                  <button
                    onClick={enviar}
                    disabled={isSending}
                    className="w-full bg-brand hover:bg-brand-strong text-canvas font-bold py-3.5 rounded-field transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar'}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
