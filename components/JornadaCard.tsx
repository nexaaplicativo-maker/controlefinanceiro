"use client";

import { useId, useState } from "react";
import { ChevronRight, Loader2, ShieldCheck } from "lucide-react";

import { Card } from "./ui/Surface";
import { EscadaEstagios } from "./EscadaEstagios";
import { formatMoney } from "../lib/format";
import type { ProximoPasso, Stage, StageStep } from "../lib/profile";

export interface JornadaCardProps {
  stage: Stage;
  degraus: StageStep[];
  proximoPasso: ProximoPasso;
  /** O usuário ainda não respondeu o onboarding: o estágio é palpite. */
  needsOnboarding: boolean;
  /** Existe a meta "Reserva de Emergência" na tabela `goals`. */
  temMeta: boolean;
  showValues: boolean;
  /** Meses de custo cobertos pela reserva; null sem custo de vida apurado. */
  reserveMonths: number | null;
  /** Estágio 1 com dívida cara cadastrada: a prioridade vira número. */
  dividaCara?: { total: number; jurosPorMes: number };
  /** Estágio 1 em que o usuário diz ter dívida mas não cadastrou nenhuma. */
  pedeCadastroDeDivida?: boolean;
  onVerCaminho: () => void;
  onResponderPerguntas: () => void;
  /** Grava o aporte (`handleAddToReserve`). Só é chamado com a meta criada. */
  onGuardar: (valor: number) => Promise<void>;
  /** Cria a meta (`handleCreateReserveGoal`). Ausente quando não há reserva ideal a propor. */
  onCriarReserva?: () => void;
}

const CTA =
  "inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-field bg-brand px-5 text-sm font-bold text-canvas transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40";

/** Máscara de dinheiro com a mesma caixa nos dois modos; ver `formatMoney`. */
const dinheiro = (v: number, showValues: boolean) => formatMoney(v, showValues);

/**
 * Card "Sua jornada": estágio, escada e o próximo passo.
 *
 * Recebe tudo por props e não grava nada. Os dois caminhos que gravam (criar a
 * meta e guardar) são os handlers que já existiam na página, que já validam;
 * este card só decide QUAL deles oferecer:
 *
 *   needsOnboarding -> "Responder as 4 perguntas" (não há estágio calculado)
 *   sem meta        -> "Criar minha reserva"
 *   com meta        -> "Guardar agora"
 *
 * "Guardar agora" sem a meta seria um botão morto (`handleAddToReserve` sai
 * calado quando não há meta), por isso ele nunca é renderizado nesse estado.
 *
 * O card inteiro NÃO é um botão: há três controles dentro dele, e botão dentro
 * de botão é inválido.
 *
 * Sem `ink-3` aqui: sobre a abertura clara do `card-hero` (#24323c) ele mede
 * 3,83:1 (`ink-2` mede 5,94:1) e reprova o AA de texto.
 */
export function JornadaCard({
  stage, degraus, proximoPasso, needsOnboarding, temMeta, showValues, reserveMonths,
  dividaCara, pedeCadastroDeDivida, onVerCaminho, onResponderPerguntas, onGuardar, onCriarReserva,
}: JornadaCardProps) {
  const tituloId = useId();

  const frase = needsOnboarding
    ? "Responda 4 perguntas rápidas no seu perfil para o Nexa calibrar os limites ao seu caso."
    : dividaCara
      // No Estágio 1 a prioridade vira número: dívida cara restante e o que ela
      // cobra por mês. "Quite a dívida" sem valor é conselho; com valor é meta.
      ? <>Dívida cara restante: <strong className="text-neg">{dinheiro(dividaCara.total, showValues)}</strong>, custando <strong className="text-neg">{dinheiro(dividaCara.jurosPorMes, showValues)}</strong> por mês só de juros.</>
      : pedeCadastroDeDivida
        ? "Você indicou ter dívida. Cadastre-a para o Nexa calcular quanto custa e quando acaba."
        : stage.priority;

  return (
    <section aria-labelledby={tituloId} className="mb-6">
      <Card hero>
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-brand">
          {needsOnboarding ? "Sua jornada" : `Sua jornada · Estágio ${stage.level} de 5`}
        </p>
        <h2 id={tituloId} className="mt-2 text-balance text-[22px] font-bold leading-tight tracking-tight text-ink">
          {needsOnboarding ? "Descubra em que estágio você está" : stage.label}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">{frase}</p>

        <div className="mt-5">
          <EscadaEstagios degraus={degraus} nivelAtual={stage.level} calibrado={!needsOnboarding} />
        </div>

        {needsOnboarding ? (
          <div className="mt-5 border-t border-line pt-5">
            <button type="button" onClick={onResponderPerguntas} className={CTA}>
              Responder as 4 perguntas
            </button>
            <p className="mt-2 text-center text-xs text-ink-2">Leva uns 2 minutos</p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onVerCaminho}
              className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-1 text-sm font-semibold text-brand transition-colors hover:text-ink"
            >
              Ver o caminho completo
              <ChevronRight aria-hidden className="h-4 w-4" />
            </button>

            <ProximoPassoBloco
              passo={proximoPasso}
              temMeta={temMeta}
              showValues={showValues}
              reserveMonths={reserveMonths}
              onGuardar={onGuardar}
              onCriarReserva={onCriarReserva}
            />
          </>
        )}
      </Card>
    </section>
  );
}

function ProximoPassoBloco({ passo, temMeta, showValues, reserveMonths, onGuardar, onCriarReserva }: {
  passo: ProximoPasso;
  temMeta: boolean;
  showValues: boolean;
  reserveMonths: number | null;
  onGuardar: (valor: number) => Promise<void>;
  onCriarReserva?: () => void;
}) {
  const campoId = useId();
  const [abrindo, setAbrindo] = useState(false);
  const [valor, setValor] = useState("");
  const [ocupado, setOcupado] = useState(false);

  // Sem alvo ou com alvo zerado não há régua: `aria-valuemax="0"` é uma barra
  // de progresso inválida. Só a frase.
  const temBarra = !passo.semAlvo && passo.alvo !== null && passo.alvo > 0;
  const alvo = passo.alvo ?? 0;
  const percentual = temBarra ? Math.min(100, Math.max(0, (passo.atual / alvo) * 100)) : 0;

  const guardar = async () => {
    const v = parseFloat(valor);
    if (!v || v <= 0) return;
    setOcupado(true);
    await onGuardar(v);
    setOcupado(false);
    setValor("");
    setAbrindo(false);
  };

  return (
    <div className="mt-2 border-t border-line pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-2">Próximo passo</span>
        {temBarra && (
          <span className="text-right text-xs text-ink-2">
            {reserveMonths !== null && reserveMonths > 0
              ? `${reserveMonths.toFixed(1)} meses de custo cobertos`
              : "Ainda sem aporte"}
          </span>
        )}
      </div>

      {temBarra ? (
        <>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-sm font-semibold text-ink">{passo.rotulo}</span>
            <span className="shrink-0 text-right text-sm tnum text-ink-2">
              <span className="font-bold text-ink">{dinheiro(passo.atual, showValues)}</span>{" "}
              de {dinheiro(alvo, showValues)}
            </span>
          </div>

          {/* Progresso: sem `aria-valuenow` com os valores ocultos — uma barra
              indeterminada é válida, e o número exato não pode vazar pelo
              atributo. O preenchimento segue desenhado: o que se esconde é
              valor, não o estágio. A trilha usa `line-contrast` para existir
              mesmo em 0%. */}
          <div
            role="progressbar"
            aria-label={passo.rotulo}
            aria-valuemin={0}
            aria-valuemax={showValues ? alvo : undefined}
            aria-valuenow={showValues ? passo.atual : undefined}
            aria-valuetext={showValues ? `${formatMoney(passo.atual)} de ${formatMoney(alvo)}` : "Valores ocultos"}
            className="mt-3 h-3 overflow-hidden rounded-full border border-line-contrast bg-surface-2"
          >
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${percentual}%` }}
            />
          </div>

          <p className="mt-2 text-xs leading-relaxed text-ink-2">
            {passo.concluido
              ? "Meta deste degrau atingida."
              : `Faltam ${dinheiro(passo.restante, showValues)} para completar este passo.`}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          {passo.semCusto
            ? "Lance algumas despesas para o Nexa descobrir seu custo de vida e calcular a reserva certa para você."
            : passo.frase}
        </p>
      )}

      <div className="mt-4">
        {!temMeta ? (
          onCriarReserva && (
            <button type="button" onClick={onCriarReserva} className={CTA}>
              <ShieldCheck aria-hidden className="h-4 w-4" />
              Criar minha reserva
            </button>
          )
        ) : abrindo ? (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor={campoId} className="sr-only">Quanto guardar na reserva, em reais</label>
              <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-2">R$</span>
              <input
                id={campoId}
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                autoFocus
                value={valor}
                onChange={e => setValor(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") void guardar(); }}
                placeholder="0,00"
                className="min-h-12 w-full rounded-field border border-line-strong bg-black/30 py-2.5 pl-9 pr-3 text-sm font-semibold text-ink placeholder:text-ink-3 focus:border-brand focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={ocupado || !valor}
              className="inline-flex min-h-12 min-w-24 cursor-pointer items-center justify-center rounded-field bg-brand px-4 text-sm font-bold text-canvas transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ocupado ? <Loader2 aria-label="Guardando" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : "Guardar"}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAbrindo(true)} className={CTA}>
            Guardar agora
          </button>
        )}
      </div>
    </div>
  );
}
