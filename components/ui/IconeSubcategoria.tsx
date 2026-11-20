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
 *
 * Segundo nível de fallback: sem subcategoria reconhecida, o ícone vem da
 * categoria (`Contas Fixas`, `Cartões`...). O mapa por categoria segue
 * monocromático. Sem subcategoria E sem categoria conhecida (categoria própria
 * do usuário, ou lançamento sem categoria), o último recurso é `Banknote`, um
 * ícone neutro no mesmo traço dos outros: o `CircleDashed` que ficava aqui
 * parecia o app não ter carregado o ícone, e foi o que apareceu em teste de
 * celular em 20/11/2026. O `CircleDashed` saiu do arquivo inteiro: também era
 * o ícone de `Outros`, e ali comunicava "vazio" ou "não carregou" para uma
 * escolha que é explícita de quem lança. `Outros` passou a `Tag` — etiqueta,
 * no mesmo traço dos outros quinze.
 */

import {
  ShoppingCart, UtensilsCrossed, Bus, Fuel, Home, HeartPulse, GraduationCap,
  Repeat, Gamepad2, Shirt, Sparkles, PawPrint, Plane, Wrench, Receipt,
  TrendingUp, FileText, ShoppingBag, CreditCard, PiggyBank, Banknote, Tag,
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
  'Outros': Tag,
} as const;

// Categorias do app (os `<select>` e lib/extracao.ts). String exata, sem normalizar.
const ICONES_CATEGORIA = {
  'Contas Fixas': FileText,
  'Variáveis': ShoppingBag,
  'Cartões': CreditCard,
  'Cartões de Crédito': CreditCard,
  'Investimentos': PiggyBank,
} as const;

export function IconeSubcategoria({
  subcategoria,
  categoria,
  ehReceita = false,
  className = 'h-[18px] w-[18px]',
}: {
  subcategoria?: string | null;
  categoria?: string | null;
  ehReceita?: boolean;
  className?: string;
}) {
  // Receita não tem "onde foi gasto": o dinheiro entrou, não saiu.
  if (ehReceita) return <TrendingUp className={className} />;

  const chave = normalizarSubcategoria(subcategoria);
  // `hasOwnProperty.call`, não acesso direto: uma categoria própria chamada
  // `constructor` ou `toString` devolveria função do protótipo e o React
  // tentaria renderizá-la. O mapa de subcategoria não corre esse risco porque
  // a chave vem de `normalizarSubcategoria`, de vocabulário fechado.
  const porCategoria = categoria && Object.prototype.hasOwnProperty.call(ICONES_CATEGORIA, categoria)
    ? ICONES_CATEGORIA[categoria as keyof typeof ICONES_CATEGORIA]
    : undefined;
  const Icone = chave ? ICONES[chave] : (porCategoria ?? Banknote);

  return <Icone className={className} />;
}
