/**
 * Superfícies base do sistema.
 *
 * Existem para que cartão, cabeçalho de seção, estado vazio e esqueleto
 * tenham UMA definição cada. Antes a marcação estava copiada à mão em dezenas
 * de arquivos, e qualquer ajuste de estilo exigia repetir o mesmo edit.
 */

import type { ReactNode } from 'react';

/* --------------------------------------------------------------------------
   Cartão
   -------------------------------------------------------------------------- */

interface CardProps {
  children: ReactNode;
  /** Abre com a névoa fria. Um por tela, no bloco principal. */
  hero?: boolean;
  className?: string;
}

export function Card({ children, hero = false, className = '' }: CardProps) {
  return (
    <div className={`${hero ? 'card-hero' : 'card'} relative overflow-hidden p-5 ${className}`}>
      {hero && <span aria-hidden className="hero-mist" />}
      <div className="relative">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Cabeçalho de seção

   Título à esquerda, ação discreta à direita. Sem linha divisória: a
   separação é o espaço.
   -------------------------------------------------------------------------- */

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
}

export function SectionHeader({ title, action, children }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      {action ? (
        <button
          onClick={action.onClick}
          className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-ink-2 transition-colors hover:text-ink cursor-pointer"
        >
          {action.label}
        </button>
      ) : (
        children
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Estado vazio

   Toda lista e todo gráfico precisam do seu. Uma ação só: duas opções num
   lugar onde ainda não há nada apenas adiam a decisão.
   -------------------------------------------------------------------------- */

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-ink-3">
        {icon}
      </div>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-ink-2">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 cursor-pointer rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-brand-strong"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Esqueleto

   No formato do conteúdo que vai chegar, não um retângulo genérico: o salto
   de layout ao carregar é o que faz o app parecer instável.
   -------------------------------------------------------------------------- */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-inner bg-white/5 ${className}`} />;
}

/** Esqueleto de uma linha de lançamento: círculo, duas linhas, valor. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-1 py-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-20 shrink-0" />
    </div>
  );
}
