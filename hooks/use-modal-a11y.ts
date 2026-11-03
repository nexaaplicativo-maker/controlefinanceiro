import { useEffect, useRef } from 'react';

/**
 * Comportamento compartilhado de modal: Esc, focus trap, devolução do foco e
 * botão voltar do Android.
 *
 * ACESSIBILIDADE
 * A varredura encontrava 1 atributo aria no app inteiro e nenhum modal que
 * fechasse com Esc. Sem focus trap, o teclado continuava navegando pelos
 * elementos ATRÁS do modal aberto.
 *
 * BOTÃO VOLTAR
 * Como o app é todo feito de modais e não de rotas, o voltar do Android
 * fechava o APP inteiro em vez do modal — o usuário achava que tinha perdido
 * o que estava fazendo. Aqui cada modal aberto empurra uma entrada no
 * histórico e se fecha no popstate.
 *
 * Isto não substitui rotas de verdade (não dá URL própria nem link
 * compartilhável), mas resolve o atrito que se sente todo dia.
 *
 * Uso:
 *   const ref = useModalA11y(isOpen, onClose);
 *   <motion.div ref={ref} role="dialog" aria-modal="true" aria-label="...">
 */
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // `onClose` costuma ser uma arrow inline — identidade nova a cada render.
  // Se ela entrasse nas dependências, o efeito reexecutaria sem parar e
  // empilharia uma entrada de histórico por render. A ref mantém a função
  // sempre atual sem disparar o efeito.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement;

    const focusables = () => {
      const node = containerRef.current;
      if (!node) return [] as HTMLElement[];
      return Array.from(
        node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(el => el.offsetParent !== null);
    };

    focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;

      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };

    // --- botão voltar ---
    let closedByBackButton = false;
    let pushed = false;
    let active = true;

    const onPopState = () => {
      closedByBackButton = true;
      onCloseRef.current();
    };

    /**
     * A entrada no histórico entra no tique seguinte, não agora.
     *
     * Em desenvolvimento o modo estrito monta, desmonta e remonta todo efeito.
     * Empurrando no mesmo tique, o `history.back()` da limpeza falsa chegava
     * DEPOIS da segunda montagem, e o `popstate` dele caía no ouvinte novo:
     * todo modal abria e se fechava sozinho em menos de um segundo.
     *
     * Adiando um tique, a montagem falsa cancela o agendamento antes de
     * empurrar coisa alguma — não há entrada para desfazer nem popstate para
     * chegar atrasado. Em produção, onde o efeito roda uma vez só, o
     * comportamento é o mesmo de antes.
     */
    const agendamento = setTimeout(() => {
      if (!active) return;
      window.history.pushState({ nexaModal: true }, '');
      pushed = true;
      window.addEventListener('popstate', onPopState);
    }, 0);

    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      active = false;
      clearTimeout(agendamento);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('popstate', onPopState);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();

      // Fechou pelo X, Esc ou clique fora: a entrada que empurramos continua
      // no histórico e precisa sair, senão o usuário teria que apertar voltar
      // duas vezes para sair da tela. Só desfaz o que chegou a ser empurrado.
      if (pushed && !closedByBackButton) window.history.back();
    };
  }, [isOpen]);

  return containerRef;
}
