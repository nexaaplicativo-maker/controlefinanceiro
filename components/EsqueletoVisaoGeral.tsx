import { Skeleton } from "./ui/Surface";

/**
 * Esqueleto dos dois cards do topo da Visão Geral, no formato do conteúdo:
 * a Jornada (eyebrow, título, frase, 5 círculos de 32px, bloco do próximo
 * passo) e o "Quanto sobra" (herói, renda, barra, 4 linhas). Mesma largura,
 * mesmo `p-5` e mesmo empilhamento do conteúdo carregado — o salto de layout
 * na chegada dos dados é o que faz o app parecer instável.
 *
 * Os lançamentos têm o esqueleto deles (`SkeletonRow`), dentro do próprio card.
 */
export function EsqueletoVisaoGeral() {
  return (
    <div role="status" className="mb-6">
      <span className="sr-only">Carregando seus dados</span>

      <div aria-hidden className="card mb-6 p-5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-6 w-3/5" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-4/5" />
        <div className="mt-5 flex justify-between">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-8 rounded-full" />)}
        </div>
        <Skeleton className="mt-4 h-4 w-44" />
        <div className="mt-4 border-t border-line pt-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-3 h-3 w-full rounded-full" />
          <Skeleton className="mt-4 h-12 w-full rounded-field" />
        </div>
      </div>

      <div aria-hidden className="card p-5">
        <Skeleton className="h-3.5 w-44" />
        <Skeleton className="mt-3 h-10 w-56" />
        <Skeleton className="mt-3 h-4 w-60" />
        <Skeleton className="mt-4 h-3 w-full rounded-full" />
        <div className="mt-4 flex flex-col gap-1.5">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-11 w-full" />)}
        </div>
      </div>
    </div>
  );
}
