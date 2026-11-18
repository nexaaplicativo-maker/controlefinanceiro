import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/api-auth';
import { checkRateLimit, rateLimitResponse } from '../../../lib/rate-limit';
import { validarRenda } from '../../../lib/auto-budget';

export async function POST(req: Request) {
  try {
    const auth = await requireUser(req);
    if (auth.response) return auth.response;

    const limit = await checkRateLimit(auth.db, auth.user.id, 'auto-budget');
    if (!limit.allowed) return rateLimitResponse(limit);

    // Corpo malformado é erro de quem chamou, não falha do servidor: sem este
    // try, um JSON quebrado caía no catch geral e virava 500.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
    }

    // A renda é validada ANTES de qualquer chamada paga ao Gemini. Ver
    // lib/auto-budget.ts para o porquê — em resumo: o valor entra dentro de um
    // prompt, e entrada não verificada dentro de prompt é instrução de graça
    // para quem chamar a rota.
    const renda = validarRenda((body as { income?: unknown } | null)?.income);
    if (!renda.ok) {
      return NextResponse.json({ error: renda.erro }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Recursos de IA estão desativados nesta instalação." }, { status: 503 });
    }

    // Interpola o valor JÁ VALIDADO E NORMALIZADO, nunca `body.income` cru —
    // é isso que fecha a injeção de prompt. Depois de validarRenda, o que
    // entra aqui é garantidamente um número finito e positivo.
    const income = renda.valor;

    const promptText = `Atue como um planejador financeiro de elite.
O usuário ganha R$ ${income} por mês.
Usando a regra 50/30/20 como base, sugira um orçamento realista dividido nestas exatas categorias: "Contas Fixas", "Variáveis" e "Investimentos".
Retorne APENAS um objeto JSON válido, sem NENHUM texto antes ou depois, e sem marcação de crases (markdown). O objeto deve ter esta estrutura:
{
  "Contas Fixas": 1500,
  "Variáveis": 900,
  "Investimentos": 600
}
Os valores numéricos (sem vírgula e sem símbolo de moeda) devem somar no máximo ${income}.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{ parts: [{ text: promptText }] }]
    };

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      // O detalhe fica no log do servidor. Antes esta era a única das três
      // rotas de IA que devolvia o texto cru do Google ao cliente — e a
      // resposta de erro do Gemini traz eco da requisição, nome de modelo e,
      // em alguns casos, parte do prompt. As outras duas já faziam assim.
      console.error("Gemini recusou o orçamento:", response.status, await response.text());
      return NextResponse.json(
        { error: "Não consegui gerar o orçamento agora. Tente de novo em instantes." },
        { status: 502 },
      );
    }

    const data = await response.json();
    let textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedJson = JSON.parse(textResponse);
    return NextResponse.json(parsedJson);

  } catch (error) {
    // Detalhe no log do servidor; o cliente recebe mensagem genérica. Antes
    // isto devolvia `error.message`, que vaza caminho de arquivo e estrutura
    // interna para quem chamar a rota.
    console.error("Erro no auto-budget:", error);
    return NextResponse.json({ error: "Erro ao gerar orçamento. Tente novamente." }, { status: 500 });
  }
}
