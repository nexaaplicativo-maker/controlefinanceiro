import { describe, it, expect, afterEach, vi } from 'vitest';
import { novoId } from './ids';

/**
 * O que estes testes protegem: `installment_group` e `import_group` são
 * colunas `uuid` no Postgres. Em contexto não seguro (celular abrindo o app
 * pelo IP da rede) o `crypto.randomUUID` não existe, e o caminho alternativo
 * precisa devolver um UUID v4 de verdade — se devolver "id-123", o banco
 * recusa o insert e o parcelamento simplesmente não salva.
 *
 * O ambiente do Vitest tem `randomUUID`, então cada caminho só aparece
 * trocando o `globalThis.crypto`, que é o que estes testes fazem.
 */

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('novoId', () => {
  it('usa o crypto.randomUUID quando ele existe', () => {
    const randomUUID = vi.fn(() => '7c9e6679-7425-40de-944b-e07fc1f90ae7');
    vi.stubGlobal('crypto', { randomUUID });

    expect(novoId()).toBe('7c9e6679-7425-40de-944b-e07fc1f90ae7');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('cai no getRandomValues em contexto não seguro, e o formato serve de uuid', () => {
    // Sem `randomUUID`: é o cenário do celular em http://192.168.x.x.
    vi.stubGlobal('crypto', {
      getRandomValues: (b: Uint8Array) => {
        for (let i = 0; i < b.length; i++) b[i] = i * 17;
        return b;
      },
    });

    expect(novoId()).toMatch(UUID_V4);
  });

  it('marca versão 4 e variante RFC 4122 mesmo com bytes todos zerados', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (b: Uint8Array) => b.fill(0),
    });

    // Com tudo zero, só os dois bytes forçados aparecem: 4 na versão e 8 na
    // variante. É o que distingue um v4 honesto de 32 dígitos aleatórios.
    expect(novoId()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('não repete o id entre chamadas', () => {
    const ids = new Set(Array.from({ length: 200 }, () => novoId()));
    expect(ids.size).toBe(200);
  });

  it('falha com mensagem nominal se não houver Web Crypto', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => novoId()).toThrow(/Web Crypto indisponível/);
  });
});
