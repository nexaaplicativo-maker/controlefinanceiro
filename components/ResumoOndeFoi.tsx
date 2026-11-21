"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { AI_ENABLED } from "../lib/features";
import { formatMoney } from "../lib/format";
import { resumoPorSubcategoria, NAO_CLASSIFICADO } from "../lib/subcategorias";

export interface ResumoOndeFoiProps {
  transactions: Array<{ type?: string; amount?: number; subcategoria?: string | null }>;
  showValues: boolean;
  onImportar?: () => void;
  onSelecionar?: (rotulo: string) => void;
  filtroAtivo: string | null;
}

/**
 * "Onde foi o dinheiro" — despesa do mês agrupada pelo segundo eixo.
 *
 * Existe porque `category` responde a natureza do gasto (fixo, variável,
 * cartão) e não responde onde ele aconteceu. Numa fatura de cartão importada,
 * tudo cai em "Cartões" — útil para o orçamento, inútil para saber que metade
 * foi em delivery.
 *
 * A barra é relativa ao maior grupo, não ao total: com 12 grupos, barra sobre
 * o total fica toda minúscula e não se compara nada. O percentual sobre o
 * total vai em texto, ao lado.
 */
export function ResumoOndeFoi({ transactions, showValues, onImportar, onSelecionar, filtroAtivo }: ResumoOndeFoiProps) {
  // Agrupa e ordena todos os gastos do mês. Como este card vive no painel,
  // rodava de novo a cada tecla da busca e a cada folha aberta.
  const resumo = useMemo(() => resumoPorSubcategoria(transactions), [transactions]);

  // Mês sem despesa, ou base toda anterior à coluna existir: não vale ocupar
  // tela com um card vazio.
  if (resumo.length === 0) return null;

  // Uma barra só, e sem nome, não informa nada — era o caso de quem lançou a
  // fatura inteira como um item. Mostrar "Outros 100%" ocupa tela e não
  // responde a pergunta do card, então aqui ele explica como obter a resposta.
  const semSinal = resumo.every(
    (i) => i.rotulo === 'Outros' || i.rotulo === NAO_CLASSIFICADO,
  );

  if (semSinal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.55 }}
        className="bg-white/5 border border-line-strong rounded-card p-6 backdrop-blur-sm"
      >
        <h2 className="text-lg font-semibold tracking-tight">Onde foi o dinheiro</h2>
        <p className="text-sm text-ink-2 mt-2 leading-relaxed">
          As despesas deste mês ainda não estão separadas por onde aconteceram.
          Um lançamento manual vira <strong className="text-ink-2">um item só</strong> —
          mesmo anexando a fatura em Comprovante, que apenas guarda o arquivo.
        </p>

        {/* Sem a flag ligada não existe botão de IA em lugar nenhum da tela.
            Mandar "use a leitura por IA" aqui apontaria para um recurso
            invisível, que é pior que não sugerir nada. */}
        {AI_ENABLED && onImportar ? (
          <>
            <p className="text-sm text-ink-2 mt-2 leading-relaxed">
              Para abrir a fatura compra por compra, envie o arquivo pela leitura por IA.
            </p>
            <button
              onClick={onImportar}
              className="mt-4 inline-flex items-center gap-2 bg-brand/15 hover:bg-brand/25 text-brand border border-brand/30 px-4 py-2.5 rounded-field text-sm font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Ler fatura e separar as compras
            </button>
          </>
        ) : (
          <p className="text-sm text-ink-2 mt-2 leading-relaxed">
            Você pode classificar cada gasto no lápis do lançamento, em{' '}
            <strong className="text-ink-2">Onde foi o gasto</strong>.
          </p>
        )}
      </motion.div>
    );
  }

  const maior = resumo[0].total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.55 }}
      className="bg-white/5 border border-line-strong rounded-card p-6 backdrop-blur-sm"
    >
      <h2 className="text-lg font-semibold tracking-tight">Onde foi o dinheiro</h2>
      <p className="text-xs text-ink-3 mt-1 mb-5">
        Despesas deste mês por onde você gastou. O orçamento continua por categoria.
      </p>

      <div className="flex flex-col gap-1">
        {resumo.map((item) => {
          const semNome = item.rotulo === NAO_CLASSIFICADO;
          const ativo = filtroAtivo === item.rotulo;
          return (
            <button
              key={item.rotulo}
              onClick={() => onSelecionar?.(item.rotulo)}
              aria-pressed={ativo}
              className={`text-left rounded-field px-2.5 py-2 -mx-2.5 transition-colors cursor-pointer ${ativo ? 'bg-brand/10' : 'hover:bg-white/5'}`}
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className={`text-sm font-medium truncate ${semNome ? 'text-ink-3 italic' : ativo ? 'text-brand' : 'text-ink-2'}`}>
                  {item.rotulo}
                </span>
                <span className="text-sm font-bold text-ink whitespace-nowrap">
                  {formatMoney(item.total, showValues)}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 flex-1 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${semNome ? 'bg-white/10' : 'bg-brand'}`}
                    style={{ width: `${Math.max((item.total / maior) * 100, 2)}%` }}
                  />
                </div>
                <span className="text-xs text-ink-3 w-[4.5rem] text-right shrink-0 tabular-nums">
                  {item.percentual.toFixed(0)}% · {item.itens}x
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-ink-3 mt-4">
        Toque num grupo para ver as compras dele na lista abaixo.
      </p>
    </motion.div>
  );
}
