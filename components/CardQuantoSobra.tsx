"use client";

import { useId } from "react";
import { ChevronRight, Sparkles } from "lucide-react";

import { Card } from "./ui/Surface";
import { Money } from "./ui/Money";
import { DivisaoRenda } from "./DivisaoRenda";
import { AI_ENABLED } from "../lib/features";
import { formatMoney } from "../lib/format";
import type { DivisaoDaRenda, IdDoSegmento } from "../lib/divisao-renda";

export interface CardQuantoSobraProps {
  /** Nome do mês, já em minúsculas ("novembro"). */
  mes: string;
  /** Renda − contas fixas − cartões e variáveis. */
  sobra: number;
  rendaLiquida: number;
  divisao: DivisaoDaRenda;
  valores: Record<IdDoSegmento, number>;
  showValues: boolean;
  /** Abre `IncomeListModal`: é a única porta para editar receita. */
  onAbrirRenda: () => void;
  onAbrirSegmento: (id: IdDoSegmento) => void;
  onLancarRenda: () => void;
  onLerFatura: () => void;
}

const BOTAO_BASE =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-field px-5 text-sm font-bold transition-colors";

/**
 * "Quanto sobra em {mês}": o número que a pessoa abre o app para ver, a renda
 * de onde ele sai e a divisão dela.
 *
 * O `Money` já recua os centavos (`text-cents`, 0,62em): não há helper de
 * formatação aqui. O herói é 40px e não 44px porque "R$ 11.954,00" a 44px/800
 * estoura os 272px internos em 360px.
 *
 * MÊS SEM RENDA: não existe "quanto sobra" sem o que entrou, e a divisão sobre
 * renda zero não faz sentido. O card vira um convite com dois caminhos — e o
 * contorno tracejado ocupa o lugar da barra, para o card manter a forma.
 */
export function CardQuantoSobra({
  mes, sobra, rendaLiquida, divisao, valores, showValues,
  onAbrirRenda, onAbrirSegmento, onLancarRenda, onLerFatura,
}: CardQuantoSobraProps) {
  const tituloId = useId();
  const semRenda = rendaLiquida <= 0;

  return (
    <section aria-labelledby={tituloId} className="mb-6">
      <Card>
        <h2 id={tituloId} className="text-[13px] font-semibold text-ink-2">Quanto sobra em {mes}</h2>

        {semRenda ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-ink">
              Lance o que entrou no mês para ver quanto sobra depois das contas.
            </p>
            <div aria-hidden className="mt-4 h-3 rounded-full border-2 border-dashed border-line-contrast" />
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={onLancarRenda} className={`${BOTAO_BASE} min-w-36 flex-1 bg-brand text-canvas hover:bg-brand-strong`}>
                Lançar renda
              </button>
              {AI_ENABLED && (
                <button type="button" onClick={onLerFatura} className={`${BOTAO_BASE} min-w-36 flex-1 border border-line bg-white/5 text-ink hover:bg-white/10`}>
                  <Sparkles aria-hidden className="h-4 w-4" />
                  Ler uma fatura
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2">
              <Money
                value={sobra}
                visible={showValues}
                tom={sobra < 0 ? 'neg' : sobra === 0 ? 'muted' : 'ink'}
                className="text-[40px] leading-none font-extrabold tracking-tight"
              />
            </p>

            {/* `button`, não texto: o antigo card "Renda Líquida" era a única
                porta para listar e editar as receitas do mês. */}
            <button
              type="button"
              onClick={onAbrirRenda}
              className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-field text-left text-sm text-ink-2 transition-colors hover:text-ink"
            >
              <span>
                de <strong className="font-semibold text-ink tnum">{formatMoney(rendaLiquida, showValues)}</strong> que entraram no mês
                <span className="sr-only">. Ver e editar as receitas</span>
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink-3" />
            </button>

            <div className="mt-3">
              <DivisaoRenda divisao={divisao} valores={valores} showValues={showValues} onAbrir={onAbrirSegmento} />
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
