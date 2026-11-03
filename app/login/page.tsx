"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, KeyRound, MailCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { toast } from "../../components/Toast";

/**
 * O Supabase devolve erro de cadastro em inglês e em tom técnico. Mostrar isso
 * cru ("Password should be at least 6 characters") faz a pessoa achar que o app
 * quebrou, em vez de entender que falta corrigir algo simples.
 *
 * O que não for reconhecido cai no texto original: esconder um erro
 * desconhecido atrás de "algo deu errado" só dificulta o suporte depois.
 */
/**
 * Falhas que não dependem do fluxo: valem igual no cadastro, no login e no
 * envio de e-mail. `null` quando não há tradução conhecida.
 *
 * `Failed to fetch` merece destaque: não é credencial nem validação, é o
 * navegador não ter conseguido FALAR com o Supabase. Aconteceu de verdade
 * quando o projeto do plano free pausou por inatividade e o app inteiro caiu
 * — e, sem esta linha, a tela acusava o usuário de erro de digitação.
 */
function traduzErroComum(m: string): string | null {
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas seguidas. Espere alguns minutos.";
  if (m.includes("failed to fetch") || m.includes("network") || m.includes("fetch failed"))
    return "Não consegui falar com o servidor. Confira sua conexão — se ela estiver boa, o serviço pode estar fora do ar.";
  return null;
}

function mensagemDeCadastro(mensagem: string): string {
  const m = mensagem.toLowerCase();
  const comum = traduzErroComum(m);
  if (comum) return comum;
  if (m.includes("password") && /\d/.test(m)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("weak password")) return "Essa senha é fraca demais. Misture letras e números.";
  if (m.includes("valid email") || m.includes("invalid email")) return "Esse e-mail não parece válido.";
  return "Não consegui criar a conta: " + mensagem;
}

/**
 * Erros ao disparar e-mail (recuperação de senha, reenvio de confirmação).
 *
 * Existe porque esses dois fluxos reusavam `mensagemDeCadastro` e respondiam
 * "Não consegui criar a conta" a quem tinha clicado em "Esqueceu a senha?".
 */
function mensagemDeEmail(mensagem: string): string {
  const m = mensagem.toLowerCase();
  const comum = traduzErroComum(m);
  if (comum) return comum;
  if (m.includes("valid email") || m.includes("invalid email")) return "Esse e-mail não parece válido.";
  return "Não consegui enviar o e-mail: " + mensagem;
}

/**
 * Erros de login, separados por causa.
 *
 * Antes TODO erro virava "E-mail ou senha incorretos", inclusive os que não
 * tinham nada a ver com a senha. O pior deles é `Email not confirmed`: a
 * senha está certa, falta clicar no link do e-mail — e a pessoa passa a
 * tentar senhas diferentes, ou pede recuperação, sem nunca chegar perto do
 * problema real.
 *
 * `null` significa que o caso tem tratamento próprio na tela, com aviso fixo
 * em vez de toast.
 *
 * Credencial inválida continua genérica de propósito: dizer QUAL dos dois
 * está errado confirmaria a estranhos que aquele e-mail tem conta.
 */
function mensagemDeLogin(mensagem: string): string | null {
  const m = mensagem.toLowerCase();
  if (m.includes("not confirmed") || m.includes("email_not_confirmed")) return null;
  const comum = traduzErroComum(m);
  if (comum) return comum;
  if (m.includes("disabled")) return "O login por e-mail e senha está desativado nesta instalação.";
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "E-mail ou senha incorretos.";
  return "Não consegui entrar: " + mensagem;
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [aviso, setAviso] = useState<null | "email-ja-usado" | "nao-confirmado">(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleAuth = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setAviso(null);

    if (isRegistering) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);

      // O Supabase sinaliza e-mail repetido de DUAS formas, conforme a opção
      // "Confirm email" do projeto:
      //
      //   desligada → erro "User already registered"
      //   ligada    → SUCESSO com identities vazio, de propósito, para não
      //               revelar a estranhos que aquela conta existe
      //
      // Só o primeiro caso era tratado, e mesmo assim mostrando o texto em
      // inglês. No segundo, a tela dizia "Conta criada com sucesso" para quem
      // já tinha conta — e a pessoa ficava tentando entrar com uma senha que
      // nunca chegou a existir. Os dois são verificados porque essa opção muda
      // no painel sem ninguém tocar no código.
      const jaExiste =
        /already registered|already been registered/i.test(error?.message ?? "") ||
        (!error && data.user?.identities?.length === 0);

      if (jaExiste) {
        setAviso("email-ja-usado");
        setIsRegistering(false);
        setPassword("");
        return;
      }

      if (error) {
        toast(mensagemDeCadastro(error.message), "error");
        return;
      }

      toast("Conta criada com sucesso! Faça seu login.", "success");
      setIsRegistering(false);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const texto = mensagemDeLogin(error.message);
        // `null` = e-mail não confirmado. Vai em aviso fixo com o botão de
        // reenviar, porque é o único caso em que a pessoa precisa AGIR fora
        // desta tela — toast sumiria antes de ela entender o que fazer.
        if (texto === null) setAviso("nao-confirmado");
        else toast(texto, "error");
        setLoading(false);
      } else {
        // Mostra a tela de splash e redireciona depois
        setIsSuccess(true);
        setTimeout(() => {
          window.location.href = "/";
        }, 2500);
      }
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast("Digite seu e-mail primeiro para recuperar a senha.", "warning");
      return;
    }

    setIsResetting(true);
    // Sem o redirectTo, o link do e-mail caía no dashboard e a pessoa nunca
    // via onde trocar a senha — o fluxo existia mas não terminava em lugar
    // nenhum.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/recuperar-senha`,
    });
    setIsResetting(false);

    // O Supabase responde sucesso mesmo para e-mail inexistente, de propósito:
    // uma resposta diferente revelaria quem tem conta. A mensagem abaixo
    // acompanha isso e não afirma que o e-mail foi mesmo encontrado.
    if (error) toast(mensagemDeEmail(error.message), "error");
    else toast("Se existir conta com esse e-mail, o link de redefinição chegou nele. 📧", "success");
  };

  /**
   * Reenvia o e-mail de confirmação de cadastro.
   *
   * Existe porque a confirmação é a causa mais silenciosa de "não consigo
   * entrar": a senha está certa, o e-mail se perdeu no spam, e sem um jeito
   * de pedir outro a conta fica inacessível para sempre.
   */
  const reenviarConfirmacao = async () => {
    if (!email) {
      toast("Digite seu e-mail primeiro.", "warning");
      return;
    }
    setIsResetting(true);
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    setIsResetting(false);

    if (error) toast(mensagemDeEmail(error.message), "error");
    else toast("Enviei de novo. Confira a caixa de entrada e o spam. 📧", "success");
  };

  /**
   * Login com Google.
   *
   * Exige o provedor habilitado no painel do Supabase (Authentication →
   * Providers → Google) com as credenciais do Google Cloud. Sem isso o botão
   * devolve erro do próprio Supabase, e a mensagem abaixo explica o que fazer
   * em vez de mostrar um erro técnico ao usuário final.
   */
  const handleGoogle = async () => {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setIsGoogleLoading(false);
      toast(
        error.message?.toLowerCase().includes('provider')
          ? "Login com Google ainda não está habilitado nesta instalação."
          : "Erro ao entrar com Google: " + error.message,
        "error",
      );
    }
    // Em caso de sucesso o navegador é redirecionado; não há o que fazer aqui.
  };

  if (isSuccess) {
    return (
      <div className="min-h-[100dvh] bg-canvas flex flex-col items-center justify-center p-4 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", bounce: 0.5 }} className="flex flex-col items-center relative z-10">
          <div className="w-24 h-24 rounded-card flex items-center justify-center shadow-[0_0_60px_rgba(99,102,241,0.4)] mb-8 overflow-hidden bg-white/5 border border-white/10">
            <img src="/icon-192.png" alt="Logo Nexa" className="w-full h-full object-cover" />
          </div>
          
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center flex flex-col items-center">
            <h2 className="text-3xl font-semibold text-ink mb-3 tracking-tight">Bem-vindo de volta</h2>
            <div className="flex items-center gap-3 text-ink-2 bg-white/5 px-4 py-2 rounded-full border border-white/10">
              <Loader2 className="w-4 h-4 animate-spin text-brand" /> 
              <span className="text-sm font-medium">Preparando seu espaço financeiro...</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-canvas flex flex-col items-center justify-center p-4 selection:bg-brand/30">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-inner flex items-center justify-center shadow-lg shadow-brand/20 mb-6 overflow-hidden bg-white/5 border border-white/10">
            <img src="/icon-192.png" alt="Logo Nexa" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-ink mb-2 tracking-tight">Nexa</h1>
          <p className="text-ink-2 text-center text-sm">Inteligência Financeira ao seu dispor.</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white/5 border border-white/10 rounded-card p-8 backdrop-blur-sm shadow-2xl relative overflow-hidden">
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand/[0.06] rounded-full blur-3xl pointer-events-none"></div>
          
          {/* Aviso fixo, não toast: o toast some sozinho e aqui a pessoa
              precisa ler e decidir o que fazer. O botão de recuperar fica
              junto do texto para não exigir que ela procure o "Esqueceu a
              senha?" logo depois de ler que já tem conta. */}
          <AnimatePresence>
            {aviso && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 20 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                role="alert"
                className="relative z-10 overflow-hidden"
              >
                <div className="rounded-field border border-warn/30 bg-warn/10 p-4">
                  {aviso === 'email-ja-usado' ? (
                    <>
                      <p className="text-sm font-semibold text-warn">Esse e-mail já tem conta no Nexa</p>
                      <p className="mt-1 text-xs leading-relaxed text-warn/70">
                        Entre com a sua senha aqui embaixo. Se não lembrar, dá para receber um link
                        de redefinição. E se você criou a conta pelo Google, use o botão
                        &ldquo;Continuar com Google&rdquo;.
                      </p>
                      <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={isResetting}
                        className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-warn hover:text-warn disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {isResetting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <KeyRound className="w-3.5 h-3.5" />}
                        Recuperar minha senha
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold text-warn">Falta confirmar seu e-mail</p>
                      <p className="mt-1 text-xs leading-relaxed text-warn/70">
                        A senha está certa. O que falta é abrir o e-mail que enviamos quando você
                        criou a conta e clicar no link de confirmação. Procure também no spam —
                        é onde ele costuma cair.
                      </p>
                      <button
                        type="button"
                        onClick={reenviarConfirmacao}
                        disabled={isResetting}
                        className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-warn hover:text-warn disabled:opacity-60 transition-colors cursor-pointer"
                      >
                        {isResetting
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <MailCheck className="w-3.5 h-3.5" />}
                        Reenviar e-mail de confirmação
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleAuth} className="flex flex-col gap-5 relative z-10">
            <div>
              <label className="text-sm font-medium text-ink-2 mb-2 block">Seu E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-3" />
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={e => { setEmail(e.target.value); setAviso(null); }}
                  className="w-full bg-black/50 border border-white/10 rounded-field py-3 pl-12 pr-4 text-ink focus:outline-none focus:border-brand transition-colors"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-ink-2 mb-2 flex justify-between">
                Sua Senha
                {!isRegistering && (
                  <button type="button" onClick={handleResetPassword} className="text-brand hover:text-brand text-xs transition-colors">Esqueceu a senha?</button>
                )}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-3" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-field py-3 pl-12 pr-12 text-ink focus:outline-none focus:border-brand transition-colors"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-brand hover:bg-brand text-ink font-bold py-3.5 rounded-field flex items-center justify-center gap-2 transition-all mt-4 disabled:opacity-50 shadow-lg shadow-brand/25 active:scale-95">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  {isRegistering ? 'Criar minha conta' : 'Entrar no Sistema'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5 relative z-10">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-xs text-ink-3">ou</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={isGoogleLoading}
            className="w-full relative z-10 bg-white hover:bg-neutral-100 text-neutral-900 font-bold py-3.5 rounded-field flex items-center justify-center gap-3 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {/* SVG oficial do Google: usar um ícone genérico aqui quebra a
                    diretriz de marca deles e o usuário não reconhece o botão. */}
                <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continuar com Google
              </>
            )}
          </button>

          <div className="mt-8 text-center relative z-10">
            <p className="text-ink-2 text-sm">
              {isRegistering ? 'Já tem uma conta?' : 'Não tem conta ainda?'}
              <button onClick={() => { setIsRegistering(!isRegistering); setAviso(null); }} className="text-brand hover:text-brand font-bold ml-2 transition-colors">
                {isRegistering ? 'Faça Login' : 'Cadastre-se'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
