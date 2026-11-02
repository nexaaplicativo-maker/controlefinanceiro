import { describe, it, expect } from 'vitest';
import { caminhoDoComprovante } from './receipts-caminho';

/**
 * O que estes testes protegem: o bucket `receipts` vai virar privado, e a
 * partir daí todo comprovante precisa de URL assinada. Assinar exige o
 * CAMINHO do arquivo. Registro novo já guarda o caminho; registro antigo
 * guarda a URL pública inteira, e extrair o caminho dela errado significa
 * comprovante que não abre mais.
 */

const CAMINHO = '7c9e6679-7425-40de-944b-e07fc1f90ae7/1759512345678.jpg';
const BASE = 'https://abcdefgh.supabase.co/storage/v1/object/public/receipts/';

describe('caminhoDoComprovante', () => {
  it('devolve o caminho intacto quando o registro já é novo', () => {
    expect(caminhoDoComprovante(CAMINHO)).toBe(CAMINHO);
  });

  it('extrai o caminho de uma URL pública legada', () => {
    expect(caminhoDoComprovante(BASE + CAMINHO)).toBe(CAMINHO);
  });

  it('descarta a query string, que não faz parte do caminho', () => {
    expect(caminhoDoComprovante(`${BASE}${CAMINHO}?t=1759512345`)).toBe(CAMINHO);
  });

  it('descarta o fragmento', () => {
    expect(caminhoDoComprovante(`${BASE}${CAMINHO}#pagina=2`)).toBe(CAMINHO);
  });

  it('decodifica percent-encoding do nome do arquivo', () => {
    expect(caminhoDoComprovante(`${BASE}abc/nota%20fiscal.pdf`)).toBe('abc/nota fiscal.pdf');
  });

  it('aceita http além de https', () => {
    expect(caminhoDoComprovante(BASE.replace('https://', 'http://') + CAMINHO)).toBe(CAMINHO);
  });

  it('não confunde a URL assinada com a pública: não há caminho a extrair', () => {
    const assinada = 'https://abcdefgh.supabase.co/storage/v1/object/sign/receipts/x.jpg?token=ey';
    expect(caminhoDoComprovante(assinada)).toBeNull();
  });

  it('devolve null para URL de outro formato, em vez de inventar caminho', () => {
    expect(caminhoDoComprovante('https://exemplo.com/foto.jpg')).toBeNull();
  });

  it('devolve null quando a URL termina no bucket, sem arquivo', () => {
    expect(caminhoDoComprovante(BASE)).toBeNull();
  });

  it('trata vazio, null e undefined', () => {
    expect(caminhoDoComprovante('')).toBeNull();
    expect(caminhoDoComprovante(null)).toBeNull();
    expect(caminhoDoComprovante(undefined)).toBeNull();
  });
});
