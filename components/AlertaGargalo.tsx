import { ArrowRight, CircleAlert } from "lucide-react";
import { formatPercent } from "@/lib/format";

export interface AlertaGargaloProps {
  /** O alerta não existe no tier saudável: quem renderiza decide isso. */
  tier: 'atencao' | 'critico';
  /** `comprometimentoRaw`: % da renda em cartões e variáveis, pode passar de 100. */
  percentual: number;
  showValues: boolean;
  onVerOndeCortar: () => void;
}

/**
 * Cores e frase de cada tier. As frases são as `caption` que o card de
 * "Cartões & Variáveis" mostrava; o fundo e o ícone, o `GARGALO_THEME` antigo.
 *
 * A BORDA SOBE DE /20 PARA /60. O alerta fica direto sobre o `canvas`, e a borda
 * existe para separá-lo dele. Medido (WCAG 2.1, borda sobre o painel `/5` que
 * está sobre o canvas #080b0f):
 *
 *            /20      /50      /60
 *   neg     1,35:1   2,55:1   3,16:1
 *   warn    1,52:1   3,36:1   4,31:1
 *
 * A nota de `ResumoOndeFoi` (/50 = 3,33:1 para warn) vale para o fundo
 * `bg-white/5` DAQUELE card; aqui o fundo é outro e o `neg/50` não chega a 3:1.
 * /60 é o menor degrau que fecha os dois.
 */
const TEMA = {
  atencao: {
    painel: 'bg-warn/5 border-warn/60',
    icone: 'bg-warn/10 text-warn',
    frase: 'Acima do seu teto de consumo.',
  },
  critico: {
    painel: 'bg-neg/5 border-neg/60',
    icone: 'bg-neg/10 text-neg',
    frase: 'Bem acima do seu teto — corte aqui primeiro.',
  },
} as const;


/**
 * Alerta do gargalo: consolida o selo de "% da renda" e a legenda que viviam no
 * card antigo de Cartões e Variáveis.
 *
 * "Ver onde cortar" é um `button`, não `a href="#..."`: o app não tem rota nem
 * âncora, e quem rola e move o foco é a página (`onVerOndeCortar`).
 */
export function AlertaGargalo({ tier, percentual, showValues, onVerOndeCortar }: AlertaGargaloProps) {
  const tema = TEMA[tier];
  // Com valores ocultos a proporção também some, como o selo antigo já fazia.
  // Arredonda para inteiro como o resto do app: o selo antigo mostrava "69%" e
  // duas grandezas diferentes para o mesmo numero confundem mais do que a casa
  // decimal informa. `formatPercent` ja devolve '••%' com os valores ocultos.
  const pct = formatPercent(percentual, showValues);

  return (
    <div role="note" className={`mb-6 flex gap-3 rounded-card border p-4 ${tema.painel}`}>
      <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-inner ${tema.icone}`}>
        <CircleAlert className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">Cartões e variáveis levam {pct} da renda</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{tema.frase}</p>
        <button
          type="button"
          onClick={onVerOndeCortar}
          className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-1 text-[13px] font-semibold text-brand transition-colors hover:text-ink"
        >
          Ver onde cortar
          <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
