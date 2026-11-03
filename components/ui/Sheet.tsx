"use client";

/**
 * Folha — a casca única de todas as telas que abrem por cima do painel.
 *
 * POR QUE EXISTE
 * A marcação de modal estava copiada à mão em 26 arquivos: o mesmo fundo
 * escurecido, o mesmo painel, o mesmo X no canto, cada um com uma variação
 * própria de raio, padding e sombra. Mudar o estilo dos modais custava 26
 * edições e sempre sobrava um esquecido.
 *
 * POR QUE SOBE DA BASE
 * No celular, uma caixa flutuando no meio da tela é padrão de desktop: o polegar
 * não alcança o X no topo, e a caixa fica espremida entre dois vazios. Subindo
 * da base, a folha encosta onde a mão está e o conteúdo ganha a largura toda.
 * A partir de 640px ela volta a ser uma caixa centralizada, onde isso faz
 * sentido.
 *
 * O QUE ELA NÃO FAZ
 * Não substitui rota. Continua sem URL própria e sem link compartilhável —
 * isso é a etapa de navegação, não esta.
 */

import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useModalA11y } from '../../hooks/use-modal-a11y';

const CURVA = [0.22, 1, 0.36, 1] as const;

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Linha de apoio sob o título. Uma frase, não um parágrafo. */
  subtitle?: string;
  /** Ícone à esquerda do título. */
  icon?: ReactNode;
  /** Ação à direita da barra, no lugar do X. O X some quando ela existe. */
  action?: ReactNode;
  /** Barra fixa no rodapé, fora da rolagem — para a ação que conclui a tela. */
  footer?: ReactNode;
  children: ReactNode;
  /** Largura máxima no desktop. */
  largura?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Empilhamento. O padrão (50) fica abaixo do modal de edição (100), que
   * precisa abrir POR CIMA de uma folha de listagem.
   */
  z?: number;
}

const LARGURAS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
};

export function Sheet({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  action,
  footer,
  children,
  largura = 'md',
  z = 50,
}: SheetProps) {
  const a11yRef = useModalA11y(isOpen, onClose);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4" style={{ zIndex: z }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            ref={a11yRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            // No celular desliza de baixo; no desktop só aparece, porque ali
            // ela não veio de lugar nenhum.
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.32, ease: CURVA }}
            className={`sheet-panel relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-card pb-safe sm:max-h-[86dvh] sm:rounded-card sm:pb-0 ${LARGURAS[largura]}`}
          >
            {/* Alça: diz que a folha pertence à base da tela. Só no celular,
                onde ela realmente sobe de lá. */}
            <span
              aria-hidden
              className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-white/20 sm:hidden"
            />

            <header className="flex shrink-0 items-start gap-3 px-5 pb-4 pt-4">
              {icon && <span className="mt-0.5 shrink-0 text-ink-2">{icon}</span>}

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold tracking-tight text-ink">{title}</h2>
                {subtitle && (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{subtitle}</p>
                )}
              </div>

              {action ?? (
                <button
                  onClick={onClose}
                  aria-label="Fechar"
                  className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-full p-2 text-ink-2 transition-colors hover:bg-white/5 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 scrollbar-hide">
              {children}
            </div>

            {footer && (
              <div className="shrink-0 border-t border-line px-5 py-4">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Barra de tela cheia, para quando a folha é na verdade uma tela inteira
 * (relatórios, cartões). Mesma gramática do cabeçalho da folha.
 */
export function SheetBackBar({ title, onBack, action }: { title: string; onBack: () => void; action?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-1 pb-4">
      <button
        onClick={onBack}
        aria-label="Voltar"
        className="shrink-0 cursor-pointer rounded-full bg-white/5 p-2 text-ink-2 transition-colors hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <h3 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-ink">{title}</h3>
      <span className="shrink-0">{action ?? <span className="block h-8 w-8" />}</span>
    </div>
  );
}
