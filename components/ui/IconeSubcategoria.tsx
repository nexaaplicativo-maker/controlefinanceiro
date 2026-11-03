/**
 * Ícone da linha de lançamento, pela subcategoria.
 *
 * Toda linha mostrava a mesma seta — para cima em receita, para baixo em
 * despesa. Numa lista de trinta compras de fatura, trinta setas idênticas não
 * ajudam a achar nada: a direção do dinheiro já está na cor do valor, à
 * direita.
 *
 * Com o ícone do assunto, a lista passa a ser varrível: o carrinho é mercado,
 * o carro é transporte, e o olho encontra sem ler.
 *
 * MONOCROMÁTICO DE PROPÓSITO
 * A tentação é dar uma cor a cada subcategoria. São dezesseis — seria o
 * arco-íris que acabamos de tirar do app, e as cores competiriam com verde e
 * vermelho, que ali significam entrada e saída.
 */

import {
  ShoppingCart, UtensilsCrossed, Bus, Fuel, Home, HeartPulse, GraduationCap,
  Repeat, Gamepad2, Shirt, Sparkles, PawPrint, Plane, Wrench, Receipt,
  CircleDashed, TrendingUp,
} from 'lucide-react';
import { normalizarSubcategoria } from '../../lib/subcategorias';

const ICONES = {
  'Mercado': ShoppingCart,
  'Alimentação': UtensilsCrossed,
  'Transporte': Bus,
  'Combustível': Fuel,
  'Moradia': Home,
  'Saúde': HeartPulse,
  'Educação': GraduationCap,
  'Assinaturas': Repeat,
  'Lazer': Gamepad2,
  'Vestuário': Shirt,
  'Beleza': Sparkles,
  'Pets': PawPrint,
  'Viagem': Plane,
  'Serviços': Wrench,
  'Impostos e Tarifas': Receipt,
  'Outros': CircleDashed,
} as const;

export function IconeSubcategoria({
  subcategoria,
  ehReceita = false,
  className = 'h-[18px] w-[18px]',
}: {
  subcategoria?: string | null;
  ehReceita?: boolean;
  className?: string;
}) {
  // Receita não tem "onde foi gasto": o dinheiro entrou, não saiu.
  if (ehReceita) return <TrendingUp className={className} />;

  const chave = normalizarSubcategoria(subcategoria);
  const Icone = chave ? ICONES[chave] : CircleDashed;

  return <Icone className={className} />;
}
