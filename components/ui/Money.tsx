/**
 * Valor em dinheiro com os centavos recuados.
 *
 * É a assinatura tipográfica do sistema: os reais ficam no tom primário, em
 * corpo grande, e os centavos caem para um tom menor e apagado. O olho pega o
 * número que importa sem precisar ler o resto.
 *
 * A formatação em si NÃO mora aqui. `lib/format.ts` é a fonte única e já
 * documenta o estrago de reimplementar isso — o mesmo valor saía
 * "R$ 1500,50" numa tela e "R$ 1.500,50" em outra. Este componente só quebra
 * em duas partes o que aquela função devolveu.
 */

import { formatMoney, HIDDEN_MONEY } from '../../lib/format';

type Tom = 'ink' | 'pos' | 'neg' | 'muted';

const TOM: Record<Tom, string> = {
  ink: 'text-ink',
  pos: 'text-pos',
  neg: 'text-neg',
  muted: 'text-ink-3',
};

interface MoneyProps {
  value: number | null | undefined;
  /** Passe `showValues` aqui para respeitar o modo de ocultar valores. */
  visible?: boolean;
  /** Classe do bloco dos reais. O tamanho dos centavos sai daqui. */
  className?: string;
  tom?: Tom;
  /** "+" explícito em entrada. A cor sozinha não comunica para quem não a vê. */
  sinal?: 'entrada' | 'saida' | null;
}

export function Money({
  value,
  visible = true,
  className = 'text-2xl font-semibold tracking-tight',
  tom = 'ink',
  sinal = null,
}: MoneyProps) {
  const texto = formatMoney(value, visible);

  // Modo privado não tem centavos para recuar: a máscara é uma coisa só, e
  // mantém a mesma caixa para o layout não pular ao ligar e desligar.
  if (texto === HIDDEN_MONEY) {
    return <span className={`${className} ${TOM[tom]} tnum`}>{texto}</span>;
  }

  const corte = texto.lastIndexOf(',');
  const reais = corte === -1 ? texto : texto.slice(0, corte);
  const centavos = corte === -1 ? '' : texto.slice(corte);

  return (
    <span className={`${className} ${TOM[tom]} tnum inline-flex items-baseline`}>
      {sinal === 'entrada' ? '+ ' : sinal === 'saida' ? '− ' : null}
      {reais}
      {centavos && (
        <span className="text-cents text-[0.62em] font-medium ml-px">{centavos}</span>
      )}
    </span>
  );
}
