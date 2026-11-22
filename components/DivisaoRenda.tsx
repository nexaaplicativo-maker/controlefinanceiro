import { ChevronRight } from "lucide-react";

import { formatMoney } from "../lib/format";
import { ROTULO_DO_SEGMENTO, type DivisaoDaRenda, type IdDoSegmento } from "../lib/divisao-renda";

export interface DivisaoRendaProps {
  /** Retorno de `dividirRenda`: o que a BARRA desenha. Quando `semBarra`, só a lista. */
  divisao: DivisaoDaRenda;
  /** Mês sem renda: não há divisão a desenhar, mas os itens seguem clicáveis. */
  semBarra?: boolean;
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
export function DivisaoRenda({ divisao, semBarra = false, valores, showValues, onAbrir }: DivisaoRendaProps) {
  const { segmentos, estourou, base } = divisao;
  const comValor = segmentos.filter(s => s.valor > 0);

  const rotuloDaBarra = !showValues
    ? 'Divisão da renda oculta'
    : `Divisão da renda${estourou ? ' (proporção entre as saídas, que passaram da renda)' : ''}: ${comValor
        .map(s => `${s.percentual}% ${s.rotulo.toLowerCase()}`)
        .join(', ')}`;

  return (
    <div>
      {/* Sem fatia para mostrar (estouro sem nenhuma saída listada): só o aviso. */}
      {!semBarra && (!showValues || comValor.length > 0) && (
        <div role="img" aria-label={rotuloDaBarra} className="flex h-3 gap-1 overflow-hidden rounded-full bg-white/5">
          {showValues ? (
            comValor.map(s => (
              <span
                key={s.id}
                className={`min-w-1.5 ${COR[s.id]}`}
                // Largura = valor ÷ base, a MESMA base do percentual em texto: se
                // as fatias não cobrem a base, sobra trilha vazia à direita em
                // vez de a barra esticar e discordar do texto.
                style={{ flex: `0 1 ${(s.valor / base) * 100}%` }}
              />
            ))
          ) : (
            <span className="flex-1 bg-white/10" />
          )}
        </div>
      )}

      {!semBarra && estourou && (
        <p className="mt-3 text-sm font-semibold text-neg">Você gastou mais do que ganhou</p>
      )}

      <ul className={`flex flex-col gap-1.5 ${semBarra ? '' : 'mt-4'}`}>
        {ORDEM.map(id => (
          <li key={id}>
            <button
              type="button"
              onClick={() => onAbrir(id)}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-inner bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
            >
              <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${COR[id]}`} />
              {/* Quebra em duas linhas em vez de truncar: no celular "Cartões e
                  variáveis" nao cabe numa linha ao lado do valor, e truncar
                  ("Cartões e va...") esconde qual pilar a linha abre. O valor
                  continua alinhado pelo `items-center` da linha. */}
              <span className="min-w-0 flex-1 text-sm text-ink-2">{ROTULO_DO_SEGMENTO[id]}</span>
              <span className={`shrink-0 text-sm font-bold tnum ${valores[id] < 0 ? 'text-neg' : 'text-ink'}`}>
                {formatMoney(valores[id], showValues)}
              </span>
              {/* Abaixo de `xs` a seta sai: a linha inteira já é botão, e em 320px ela
                  e o valor deixavam ~46px para o rótulo. */}
              <ChevronRight aria-hidden className="hidden h-4 w-4 shrink-0 text-ink-3 xs:block" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
