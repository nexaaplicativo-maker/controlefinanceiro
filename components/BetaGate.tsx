"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { KeyRound, Loader2, LogOut, ShieldCheck, FileText } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getUserId } from "../lib/session";
import { toast } from "./Toast";

/**
 * Portão do beta fechado.
 *
 * O Supabase Auth cria a conta no signUp, antes de qualquer lógica nossa — não
 * dá para "segurar" o cadastro sem desligar o signUp no painel. Então o
 * controle acontece aqui, depois: a conta nasce, mas o app só abre se houver
 * convite nominal resgatado.
 *
 * Também é onde o aceite dos termos é coletado, porque é o único ponto por
 * onde todo mundo passa obrigatoriamente antes de usar o app.
 */

/** Suba esta versão quando os termos mudarem: quem aceitou o antigo reaceita. */
export const TERMS_VERSION = '2026-10-02';

type Estado = 'verificando' | 'liberado' | 'precisa-convite' | 'precisa-termos';

export function BetaGate({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>('verificando');
  const [code, setCode] = useState("");
  const [aceitou, setAceitou] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => { verificar(); }, []);

  async function verificar() {
    const uid = await getUserId();
    if (!uid) {
      // Sem sessão, o próprio dashboard redireciona para /login.
      setEstado('liberado');
      return;
    }

    const { data: temAcesso, error } = await supabase.rpc('has_beta_access');

    // Função ausente = o SQL do beta ainda não foi aplicado. Isso é problema
    // de configuração, não decisão de acesso — e tratar como "sem acesso"
    // trancava o dono para fora do próprio app, sem caminho de volta.
    //
    // Falhar aberto aqui é seguro: quem protege os dados é o login do
    // Supabase e a RLS por usuário. Este portão só decide quem participa do
    // beta, não quem enxerga o quê.
    if (error) {
      console.warn('[BetaGate] portão inativo:', error.message);
      setEstado('liberado');
      return;
    }

    if (!temAcesso) { setEstado('precisa-convite'); return; }

    const { data: perfil, error: perfilError } = await supabase
      .from('profiles')
      .select('accepted_terms_at, accepted_terms_version')
      .eq('id', uid)
      .maybeSingle();

    // Mesma lógica: coluna de aceite ausente não pode travar o uso.
    if (perfilError) {
      console.warn('[BetaGate] aceite de termos indisponível:', perfilError.message);
      setEstado('liberado');
      return;
    }

    const aceiteValido = perfil?.accepted_terms_at && perfil?.accepted_terms_version === TERMS_VERSION;
    setEstado(aceiteValido ? 'liberado' : 'precisa-termos');
  }

  async function resgatar(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) { toast("Digite o código do convite.", "warning"); return; }

    setIsBusy(true);
    const { error } = await supabase.rpc('redeem_beta_invite', { invite_code: code.trim() });
    setIsBusy(false);

    if (error) {
      // A função devolve mensagens específicas e já seguras para exibir
      // (convite não encontrado, e-mail diferente, já usado, expirado).
      toast(error.message.replace(/^.*?:\s*/, ''), "error");
      return;
    }
    toast("Convite aceito. Bem-vindo ao Nexa! 🎉", "success");
    await verificar();
  }

  async function aceitarTermos() {
    const uid = await getUserId();
    if (!uid) return;

    setIsBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update({ accepted_terms_at: new Date().toISOString(), accepted_terms_version: TERMS_VERSION })
      .eq('id', uid);
    setIsBusy(false);

    if (error) { toast("Não consegui registrar o aceite: " + error.message, "error"); return; }
    await verificar();
  }

  async function sair() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  if (estado === 'verificando') {
    return (
      <div className="min-h-[100dvh] bg-canvas flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-ink-3 animate-spin" />
      </div>
    );
  }

  if (estado === 'liberado') return <>{children}</>;

  return (
    <div className="min-h-[100dvh] bg-canvas flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md sheet-panel rounded-card p-7 shadow-[0_24px_60px_rgba(0,0,0,0.65)] relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-brand/10 rounded-full blur-3xl pointer-events-none"></div>

        {estado === 'precisa-convite' ? (
          <div className="relative z-10">
            <div className="w-12 h-12 bg-brand/10 border border-brand/20 rounded-inner flex items-center justify-center mb-5">
              <KeyRound className="w-5 h-5 text-brand" />
            </div>

            <h1 className="text-xl font-bold text-ink mb-2">O Nexa está em beta fechado</h1>
            <p className="text-sm text-ink-2 leading-relaxed mb-6">
              Por enquanto o acesso é só por convite. Se você recebeu um código, digite abaixo — ele precisa ter sido emitido para este mesmo e-mail.
            </p>

            <form onSubmit={resgatar} className="flex flex-col gap-3">
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="NEXA-ABC1"
                aria-label="Código do convite"
                className="w-full bg-black/40 border border-white/10 rounded-field py-3 px-4 text-ink text-center text-lg font-bold tracking-widest placeholder:text-ink-3 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-brand transition-colors"
              />
              <button
                type="submit"
                disabled={isBusy}
                className="w-full bg-brand hover:bg-brand text-ink font-bold py-3.5 rounded-field transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar com o convite'}
              </button>
            </form>

            <button onClick={sair} className="w-full mt-4 text-xs text-ink-3 hover:text-ink-2 transition-colors cursor-pointer flex items-center justify-center gap-1.5 py-2">
              <LogOut className="w-3.5 h-3.5" /> Sair desta conta
            </button>
          </div>
        ) : (
          <div className="relative z-10">
            <div className="w-12 h-12 bg-pos/10 border border-pos/20 rounded-inner flex items-center justify-center mb-5">
              <ShieldCheck className="w-5 h-5 text-pos" />
            </div>

            <h1 className="text-xl font-bold text-ink mb-2">Antes de começar</h1>
            <p className="text-sm text-ink-2 leading-relaxed mb-5">
              O Nexa guarda informações financeiras suas. Leia como tratamos esses dados antes de continuar.
            </p>

            <div className="flex flex-col gap-2 mb-5">
              <a href="/termos" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-field px-4 py-3 text-sm text-ink-2 hover:text-ink transition-colors">
                <FileText className="w-4 h-4 text-brand shrink-0" /> Termos de uso
              </a>
              <a href="/privacidade" target="_blank" rel="noreferrer" className="flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-field px-4 py-3 text-sm text-ink-2 hover:text-ink transition-colors">
                <FileText className="w-4 h-4 text-pos shrink-0" /> Política de privacidade
              </a>
            </div>

            <label className="flex items-start gap-3 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={aceitou}
                onChange={e => setAceitou(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-brand shrink-0 cursor-pointer"
              />
              <span className="text-xs text-ink-2 leading-relaxed">
                Li e aceito os termos de uso e a política de privacidade.
              </span>
            </label>

            <button
              onClick={aceitarTermos}
              disabled={!aceitou || isBusy}
              className="w-full bg-pos hover:bg-pos text-ink font-bold py-3.5 rounded-field transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continuar'}
            </button>

            <button onClick={sair} className="w-full mt-3 text-xs text-ink-3 hover:text-ink-2 transition-colors cursor-pointer py-2">
              Sair desta conta
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
