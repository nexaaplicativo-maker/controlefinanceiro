import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/api-auth';
import { checkRateLimit, rateLimitResponse } from '../../../lib/rate-limit';
import { vocabularioParaPrompt } from '../../../lib/subcategorias';
import { normalizarItensExtraidos } from '../../../lib/extracao';

/**
 * Teto do arquivo aceito.
 *
 * Menor de propósito que o corte da Vercel (~4,5 MB no corpo da requisição):
 * assim a mensagem é nossa e diz o que fazer, em vez de um erro cru da
 * plataforma chegando na tela como "Erro da IA".
 *
 * O cliente já reduz a imagem antes de enviar (lib/imagem.ts), então na
 * prática isto só pega arquivo que escapou daquele caminho.
 */
const MAX_BYTES = 4 * 1024 * 1024;

/** O que a leitura sabe processar. Qualquer outra coisa é recusada antes de
 *  virar base64 na memória da função. */
const TIPOS_ACEITOS = [
  'image/jpeg', 'image/png', 'image/webp',
  'image/heic', 'image/heif',
  'application/pdf',
];

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (auth.response) return auth.response;

    const limit = await checkRateLimit(auth.db, auth.user.id, 'extract');
    if (!limit.allowed) return rateLimitResponse(limit);

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo recebido" }, { status: 400 });
    }

    // Sem estas duas checagens, qualquer arquivo ia direto para arrayBuffer()
    // e base64 — inflando um terço no caminho — na memória de uma função
    // serverless, 40 vezes por hora por usuário.
    if (!TIPOS_ACEITOS.includes(file.type)) {
      return NextResponse.json(
        { error: "Esse tipo de arquivo não dá para ler. Envie uma foto (JPG, PNG) ou um PDF." },
        { status: 415 },
      );
    }

    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      return NextResponse.json(
        { error: `A imagem tem ${mb} MB e o limite é 4 MB. Tire a foto de novo ou envie uma versão menor.` },
        { status: 413 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Recursos de IA estão desativados nesta instalação." }, { status: 503 });
    }

    // Correções que o usuário já fez: a IA passa a acertar o que ela errou
    // antes, em vez de repetir o mesmo engano a cada foto do mesmo lugar.
    const { data: corrections } = await auth.db
      .from('category_corrections')
      .select('title_pattern, to_category, hits')
      .eq('user_id', auth.user.id)
      .order('hits', { ascending: false })
      .limit(15);

    const learnedBlock = corrections && corrections.length > 0
      ? `\nAPRENDIZADO DESTE USUÁRIO (prevalece sobre o seu palpite):\nQuando a descrição contiver estes termos, use a categoria indicada:\n${corrections.map((c: any) => `- "${c.title_pattern}" -> ${c.to_category}`).join('\n')}`
      : '';

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");
    const mimeType = file.type;

    // URL OFICIAL E ESTÁVEL DO GOOGLE
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

    const promptText = `
Você é um assistente financeiro de elite. Analise a imagem ou documento em anexo (recibo, nota fiscal, comprovante de PIX recebido/enviado ou folha de anotações).
Extraia TODOS os itens ou despesas individuais e retorne EXATAMENTE E APENAS uma LISTA (Array) JSON válida, sem crases de markdown e sem nenhum texto adicional.

REGRA ESPECIAL PARA PIX: Se a imagem for um comprovante de transferência (PIX, TED, DOC), crie um ÚNICO item. Use como "description" o nome de quem recebeu/enviou ou a descrição do PIX (ex: "PIX - Nome da Pessoa"). Se for um PIX RECEBIDO, defina o "type" como "income". Se for PIX ENVIADO ou PAGAMENTO, defina "type" como "expense".
Para recibos normais e cupons de compras, o "type" é sempre "expense".

FATURA DE CARTÃO: se o documento for uma fatura ou extrato de cartão com várias compras, extraia CADA LINHA como um item separado. Não agrupe, não some, não devolva só o total. O total da fatura, o pagamento mínimo e o saldo anterior NÃO são itens.
Nesse caso marque cada item com "origem": "fatura". Em qualquer outro documento (cupom, recibo, comprovante de PIX), use "origem": "avulso".

O JSON deve ter esta estrutura exata de lista:
[
  {
    "description": "Nome do item 1",
    "amount": 10.50,
    "category": "Variáveis",
    "subcategoria": "Mercado",
    "origem": "avulso",
    "parcela_atual": null,
    "parcela_total": null,
    "type": "expense"
  },
  {
    "description": "PIX Recebido - João",
    "amount": 150.00,
    "category": "Salário",
    "subcategoria": "Outros",
    "origem": "avulso",
    "type": "income"
  }
]
Se houver apenas um gasto ou for um comprovante PIX único, retorne uma lista com 1 objeto. O "amount" deve ser sempre um número float.
REGRA CRUCIAL DE CATEGORIA: Para despesas ("expense"), o campo "category" DEVE OBRIGATORIAMENTE ser um destes quatro: "Contas Fixas", "Variáveis", "Cartões" ou "Investimentos". Para receitas ("income"), use "Salário" ou "Renda Extra". É terminantemente proibido usar outras categorias.

SE "origem" FOR "fatura": não avalie se a compra é fixa ou variável. Toda compra que veio numa fatura de cartão é "category": "Cartões", sem exceção — inclusive assinatura, mercado e conta que normalmente seria fixa. O que a compra É entra em "subcategoria", não em "category".

REGRA DE PARCELAMENTO: a fatura marca compra parcelada como "03/10", "PARC 3/10" ou "3 de 10" — é a terceira de dez cobranças. Quando a linha tiver essa marca, preencha "parcela_atual": 3 e "parcela_total": 10, e MANTENHA a marca dentro da "description". Compra à vista leva os dois campos como null.
Atenção: só use esses campos quando for mesmo parcelamento. Data de compra ("03/10" numa coluna de data) NÃO é parcela.

REGRA DE SUBCATEGORIA: "category" diz a NATUREZA do gasto; "subcategoria" diz ONDE o dinheiro foi gasto. São perguntas independentes — um Uber no cartão é category "Cartões" e subcategoria "Transporte".
O campo "subcategoria" DEVE ser exatamente um destes: ${vocabularioParaPrompt()}.
Use "Outros" apenas quando a descrição realmente não permitir deduzir. Não invente nome de subcategoria, não use o nome do estabelecimento e não escreva duas juntas.
${learnedBlock}
`;

    const requestBody = {
      contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: mimeType, data: base64Data } }] }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      // O detalhe fica no log do servidor. A resposta do Google pode trazer
      // eco da requisição e nome de modelo, e devolver isso cru ao cliente
      // contradizia a política do catch logo abaixo, que é genérico de
      // propósito.
      console.error("Gemini recusou o arquivo:", response.status, await response.text());
      return NextResponse.json(
        { error: "Não consegui ler esse arquivo agora. Tente de novo em instantes ou envie outra foto." },
        { status: 502 },
      );
    }

    const data = await response.json();
    let textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Clean up potential markdown formatting or thought blocks just in case
    textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    textResponse = textResponse.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();

    const parsedJson = JSON.parse(textResponse);

    // Tudo que precisa ser verdade sobre o resultado e garantido aqui, nao no
    // prompt: o modelo desobedece. Objeto unico vira lista, categoria
    // inventada vira Variaveis, compra de fatura vira Cartoes, subcategoria
    // fora do vocabulario e normalizada. Coberto por lib/extracao.test.ts.
    return NextResponse.json(normalizarItensExtraidos(parsedJson));

  } catch (error: any) {
    // Detalhe fica no log do servidor; o cliente recebe mensagem genérica.
    console.error("Erro na API extract:", error);
    return NextResponse.json({ error: "Não consegui ler esse arquivo. Tente outra foto." }, { status: 500 });
  }
}
