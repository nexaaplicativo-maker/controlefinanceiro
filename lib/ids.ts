/**
 * UUID v4 que também funciona fora de contexto seguro.
 *
 * `crypto.randomUUID()` existe só em **contexto seguro** (HTTPS ou
 * `localhost`). Abrir o app num celular pelo IP da rede
 * (`http://192.168.x.x:3000`) ou num navegador mais antigo deixa a função
 * indefinida, e o app quebrava com "crypto.randomUUID is not a function" —
 * encontrado em Android real em 20/11/2026, ao marcar uma conta como paga.
 *
 * O FORMATO AQUI NÃO É DECORATIVO. Três dos chamadores gravam o valor em
 * coluna `uuid` do Postgres (`installment_group` no `TransactionModal` e no
 * `AiUploadModal`, `import_group` no `AiUploadModal`): um id fora do formato
 * RFC 4122 faz o banco recusar o insert, e o sintoma apareceria como "não
 * consegui salvar o parcelamento", longe daqui.
 */

export function novoId(): string {
  const api: Crypto | undefined =
    typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;

  if (typeof api?.randomUUID === 'function') return api.randomUUID();

  // `getRandomValues` **não** é restrito a contexto seguro: é este o caminho
  // que atende o celular na rede local e o navegador antigo. É aqui que a
  // correção realmente acontece.
  if (typeof api?.getRandomValues === 'function') {
    const bytes = api.getRandomValues(new Uint8Array(16));

    // Versão 4 e variante RFC 4122. Sem estes dois bytes o Postgres ainda
    // aceita, mas o valor deixa de ser um v4 honesto.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Falha nominal, no mesmo espírito de `lib/supabase.ts`: preferimos dizer o
  // que falta a inventar id com `Math.random`, que não é criptográfico e
  // acabaria em coluna `uuid`. Nenhum navegador capaz de rodar este app chega
  // aqui — `getRandomValues` existe desde o IE11.
  throw new Error('Web Crypto indisponível: não é possível gerar id.');
}
