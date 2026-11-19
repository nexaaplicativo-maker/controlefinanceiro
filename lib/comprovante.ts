/**
 * Comprovante anexado ao lançamento — validação pura, sem I/O.
 *
 * Antes desta regra, o upload ao bucket `receipts` não checava nada: nem MIME,
 * nem tamanho, e a extensão do objeto gravado era um pedaço do nome escolhido
 * pelo usuário (`receiptFile.name.split('.').pop()`). Dava para guardar
 * `payload.html` no bucket, e um arquivo grande estourava a cota de 1 GB do
 * Supabase free — que é compartilhada por todos os usuários. É o achado M-1 de
 * `docs/auditoria-seguranca-2026-11-19.md`.
 *
 * Por que a extensão vem do MIME validado, nunca do nome: o nome é dado do
 * usuário, e o caminho no Storage é dado nosso. O nome só participa de um
 * desempate (HEIC sem MIME, abaixo) e nunca chega ao objeto gravado.
 *
 * Por que o teto é 10 MiB e NÃO os 4 MB de `app/api/extract/route.ts`: são
 * dois caminhos diferentes, de propósito. Lá o arquivo vira base64 na memória
 * de uma função serverless e passa pela borda de ~4,5 MB da Vercel, e o
 * cliente ainda reduz a imagem antes (`lib/imagem.ts`). Aqui o arquivo vai cru
 * para o Storage, e o teto espelha o `file_size_limit` já aplicado no bucket
 * pelo dono. Unificar os dois seria regressão num dos lados.
 *
 * Fora de escopo aqui: conferir magic number do conteúdo (achado B-1 da mesma
 * auditoria). Esta validação é de cliente; a camada que vale de verdade é a
 * configuração do bucket no painel, já que o navegador fala direto com o
 * Storage.
 */

/**
 * Lista fechada do que o produto aceita como comprovante.
 *
 * Esta é a lista que vai em `allowed_mime_types` do bucket `receipts` no
 * painel, e é a mesma usada por `app/api/extract/route.ts` — é a mesma
 * pergunta ("que tipo de comprovante o produto aceita"), então tem um dono só.
 * Tipada como `readonly string[]` porque quem consome compara com
 * `file.type`, que é `string`.
 */
export const TIPOS_COMPROVANTE: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

/**
 * Extensão gravada no Storage para cada tipo aceito.
 *
 * `image/jpeg` grava `jpg`, não `jpeg`. Toda chave aqui tem que estar em
 * `TIPOS_COMPROVANTE` e vice-versa — há teste de guarda para isso, porque MIME
 * aceito sem extensão correspondente geraria caminho com `undefined` dentro.
 */
export const EXTENSAO_POR_TIPO: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};

/** 10 MiB — espelha o `file_size_limit` do bucket `receipts`. */
export const MAX_BYTES_COMPROVANTE = 10 * 1024 * 1024;

/**
 * Valor do `accept` do input de arquivo.
 *
 * Inclui as extensões `.heic`/`.heif` além dos MIME porque é justamente nesses
 * formatos que o navegador às vezes não declara tipo nenhum — sem a extensão
 * na lista, o seletor de arquivos do sistema esconderia a foto do iPhone.
 */
export const ACCEPT_COMPROVANTE = [...TIPOS_COMPROVANTE, '.heic', '.heif'].join(',');

/** Nomes que o usuário reconhece, para a mensagem de recusa. */
const FORMATOS_ACEITOS_LEGIVEL = 'JPG, PNG, WEBP, HEIC ou PDF';

/** Dados do arquivo escolhido. Primitivos, e não um `File`, para a regra ser
 *  testável sem DOM e para deixar explícito que o nome entra como dado de
 *  decisão, nunca como dado gravado. */
export interface ArquivoComprovante {
  nome: string;
  /** `file.type` do navegador — pode vir vazio. */
  tipo: string;
  /** `file.size`, em bytes. */
  bytes: number;
}

export type ResultadoComprovante =
  | { ok: true; contentType: string; extensao: string }
  | { ok: false; erro: string };

/** Último segmento depois do ponto final, em minúsculas. Null quando não há. */
function extensaoDoNome(nome: string): string | null {
  const limpo = String(nome ?? '').trim().toLowerCase();
  const corte = limpo.lastIndexOf('.');
  if (corte === -1 || corte === limpo.length - 1) return null;
  return limpo.slice(corte + 1);
}

/**
 * Decide qual é o tipo do arquivo.
 *
 * O MIME declarado manda. A extensão do nome só é consultada quando o
 * navegador não declarou nada (`''` ou `application/octet-stream`) e só
 * resolve `.heic`/`.heif`: alguns navegadores não informam o MIME de foto de
 * iPhone, e recusar isso quebraria caso legítimo. Qualquer outra extensão sem
 * MIME é recusada — o desempate pelo nome não é uma porta de entrada geral.
 */
function resolverTipo(arquivo: ArquivoComprovante): string | null {
  const declarado = String(arquivo.tipo ?? '').trim().toLowerCase();
  if (declarado && declarado !== 'application/octet-stream') return declarado;

  const ext = extensaoDoNome(arquivo.nome);
  if (ext === 'heic') return 'image/heic';
  if (ext === 'heif') return 'image/heif';
  return null;
}

/**
 * Valida o arquivo e devolve o que o upload precisa: o `contentType` a forçar
 * e a extensão a usar no caminho.
 *
 * Forçar o `contentType` não é detalhe: sem ele o SDK do Supabase manda o
 * `file.type` do navegador, que no caso HEIC sem MIME é `''` ou
 * `application/octet-stream`. No dia em que o dono preencher
 * `allowed_mime_types` no painel, o upload de iPhone passaria a ser recusado
 * pelo bucket. Normalizar o tipo aqui é o que torna aquela configuração segura
 * de aplicar.
 */
export function validarComprovante(arquivo: ArquivoComprovante): ResultadoComprovante {
  const tipo = resolverTipo(arquivo);
  const extensao = tipo ? EXTENSAO_POR_TIPO[tipo] : undefined;

  if (!tipo || !TIPOS_COMPROVANTE.includes(tipo) || !extensao) {
    return {
      ok: false,
      erro: `Esse tipo de arquivo não serve como comprovante. Envie ${FORMATOS_ACEITOS_LEGIVEL}.`,
    };
  }

  if (!Number.isFinite(arquivo.bytes) || arquivo.bytes <= 0) {
    return {
      ok: false,
      erro: 'Esse arquivo está vazio. Escolha o comprovante de novo.',
    };
  }

  if (arquivo.bytes > MAX_BYTES_COMPROVANTE) {
    // Arredonda para cima: com `toFixed(1)` um arquivo de 10.485.761 bytes
    // viraria "10.0 MB e o limite é 10 MB", dizendo ao usuário que está dentro
    // do limite que acabou de recusá-lo.
    const mb = (Math.ceil((arquivo.bytes / 1024 / 1024) * 10) / 10).toFixed(1);
    return {
      ok: false,
      erro: `O comprovante tem ${mb} MB e o limite é 10 MB. Envie uma versão menor.`,
    };
  }

  return { ok: true, contentType: tipo, extensao };
}
