"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Sparkles, CircleHelp, Check, ChevronRight } from "lucide-react";
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

  // "Não classificado" não entra na lista de barras: vira o destaque de baixo.
  // Sem ele na lista, a barra mais longa é a do maior grupo NOMEADO — e
  // `nomeados` nunca é vazio aqui, o `semSinal` acima já cobriu esse caso.
  const semCategoria = resumo.find((i) => i.rotulo === NAO_CLASSIFICADO) ?? null;
  const nomeados = resumo.filter((i) => i.rotulo !== NAO_CLASSIFICADO);
  // Escala de desenho, não cálculo.
  const maior = nomeados[0].total;
  const naoClassificadoAtivo = filtroAtivo === NAO_CLASSIFICADO;

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
        {nomeados.map((item) => {
          const ativo = filtroAtivo === item.rotulo;
          return (
            <button
              key={item.rotulo}
              onClick={() => onSelecionar?.(item.rotulo)}
              aria-pressed={ativo}
              className={`text-left rounded-field px-2.5 py-2 -mx-2.5 transition-colors cursor-pointer ${ativo ? 'bg-brand/10' : 'hover:bg-white/5'}`}
            >
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className={`text-sm font-medium truncate ${ativo ? 'text-brand' : 'text-ink-2'}`}>
                  {item.rotulo}
                </span>
                <span className="text-sm font-bold text-ink whitespace-nowrap">
                  {formatMoney(item.total, showValues)}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 flex-1 bg-black/30 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-brand`}
                    style={{ width: `${Math.max((item.total / maior) * 100, 2)}%` }}
                  />
                </div>
                {/* Abaixo de `xs` (360px) o percentual some: "100% · 142 gastos" mede
                    ~104px e alargar a coluna em 320px comeria a barra de
                    progresso, que é a informação. A barra já comunica a
                    proporção; a contagem não tem substituto visual.
                    `ink-2` na linha ativa: `ink-3` mede 4,35:1 sobre
                    `bg-brand/10` e reprova AA; `ink-2` dá 6,75:1. */}
                <span className={`w-[4.75rem] xs:w-[6.75rem] shrink-0 text-right text-xs tabular-nums ${ativo ? 'text-ink-2' : 'text-ink-3'}`}>
                  <span className="hidden xs:inline">{item.percentual.toFixed(0)}% · </span>
                  {item.itens} {item.itens === 1 ? 'gasto' : 'gastos'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {semCategoria && (
        <div className="mt-4 pt-4 border-t border-line">
          {/* Um único botão, sem elemento interativo aninhado. O rótulo e a
              linha 3 NÃO mudam entre os estados: quem carrega o estado é o
              `aria-pressed` — trocar texto e atributo juntos faz o leitor de
              tela anunciar coisa trocada. As bordas são /50 e não /30: /30
              mede 1,9:1 contra o fundo do card e reprova o 3:1 de componente
              gráfico; /50 dá ~3,2:1. */}
          <button
            type="button"
            onClick={() => onSelecionar?.(NAO_CLASSIFICADO)}
            aria-pressed={naoClassificadoAtivo}
            className={`w-full text-left rounded-inner px-3 py-3 min-h-11 flex items-start gap-3 transition-colors cursor-pointer border ${naoClassificadoAtivo ? 'border-brand/50 bg-brand/10' : 'border-warn/50 bg-warn/10 hover:bg-warn/15'}`}
          >
            {naoClassificadoAtivo ? (
              <Check aria-hidden className="h-5 w-5 text-brand shrink-0" />
            ) : (
              <CircleHelp aria-hidden className="h-5 w-5 text-warn shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className={`text-sm font-medium ${naoClassificadoAtivo ? 'text-brand' : 'text-ink'}`}>
                  {NAO_CLASSIFICADO}
                </span>
                <span className="text-sm font-bold text-ink whitespace-nowrap">
                  {formatMoney(semCategoria.total, showValues)}
                </span>
              </span>
              <span className="block text-xs text-ink-2">
                {semCategoria.itens} {semCategoria.itens === 1 ? 'gasto' : 'gastos'} · {semCategoria.percentual.toFixed(0)}% do mês
              </span>
              <span className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold ${naoClassificadoAtivo ? 'text-brand' : 'text-warn'}`}>
                Ver estes gastos
                <ChevronRight aria-hidden className="h-3.5 w-3.5" />
              </span>
            </span>
          </button>
        </div>
      )}

      <p className="text-xs text-ink-3 mt-4">
        Toque num grupo para ver as compras dele na lista abaixo.
      </p>
    </motion.div>
  );
}
