"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { CheckCircle2, Clock, Edit2, FileText, Loader2, Trash2 } from "lucide-react";

import { Money } from "./ui/Money";
import { IconeSubcategoria } from "./ui/IconeSubcategoria";
import { toast } from "./Toast";
import { getReceiptUrl } from "../lib/receipts";

function ReceiptButton({ stored }: { stored: string }) {
  const [isOpening, setIsOpening] = useState(false);

  const open = async () => {
    setIsOpening(true);
    const url = await getReceiptUrl(stored);
    setIsOpening(false);
    if (!url) {
      toast("Não consegui abrir este comprovante.", "error");
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // `pointer-events-auto`: a camada de conteúdo da linha é transparente ao
  // ponteiro; sem isto o toque aqui cairia no botão sobreposto da linha. O
  // pseudoelemento leva a área de toque a 44px sem crescer o botão visualmente.
  return (
    <button
      onClick={open}
      disabled={isOpening}
      aria-label="Abrir comprovante"
      title="Abrir comprovante"
      className="pointer-events-auto relative p-2 text-brand/50 hover:text-brand hover:bg-brand/10 rounded-field transition-colors cursor-pointer shrink-0 disabled:opacity-50 after:absolute after:-inset-1.5 after:content-['']"
    >
      {isOpening ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
    </button>
  );
}

interface TransactionRowProps {
  title: string | null;
  category: string | null;
  date: string;
  amount: number;
  visible: boolean;
  type: 'income' | 'expense';
  isPaid?: boolean;
  onTogglePaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
  receiptUrl?: string | null;
  subcategoria?: string | null;
  modoSelecao: boolean;
  selecionado: boolean;
  onToggleSelecao: () => void;
  acoesVisiveis: boolean;
  onAlternarAcoes: () => void;
}

// Alvo dos botões de ação: compacto com cursor, 44px reais no toque.
const BOTAO_ACAO =
  'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full p-2 transition-colors pointer-coarse:h-11 pointer-coarse:w-11 pointer-coarse:p-0';

/**
 * Linha de lançamento, em duas camadas (tudo em CSS, sem decisão de layout em JS):
 *
 *   [1] botão sobreposto (absolute inset-0 z-10): a linha inteira é o alvo do
 *       toque que revela as ações. Só existe no modo toque.
 *   [2] conteúdo (z-20) com `pointer-events-none`: é transparente ao ponteiro,
 *       então o toque sobre o texto ou o valor chega ao botão de baixo. Todo
 *       elemento interativo dentro dele (ReceiptButton, checkbox) precisa de
 *       `pointer-events-auto`, senão deixa de responder.
 *   [3] grupo de ações: irmão direto da linha (não filho do bloco do valor)
 *       porque no toque ele vira uma segunda linha, `basis-full`.
 *
 * REVELAÇÃO POR TIPO DE PONTEIRO, NÃO POR LARGURA
 * Com cursor (`pointer-fine`) as ações nascem em `opacity-0` e aparecem no
 * hover ou no foco por teclado — não é bug. Nunca `hidden`/`invisible`/
 * `aria-hidden` ali: os botões precisam seguir no DOM e alcançáveis por Tab.
 * No toque (`pointer-coarse`) é uma disclosure de verdade: o botão sobreposto
 * abre e fecha a segunda linha. Um corte por `sm:`/`md:` prenderia as ações em
 * `opacity-0` num tablet de toque de 834px, porque o `group-hover:` do Tailwind
 * v4 já vem dentro de `@media (hover: hover)` e nunca dispara ali.
 *
 * ORDEM x ESPECIFICIDADE — a revelação depende disto
 * No CSS gerado o `pointer-fine:opacity-0` aparece DEPOIS das regras de
 * `group-hover:`/`group-focus-within:`, então ele só não vence porque estas
 * medem 0,2,0 (`:is(:where(.group):hover *)` + a classe) contra 0,1,0 dele.
 * Trocar `group-hover:` por um seletor de classe única mata a revelação com
 * cursor, e o sintoma seria "as ações nunca aparecem no desktop".
 */
export function TransactionRow({ title, category, date, amount, visible, type, isPaid, onTogglePaid, onDelete, onEdit, receiptUrl, subcategoria, modoSelecao, selecionado, onToggleSelecao, acoesVisiveis, onAlternarAcoes }: TransactionRowProps) {
  const isIncome = type === 'income';
  const idAcoes = useId();
  const botaoRef = useRef<HTMLButtonElement>(null);

  // Esc fecha as ações abertas e devolve o foco ao botão da linha: sem isso o
  // foco ficaria num botão que acabou de sumir (display: none).
  const aoTeclar = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && acoesVisiveis) {
      botaoRef.current?.focus();
      onAlternarAcoes();
    }
  };

  return (
    <div
      onClick={modoSelecao ? onToggleSelecao : undefined}
      onKeyDown={aoTeclar}
      className={`group relative flex flex-wrap items-center gap-x-2 gap-y-2 overflow-hidden rounded-inner px-2 py-3 transition-colors ${modoSelecao ? 'cursor-pointer' : ''} ${
        selecionado ? 'bg-brand/10' : 'hover:bg-white/[0.03]'
      }`}
    >
      {/* [1] Só no toque e fora da seleção. `-outline-offset-2` porque o
          `outline-offset: 2px` global seria cortado pelo `overflow-hidden`. */}
      {!modoSelecao && (
        <button
          ref={botaoRef}
          type="button"
          onClick={onAlternarAcoes}
          aria-expanded={acoesVisiveis}
          aria-controls={idAcoes}
          aria-label={`Ações de ${title || 'lançamento'}`}
          className="absolute inset-0 z-10 cursor-pointer rounded-inner focus-visible:-outline-offset-2 pointer-fine:hidden"
        />
      )}

      {/* [2] Esquerda: Icone e Textos. Em 360px+ o bloco divide a linha com o
          valor; abaixo disso ocupa a linha toda e o valor desce, à direita,
          de forma controlada (decisão de projeto, não regressão). */}
      <div className="pointer-events-none relative z-20 flex min-w-0 flex-[1_1_100%] items-center gap-2.5 xs:flex-[1_1_0%] xs:gap-3">
        {modoSelecao && (
          <input
            type="checkbox"
            checked={!!selecionado}
            onChange={onToggleSelecao}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Selecionar ${title || 'lançamento'}`}
            className="pointer-events-auto h-5 w-5 shrink-0 cursor-pointer rounded border-white/20 bg-white/5 text-brand"
          />
        )}
        {/* Ícone do ASSUNTO, não da direção: a direção já está na cor do
            valor, à direita. Trinta setas iguais numa fatura não ajudam a
            achar nada; um carrinho e um carro, sim. */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-ink-2 xs:h-10 xs:w-10">
          <IconeSubcategoria subcategoria={subcategoria} categoria={category} ehReceita={isIncome} />
        </div>

        <div className="flex min-w-0 flex-col">
          {/* O título só trunca; o selo de pendência fica na linha de baixo. */}
          <h4 className="truncate text-[15px] font-medium leading-snug text-ink">
            {title || "Sem título"}
          </h4>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
            {/* Pendência era um ponto âmbar de 6px (com legenda separada e um
                `sr-only` "(não paga)" no título): cor sozinha, e a legenda
                só ensinava o código. Agora é texto real, que dispensa
                legenda e vale para todo mundo. O `sr-only` saiu justamente
                para o leitor de tela não anunciar a pendência duas vezes.
                "Não recebida" porque `isPaid` também vale para entradas. */}
            {isPaid === false && (
              <span className="shrink-0 rounded-full bg-warn/15 px-1.5 py-0.5 text-[11px] font-medium text-warn">
                {isIncome ? 'Não recebida' : 'Não paga'}
              </span>
            )}
            {/* Ordem de degradação: só a subcategoria trunca. */}
            <span className="truncate">{subcategoria || category || "Sem categoria"}</span>
            <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-ink-3" />
            <span className="shrink-0">{date || "Sem data"}</span>
          </div>
        </div>
      </div>

      {/* [2] Direita: valor e comprovante. O comprovante fica sempre visível
          (é informação, não só ação), fora do grupo que se revela. */}
      <div className="pointer-events-none relative z-20 flex w-full shrink-0 items-center justify-end gap-1 xs:w-auto">
        <Money
          value={amount}
          visible={visible}
          sinal={isIncome ? 'entrada' : 'saida'}
          tom={isIncome ? 'pos' : 'ink'}
          className="whitespace-nowrap text-sm font-semibold tracking-tight xs:text-[15px]"
        />
        {!modoSelecao && receiptUrl && <ReceiptButton stored={receiptUrl} />}
      </div>

      {/* [3] Ações. Em seleção a linha inteira é o alvo do toque (onClick de
          seleção), então nem o botão sobreposto, nem este grupo, nem o
          comprovante existem: manter lápis e lixeira aqui só cria acidente,
          um deles apaga um item enquanto a pessoa acha que está marcando.
          Com cursor: espaço sempre reservado (o valor não salta no hover),
          revelado por hover ou foco. No toque: segunda linha, só quando
          aberta. */}
      {!modoSelecao && (
        <div
          id={idAcoes}
          className={`relative z-20 flex shrink-0 items-center justify-end gap-1 transition-opacity duration-150 ease-out motion-reduce:transition-none pointer-fine:pointer-events-none pointer-fine:opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 ${
            acoesVisiveis
              ? 'pointer-coarse:mt-1 pointer-coarse:w-full pointer-coarse:basis-full pointer-coarse:justify-between pointer-coarse:border-t pointer-coarse:border-line pointer-coarse:pt-2'
              : 'pointer-coarse:hidden'
          }`}
        >
          {isPaid !== undefined && (
            <button
              onClick={onTogglePaid}
              aria-label={isPaid ? 'Marcar como pendente' : 'Marcar como pago'}
              className={`${BOTAO_ACAO} hover:bg-white/5 ${isPaid ? 'text-ink-3 hover:text-pos' : 'text-warn'}`}
            >
              {isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            </button>
          )}
          <button onClick={onEdit} aria-label="Editar" className={`${BOTAO_ACAO} text-ink-3 hover:bg-white/5 hover:text-ink`}><Edit2 className="h-4 w-4" /></button>
          <button onClick={onDelete} aria-label="Excluir" className={`${BOTAO_ACAO} text-ink-3 hover:bg-neg/10 hover:text-neg`}><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
