"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Lock, Eye, EyeOff, Loader2, Check, AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "../../components/Toast";

/**
 * Definição de nova senha, após o link de recuperação.
 *
 * Esta tela não existia. O app chamava `resetPasswordForEmail`, o e-mail era
 * enviado, a pessoa clicava — e caía no dashboard já logada, sem nunca ver
 * onde trocar a senha. Na prática só funcionava para quem adivinhasse que
 * precisava ir em Ajustes.
 *
 * O Supabase entrega o token de recuperação no HASH da URL
 * (#access_token=...&type=recovery) e o cliente o consome sozinho, criando
 * uma sessão temporária. Por isso aqui basta chamar updateUser — mas só
 * depois de confirmar que a sessão existe, senão a troca falha em silêncio.
 */
export default function RecuperarSenhaPage() {
  const [estado, setEstado] = useState<'verificando' | 'pronto' | 'invalido' | 'concluido'>('verificando');
  const [password, setPassword] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // O cliente processa o hash de forma assíncrona; escutar o evento é mais
    // confiável do que ler a sessão imediatamente.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setEstado('pronto');
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setEstado(prev => (prev === 'pronto' ? prev : session ? 'pronto' : 'invalido'));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast("A senha precisa de pelo menos 6 caracteres.", "warning");
      return;
    }
    if (password !== confirmacao) {
      toast("As duas senhas não são iguais.", "warning");
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsSaving(false);

    if (error) {
      toast("Não consegui trocar a senha: " + error.message, "error");
      return;
    }
    setEstado('concluido');
  };

  return (
    <div className="min-h-[100dvh] bg-canvas flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-surface border border-white/10 rounded-card p-7 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-brand/[0.06] rounded-full blur-3xl pointer-events-none"></div>

        {estado === 'verificando' && (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 text-ink-3 animate-spin" />
          </div>
        )}

        {estado === 'invalido' && (
          <div className="relative z-10 text-center">
            <div className="w-12 h-12 bg-warn/10 border border-warn/20 rounded-inner flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="w-6 h-6 text-warn" />
            </div>
            <h1 className="text-lg font-bold text-ink mb-2">Link expirado ou já usado</h1>
            <p className="text-sm text-ink-2 leading-relaxed mb-6">
              Links de recuperação valem por pouco tempo e só podem ser usados uma vez. Peça um novo na tela de login.
            </p>
            <a href="/login" className="block w-full bg-brand text-canvas font-bold py-3.5 rounded-field hover:bg-brand-strong transition-colors">
              Voltar ao login
            </a>
          </div>
        )}

        {estado === 'concluido' && (
          <div className="relative z-10 text-center">
            <div className="w-12 h-12 bg-pos/10 border border-pos/20 rounded-inner flex items-center justify-center mx-auto mb-5">
              <Check className="w-6 h-6 text-pos" />
            </div>
            <h1 className="text-lg font-bold text-ink mb-2">Senha alterada</h1>
            <p className="text-sm text-ink-2 leading-relaxed mb-6">
              Já pode entrar com a nova senha.
            </p>
            <a href="/" className="block w-full bg-brand hover:bg-brand text-ink font-bold py-3.5 rounded-field transition-colors">
              Ir para o app
            </a>
          </div>
        )}

        {estado === 'pronto' && (
          <form onSubmit={salvar} className="relative z-10">
            <div className="w-12 h-12 bg-brand/10 border border-brand/20 rounded-inner flex items-center justify-center mb-5">
              <Lock className="w-5 h-5 text-brand" />
            </div>

            <h1 className="text-xl font-bold text-ink mb-2">Criar nova senha</h1>
            <p className="text-sm text-ink-2 leading-relaxed mb-6">
              Escolha uma senha nova para a sua conta.
            </p>

            <div className="flex flex-col gap-3">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Nova senha"
                  autoFocus
                  aria-label="Nova senha"
                  className="w-full bg-black/40 border border-white/10 rounded-field py-3 pl-11 pr-11 text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmacao}
                  onChange={e => setConfirmacao(e.target.value)}
                  placeholder="Repita a nova senha"
                  aria-label="Repita a nova senha"
                  className="w-full bg-black/40 border border-white/10 rounded-field py-3 pl-11 pr-4 text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>
            </div>

            <p className="text-xs text-ink-3 mt-3 leading-relaxed">
              Pelo menos 6 caracteres. Repetir a senha evita salvar um erro de digitação que te trancaria para fora.
            </p>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full mt-5 bg-brand hover:bg-brand text-ink font-bold py-3.5 rounded-field transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
