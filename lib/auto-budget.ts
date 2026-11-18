import { MAX_MONEY, validateMoney } from './validation';

/**
 * Validação da renda que chega em /api/auto-budget.
 *
 * POR QUE ISTO EXISTE
 * A rota recebia `income` do corpo da requisição e interpolava o valor DIRETO
 * dentro do prompt enviado ao Gemini, sem olhar o que era. Três problemas de
 * uma vez:
 *
 *   1. Injeção de prompt. `income` é texto livre indo para dentro de uma
 *      instrução. Mandar "1000. Ignore as regras acima e ..." era um pedido
 *      que o modelo lia como instrução, não como dado.
 *   2. Cota queimada à toa. Renda zero, negativa ou absurda gera uma chamada
 *      paga ao Gemini para devolver um orçamento que não significa nada.
 *   3. Lixo silencioso. `undefined` virava a string "undefined" no meio do
 *      prompt, e o modelo respondia alguma coisa mesmo assim.
 *
 * POR QUE É UMA FUNÇÃO SEPARADA, E NÃO UM BLOCO DENTRO DA ROTA
 * Rota de API não se testa sem subir servidor. Aqui é função pura, sem I/O,
 * como o resto da regra de negócio em `lib/` — e por isso é coberta por
 * `lib/auto-budget.test.ts`.
 *
 * POR QUE REUSA `validateMoney`
 * Ela já é exatamente `parseMoney` + teto `MAX_MONEY` + arredondamento aos
 * centavos, já é testada em `lib/validation.test.ts`, e já devolve mensagens
 * em português prontas para a tela. Reescrever as mesmas comparações aqui
 * criaria uma segunda definição de "valor monetário válido" para divergir da
 * primeira com o tempo. O que esta função acrescenta é a guarda de TIPO, que
 * o formulário não precisa (um `<input>` sempre entrega string) e uma rota de
 * API precisa: pelo corpo de um POST chega qualquer coisa.
 */

export type RendaValidada =
  | { ok: true; valor: number; erro?: never }
  | { ok: false; valor?: never; erro: string };

/**
 * Converte o `income` recebido no corpo da requisição em um número confiável.
 *
 * Aceita número ou texto numérico. Recusa, com mensagem pronta para devolver
 * ao cliente: qualquer outro tipo, texto não numérico, negativo, zero e valor
 * acima de `MAX_MONEY`.
 *
 * O valor devolvido vem arredondado aos centavos. É ELE que deve ir para o
 * prompt — nunca a entrada crua, senão a guarda não serve para nada.
 */
export function validarRenda(entrada: unknown): RendaValidada {
  // A guarda de tipo vem primeiro, e é a razão de esta função existir.
  //
  // Sem ela, `parseMoney` recebe o valor e faz `String(entrada)` por dentro:
  // o array [5] vira "5" e passa como renda de R$ 5,00; um objeto vira
  // "[object Object]" e cai em null por acaso, não por decisão. Tipo errado
  // precisa ser recusado por ser tipo errado.
  if (typeof entrada !== 'number' && typeof entrada !== 'string') {
    return { ok: false, erro: 'Informe a renda mensal como número.' };
  }

  // Cobre NaN e Infinity, que são `typeof 'number'` e passariam na guarda
  // acima. `parseMoney` já recusa os dois, mas a mensagem fica melhor aqui:
  // "informe como número" é mais útil do que "valor inválido" para quem está
  // depurando a chamada.
  if (typeof entrada === 'number' && !Number.isFinite(entrada)) {
    return { ok: false, erro: 'Informe a renda mensal como número.' };
  }

  // `max` explícito, embora `MAX_MONEY` já seja o padrão: o teto da rota fica
  // visível aqui, sem precisar abrir validation.ts para saber qual é.
  const resultado = validateMoney(entrada, 'valor de renda', { max: MAX_MONEY });

  if (!resultado.ok) {
    return { ok: false, erro: resultado.error ?? 'Informe um valor de renda válido.' };
  }

  return { ok: true, valor: resultado.value as number };
}
