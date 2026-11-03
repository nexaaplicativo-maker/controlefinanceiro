"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";

/**
 * Captura de erro do cliente.
 *
 * Sem isto, um erro de render deixa a tela EM BRANCO — o beta tester vê um
 * app quebrado, não sabe o que houve, e você nunca fica sabendo. Em beta,
 * erro que ninguém vê é erro que ninguém corrige.
 *
 * Grava no Postgres em vez de contratar serviço externo: para 20 pessoas
 * basta, não adiciona dependência e não manda dado financeiro a terceiro.
 *
 * Precisa ser classe: `componentDidCatch` não tem equivalente em hook.
 */

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  async componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Nunca deixar o registro de erro derrubar o app de novo: se gravar
    // falhar, o usuário ainda precisa ver a tela de recuperação.
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('error_log').insert([{
        user_id: session?.user?.id ?? null,
        message: error.message?.slice(0, 500) ?? 'Erro desconhecido',
        stack: (error.stack ?? info.componentStack ?? '')?.slice(0, 4000),
        context: {
          url: typeof window !== 'undefined' ? window.location.pathname : null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          at: new Date().toISOString(),
        },
      }]);
    } catch {
      // Sem rede, sem sessão ou tabela ausente: segue com a tela amigável.
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[100dvh] bg-canvas flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-surface border border-neg/20 rounded-card p-7 text-center">
          <div className="w-12 h-12 bg-neg/10 border border-neg/20 rounded-inner flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-6 h-6 text-neg" />
          </div>

          <h1 className="text-lg font-bold text-ink mb-2">Algo quebrou aqui</h1>
          <p className="text-sm text-ink-2 leading-relaxed mb-1">
            Não foi culpa sua. O erro já foi registrado e eu vou olhar.
          </p>
          <p className="text-xs text-ink-3 leading-relaxed mb-6">
            Seus dados estão salvos — nada do que você lançou se perdeu.
          </p>

          <button
            onClick={() => window.location.reload()}
            className="w-full bg-brand text-canvas font-bold py-3.5 rounded-field hover:bg-brand-strong transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Recarregar
          </button>

          {this.state.message && (
            <p className="text-xs text-ink-3 mt-5 font-mono break-words">
              {this.state.message.slice(0, 120)}
            </p>
          )}
        </div>
      </div>
    );
  }
}
