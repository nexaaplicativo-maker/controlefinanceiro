import { Check } from "lucide-react";
import type { StageStep } from "../lib/profile";

interface EscadaEstagiosProps {
  degraus: StageStep[];
  /** Nível (1 a 5) do estágio atual. Só tem efeito com `calibrado`. */
  nivelAtual: number;
  /** false enquanto o usuário não respondeu o onboarding: o estágio é palpite
   *  e não pode aparecer como calculado. Todos os degraus ficam em contorno. */
  calibrado: boolean;
}

type Situacao = 'concluido' | 'atual' | 'seguinte';

const TEXTO_DA_SITUACAO: Record<Situacao, string> = {
  concluido: 'concluído',
  atual: 'atual',
  seguinte: 'a seguir',
};

/** 32px: o conector vai de centro a centro, então `left-4`/`right-4` (16px) são o raio. */
const DEGRAU = 'h-8 w-8';

/**
 * A escada dos 5 estágios, na horizontal.
 *
 * ESTRUTURA PARA LEITOR DE TELA
 * O `<ol>` tem exatamente 5 `<li>`. Os conectores são desenho puro e ficam FORA
 * da lista, em elementos `aria-hidden`: um `<li>` decorativo dentro dela faz o
 * leitor anunciar 9 itens e ler 5. O nome de cada degrau vai num `sr-only`
 * dentro do `<li>`, e não em `aria-label` do `<li>` — nome acessível em
 * `role="listitem"` é tratado de forma inconsistente entre leitores.
 *
 * O ESTADO NÃO DEPENDE SÓ DE COR
 * Concluído = check sobre fundo cheio; atual = número sobre fundo cheio de outra
 * cor, com anel; a seguir = número em contorno. Forma, conteúdo e preenchimento
 * diferem. O contorno e o conector usam `line-contrast` (≥ 3:1, WCAG 1.4.11).
 *
 * CABE EM 320px: 5 × 32px + 4 vãos sobram nos 232px internos do card, com
 * `justify-between` distribuindo o espaço.
 */
export function EscadaEstagios({ degraus, nivelAtual, calibrado }: EscadaEstagiosProps) {
  const situacaoDe = (step: StageStep): Situacao => {
    if (!calibrado) return 'seguinte';
    return step.status === 'done' ? 'concluido' : step.status === 'current' ? 'atual' : 'seguinte';
  };

  // Fração do trecho entre o primeiro e o último centro que já foi percorrida.
  const percorrido = calibrado && degraus.length > 1
    ? Math.min(1, Math.max(0, (nivelAtual - 1) / (degraus.length - 1)))
    : 0;

  return (
    <div className="relative">
      {/* Trilho e trecho percorrido, de centro a centro (`left/right` = raio do degrau). */}
      <span aria-hidden className="absolute left-4 right-4 top-[15px] h-0.5 rounded-full bg-line-contrast" />
      {percorrido > 0 && (
        <span
          aria-hidden
          className="absolute left-4 top-[15px] h-0.5 rounded-full bg-brand"
          style={{ width: `calc((100% - 2rem) * ${percorrido})` }}
        />
      )}

      <ol aria-label="Estágios da jornada" className="relative flex items-center justify-between">
        {degraus.map(step => {
          const situacao = situacaoDe(step);
          const nivel = step.stage.level;

          const visual =
            situacao === 'concluido'
              ? 'bg-brand text-canvas'
              : situacao === 'atual'
                ? 'bg-warn text-canvas ring-4 ring-surface'
                : 'border-2 border-line-contrast bg-surface-2 text-ink-2';

          return (
            <li key={step.stage.id} aria-current={situacao === 'atual' ? 'step' : undefined}>
              <span
                aria-hidden
                className={`${DEGRAU} grid place-items-center rounded-full text-sm font-bold tnum ${visual}`}
              >
                {situacao === 'concluido' ? <Check className="h-4 w-4" strokeWidth={3} /> : nivel}
              </span>
              <span className="sr-only">
                Estágio {nivel}, {step.stage.label}: {TEXTO_DA_SITUACAO[situacao]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
