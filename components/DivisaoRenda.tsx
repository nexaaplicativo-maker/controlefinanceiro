import { ChevronRight } from "lucide-react";

import { formatMoney } from "../lib/format";
import { ROTULO_DO_SEGMENTO, type DivisaoDaRenda, type IdDoSegmento } from "../lib/divisao-renda";

export interface DivisaoRendaProps {
  /** Retorno de `dividirRenda`: o que a BARRA desenha. */
  divisao: DivisaoDaRenda;
  /** Valor exato de cada item da lista. Pode ser negativo (o "livre" no estouro). */
  valores: Record<IdDoSegmento, number>;
  showValues: boolean;
  onAbrir: (id: IdDoSegmento) => void;
}

const ORDEM: IdDoSegmento[] = ['fixos', 'gargalo', 'guardado', 'livre'];

/** Cada fatia tem cor E posição na legenda: a cor nunca é a única pista. */
const COR: Record<IdDoSegmento, string> = {
  fixos: 'bg-ink-3',
  gargalo: 'bg-neg',
  guardado: 'bg-brand',
  livre: 'bg-ink',
};

/**
 * Barra única da divisão da renda mais a lista de 4 itens que abrem o detalhe.
 *
 * A lista é a porta para o `PillarDetailModal`: sem ela os quatro cards antigos
 * levavam os lançamentos de cada número, e a barra sozinha não leva a lugar
 * nenhum.
 *
 * PRIVACIDADE: com `showValues` desligado a barra vira UM bloco cinza e o
 * `aria-label` não diz nada da divisão. Valor e proporção são a mesma
 * informação — uma barra 69% vermelha vaza o que o olho do "ocultar" escondeu.
 *
 * O `gap-1` entre as fatias deixa o fundo do card aparecer entre elas: os pares
 * de baixa diferença de cor (cinza e vermelho, azul e branco) nunca se tocam.
 * Em 360px o menor segmento real (2%) tem ~6px, daí o `min-w-1.5`.
 */
export function DivisaoRenda({ divisao, valores, showValues, onAbrir }: DivisaoRendaProps) {
  const { segmentos, estourou } = divisao;
  const comValor = segmentos.filter(s => s.valor > 0);

  const rotuloDaBarra = !showValues
    ? 'Divisão da renda oculta'
    : `Divisão da renda${estourou ? ' (proporção entre as saídas, que passaram da renda)' : ''}: ${comValor
        .map(s => `${s.percentual}% ${s.rotulo.toLowerCase()}`)
        .join(', ')}`;

  return (
    <div>
      {/* Sem fatia para mostrar (estouro sem nenhuma saída listada): só o aviso. */}
      {(!showValues || comValor.length > 0) && (
        <div role="img" aria-label={rotuloDaBarra} className="flex h-3 gap-1 overflow-hidden rounded-full">
          {showValues ? (
            comValor.map(s => (
              <span
                key={s.id}
                className={`min-w-1.5 ${COR[s.id]}`}
                // Proporção pelo valor exato: o percentual inteiro é só texto.
                style={{ flexGrow: s.valor, flexBasis: 0 }}
              />
            ))
          ) : (
            <span className="flex-1 bg-white/10" />
          )}
        </div>
      )}

      {estourou && (
        <p className="mt-3 text-sm font-semibold text-neg">Você gastou mais do que ganhou</p>
      )}

      <ul className="mt-4 flex flex-col gap-1.5">
        {ORDEM.map(id => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onAbrir(id)}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-inner bg-white/5 px-3 text-left transition-colors hover:bg-white/10"
            >
              <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${COR[id]}`} />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{ROTULO_DO_SEGMENTO[id]}</span>
              <span className={`shrink-0 text-sm font-bold tnum ${valores[id] < 0 ? 'text-neg' : 'text-ink'}`}>
                {formatMoney(valores[id], showValues)}
              </span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
