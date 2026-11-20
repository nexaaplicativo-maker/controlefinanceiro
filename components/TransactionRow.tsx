"use client";

import { useState } from "react";
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

  return (
    <button
      onClick={open}
      disabled={isOpening}
      aria-label="Abrir comprovante"
      title="Abrir comprovante"
      className="p-2 text-brand/50 hover:text-brand hover:bg-brand/10 rounded-field transition-colors cursor-pointer shrink-0 disabled:opacity-50"
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
}

export function TransactionRow({ title, category, date, amount, visible, type, isPaid, onTogglePaid, onDelete, onEdit, receiptUrl, subcategoria, modoSelecao, selecionado, onToggleSelecao }: TransactionRowProps) {
  const isIncome = type === 'income';

  return (
    <div
      onClick={modoSelecao ? onToggleSelecao : undefined}
      className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-3 overflow-hidden rounded-inner px-2 py-3 transition-colors ${modoSelecao ? 'cursor-pointer' : ''} ${
        selecionado ? 'bg-brand/10' : 'hover:bg-white/[0.03]'
      }`}
    >

      {/* Esquerda: Icone e Textos */}
      <div className="flex min-w-0 flex-[1_1_180px] items-center gap-3">
        {modoSelecao && (
          <input
            type="checkbox"
            checked={!!selecionado}
            onChange={onToggleSelecao}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Selecionar ${title || 'lançamento'}`}
            className="h-5 w-5 shrink-0 cursor-pointer rounded border-white/20 bg-white/5 text-brand"
          />
        )}
        {/* Ícone do ASSUNTO, não da direção: a direção já está na cor do
            valor, à direita. Trinta setas iguais numa fatura não ajudam a
            achar nada; um carrinho e um carro, sim. */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-ink-2">
          <IconeSubcategoria subcategoria={subcategoria} categoria={category} ehReceita={isIncome} />
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* Pendente vira um ponto de 6px: antes era fundo âmbar na linha
                inteira mais uma etiqueta, para dizer uma coisa só. */}
            {isPaid === false && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
            )}
            <h4 className="truncate text-[15px] font-medium leading-snug text-ink">
              {title || "Sem título"}
              {/* `title` não abre no toque e leitor de tela não anuncia cor.
                  A legenda acima explica o ponto para quem enxerga; isto
                  resolve para quem não. */}
              {isPaid === false && <span className="sr-only"> (não paga)</span>}
            </h4>
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
            <span className="truncate">{subcategoria || category || "Sem categoria"}</span>
            <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-ink-3" />
            <span className="shrink-0">{date || "Sem data"}</span>
          </div>
        </div>
      </div>

      {/* Direita: Valor e Botões */}
      <div className="flex shrink-0 flex-[1_1_150px] items-center justify-end gap-1">
        <Money
          value={amount}
          visible={visible}
          sinal={isIncome ? 'entrada' : 'saida'}
          tom={isIncome ? 'pos' : 'ink'}
          className="mr-auto whitespace-nowrap text-[15px] font-semibold tracking-tight sm:mr-1"
        />
        {/* Em seleção a linha inteira é o alvo do toque. Manter lápis e lixeira
            aqui só cria acidente: um deles apaga um item enquanto a pessoa
            acha que está marcando. */}
        {!modoSelecao && (
          <>
            {isPaid !== undefined && (
              <button
                onClick={onTogglePaid}
                aria-label={isPaid ? 'Marcar como pendente' : 'Marcar como pago'}
                className={`shrink-0 cursor-pointer rounded-full p-2 transition-colors hover:bg-white/5 ${isPaid ? 'text-ink-3 hover:text-pos' : 'text-warn'}`}
              >
                {isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
              </button>
            )}
            {receiptUrl && <ReceiptButton stored={receiptUrl} />}
            <button onClick={onEdit} aria-label="Editar" className="shrink-0 cursor-pointer rounded-full p-2 text-ink-3 transition-colors hover:bg-white/5 hover:text-ink"><Edit2 className="h-4 w-4" /></button>
            <button onClick={onDelete} aria-label="Excluir" className="shrink-0 cursor-pointer rounded-full p-2 text-ink-3 transition-colors hover:bg-neg/10 hover:text-neg"><Trash2 className="h-4 w-4" /></button>
          </>
        )}
      </div>

    </div>
  );
}
