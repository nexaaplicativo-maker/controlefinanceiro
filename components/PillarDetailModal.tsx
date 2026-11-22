"use client";

import { TrendingUp, TrendingDown, Inbox, Edit2 } from "lucide-react";
import { Sheet } from "./ui/Sheet";
import { EmptyState } from "./ui/Surface";
import { formatMoney } from "../lib/format";

/**
 * Os lançamentos por trás de um número do topo.
 *
 * O painel mostrava "Cartões & Variáveis: R$ 3.637,19" e mandava cortar ali
 * primeiro — sem dizer o que compunha o valor. Para descobrir, a pessoa tinha
 * que rolar até a lista do mês e somar de cabeça.
 *
 * ORDEM POR VALOR, NÃO POR DATA
 * Quem abre isto quer saber ONDE cortar, não o que aconteceu primeiro. Em
 * ordem cronológica a resposta fica enterrada no meio da lista; do maior para
 * o menor, ela é a primeira linha.
 *
 * EDITAR SEM SAIR DAQUI
 * Quem revisa os lançamentos é quem percebe o valor digitado errado ou a
 * categoria trocada. Mandar procurar o mesmo item na lista do mês para
 * corrigir devolvia o atrito que esta tela existe para remover.
 *
 * Apagar continua de fora: numa tela de conferência, com as linhas próximas e
 * o dedo no celular, a lixeira ao lado do lápis é clique errado esperando
 * acontecer. Apagar segue na lista do mês, onde a intenção é gerenciar.
 *
 * A CASCA VEM DA FOLHA
 * Fundo, painel, alça, cabeçalho, X, rolagem, trap de foco e animação agora
 * vêm de `ui/Sheet`. Antes estavam copiados aqui à mão, como em outros 25
 * arquivos. O que sobrou neste arquivo é só o que é desta tela: a ordenação,
 * a barra proporcional e a linha de lançamento.
 *
 * Z-INDEX: o padrão da folha (50) fica abaixo do modal de edição (z-100).
 * Mais alto que ele, a edição abriria ATRÁS desta lista.
 */

type Transacao = {
  id: string;
  title?: string | null;
  category?: string | null;
  date?: string | null;
  amount: number;
  type: 'income' | 'expense';
  is_paid?: boolean | null;
};

/**
 * Só três tons, e cada um significa um estado — não a identidade do card.
 * As chaves antigas (emerald, blue, indigo) continuam aceitas para não quebrar
 * quem ainda as passa, apontando todas para o tom neutro.
 */
const ACCENTS: Record<string, { bar: string }> = {
  padrao:  { bar: 'bg-brand' },
  amber:   { bar: 'bg-warn' },
  rose:    { bar: 'bg-neg' },
  emerald: { bar: 'bg-brand' },
  blue:    { bar: 'bg-brand' },
  indigo:  { bar: 'bg-brand' },
};

export function PillarDetailModal({
  isOpen,
  onClose,
  title,
  subtitle,
  transactions,
  accent = 'indigo',
  showValues = true,
  onEdit,
  total: totalRecebido,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  transactions: Transacao[];
  accent?: string;
  showValues?: boolean;
  onEdit?: (t: Transacao) => void;
  /** Total exato calculado pela página. Quando vem, é ele que abre o corpo, e o
   *  "% do total" por item some: a lista pode misturar entradas e saídas (o
   *  "Livre na conta"), e a soma dos valores brutos não é o número do card. */
  total?: number;
}) {
  const theme = ACCENTS[accent] ?? ACCENTS.padrao;

  // Ordena uma cópia: `sort` altera no lugar, e a lista recebida é a mesma que
  // alimenta o cálculo do card. Ordenar o original mudaria a ordem no painel.
  const ordenadas = [...transactions].sort((a, b) => b.amount - a.amount);
  const total = totalRecebido ?? transactions.reduce((acc, t) => acc + t.amount, 0);
  const maior = ordenadas[0]?.amount ?? 0;
  // Lista com entradas E saídas ("Livre na conta", "Já guardado"): sem o sinal
  // por linha ninguém fecha a soma — o ícone sozinho não tem texto. As listas
  // só de saídas (fixos, gargalo) ficam exatamente como eram.
  const mistura = transactions.some(t => t.type === 'income') && transactions.some(t => t.type === 'expense');

  const dinheiro = (v: number) => (showValues ? formatMoney(v) : 'R$ •••••');

  const legenda = transactions.length === 0
    ? 'Nenhum lançamento neste mês'
    : `${transactions.length} ${transactions.length === 1 ? 'lançamento' : 'lançamentos'}${subtitle ? ` • ${subtitle}` : ''}`;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={legenda}
      largura="lg"
      footer={
        <p className="text-xs leading-snug text-ink-2">
          {onEdit
            ? 'Toque no lápis para corrigir valor ou categoria. Para apagar, use a lista do mês.'
            : 'Para editar ou apagar, use a lista de lançamentos do mês.'}
        </p>
      }
    >
      {/* O total abre o corpo em vez de morar no cabeçalho: a folha reserva o
          cabeçalho para título, apoio e ação, e é ele que mantém as 26 telas
          parecidas entre si. */}
      <p className={`mb-4 text-[32px] font-semibold tracking-[-0.02em] tnum ${totalRecebido !== undefined && total < 0 ? 'text-neg' : 'text-ink'}`}>
        {dinheiro(total)}
      </p>

      {ordenadas.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="Nada lançado aqui neste mês."
          description="Se você esperava ver algo, confira se o lançamento está na categoria certa ou em outro mês."
        />
      ) : (
        <div className="space-y-2">
          {ordenadas.map(t => {
            const fatia = total > 0 ? (t.amount / total) * 100 : 0;
            const isIncome = t.type === 'income';
            return (
              <div
                key={t.id}
                className="relative overflow-hidden rounded-inner border border-line bg-white/5 p-3"
              >
                {/* Barra proporcional ao MAIOR item, não ao total: com 30
                    lançamentos, todas as fatias contra o total viram traços
                    invisíveis e a comparação se perde. */}
                <div
                  className={`pointer-events-none absolute bottom-0 left-0 top-0 ${theme.bar} opacity-[0.07]`}
                  style={{ width: `${maior > 0 ? (t.amount / maior) * 100 : 0}%` }}
                />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-ink-2">
                      {isIncome ? <TrendingUp className="h-[18px] w-[18px]" /> : <TrendingDown className="h-[18px] w-[18px]" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {t.is_paid === false && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn" aria-hidden />
                        )}
                        <p className="truncate text-[15px] font-medium text-ink">
                          {t.title || 'Sem título'}
                          {/* O ponto âmbar sozinho não diz nada para quem usa
                              leitor de tela, nem para quem nunca viu a
                              legenda. O texto fica fora da tela e dentro da
                              frase. */}
                          {t.is_paid === false && <span className="sr-only"> (pendente)</span>}
                        </p>
                      </div>
                      {/* dd/mm, não dd/mm/aaaa: é a regra de data do sistema
                          de design, e aqui ela resolve um problema concreto.
                          Com a área de toque do lápis em 44px, o ano empurrava
                          a linha e em 360px a data saía cortada ("23/11/...").
                          O ano é redundante numa tela que já é de um mês só. */}
                      <p className="mt-0.5 truncate text-xs text-ink-2">
                        {t.category || 'Sem categoria'}
                        {t.date && ` • ${new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <div className="text-right">
                      <p className={`whitespace-nowrap text-[15px] font-semibold tnum ${mistura && isIncome ? 'text-pos' : 'text-ink'}`}>
                        {mistura && showValues && (
                          <>
                            <span aria-hidden>{isIncome ? '+ ' : '− '}</span>
                            <span className="sr-only">{isIncome ? 'entrada ' : 'saída '}</span>
                          </>
                        )}
                        {dinheiro(t.amount)}
                      </p>
                      {totalRecebido === undefined && total > 0 && showValues && (
                        <p className="mt-0.5 text-xs text-ink-2">{fatia.toFixed(0)}% do total</p>
                      )}
                    </div>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(t)}
                        aria-label={`Editar ${t.title || 'lançamento'}`}
                        /* 44x44 de área, ícone de 16px. Era `p-2` em volta de
                           um ícone de 16, ou seja 32px — abaixo do mínimo, e
                           numa lista densa onde a linha de cima está a 8px de
                           distância. A área cresce, o ícone não. */
                        className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-field text-brand/70 transition-colors hover:bg-brand/10 hover:text-brand"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
