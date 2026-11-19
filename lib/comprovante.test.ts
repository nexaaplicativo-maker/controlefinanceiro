import { describe, it, expect } from 'vitest';
import {
  ACCEPT_COMPROVANTE,
  EXTENSAO_POR_TIPO,
  MAX_BYTES_COMPROVANTE,
  TIPOS_COMPROVANTE,
  validarComprovante,
} from './comprovante';

/**
 * O que estes testes protegem: o único upload direto ao Storage do app não
 * validava nada, e a extensão do objeto gravado vinha do nome escolhido pelo
 * usuário (achado M-1 da auditoria). Três coisas podem regredir aqui sem
 * ninguém perceber:
 *
 * 1. o nome do arquivo voltar a influenciar a extensão gravada no bucket;
 * 2. a tolerância a foto de iPhone sem MIME virar porta de entrada geral;
 * 3. alguém "unificar" este teto com os 4 MB da rota de IA, ou a lista de MIME
 *    divergir do `allowed_mime_types` configurado no painel.
 */

const UM_MB = 1024 * 1024;

/** Arquivo plausível, para o teste só variar o que está em questão. */
const arquivo = (over: Partial<{ nome: string; tipo: string; bytes: number }> = {}) => ({
  nome: 'comprovante.jpg',
  tipo: 'image/jpeg',
  bytes: UM_MB,
  ...over,
});

describe('validarComprovante — tipos aceitos', () => {
  for (const tipo of TIPOS_COMPROVANTE) {
    it(`aceita ${tipo} e devolve o mesmo contentType`, () => {
      const r = validarComprovante(arquivo({ tipo, nome: 'arquivo.bin' }));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.contentType).toBe(tipo);
        expect(r.extensao).toBe(EXTENSAO_POR_TIPO[tipo]);
      }
    });
  }

  it('grava jpg (não jpeg) para image/jpeg', () => {
    const r = validarComprovante(arquivo({ tipo: 'image/jpeg', nome: 'foto.jpeg' }));
    expect(r.ok && r.extensao).toBe('jpg');
  });
});

describe('validarComprovante — HEIC/HEIF sem MIME declarado', () => {
  it('aceita tipo vazio quando o nome termina em .heic', () => {
    const r = validarComprovante(arquivo({ tipo: '', nome: 'IMG_0042.heic' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.contentType).toBe('image/heic');
      expect(r.extensao).toBe('heic');
    }
  });

  it('aceita application/octet-stream com nome .HEIF, sem olhar a caixa', () => {
    const r = validarComprovante(arquivo({ tipo: 'application/octet-stream', nome: 'FOTO.HEIF' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.contentType).toBe('image/heif');
      expect(r.extensao).toBe('heif');
    }
  });

  it('recusa PDF sem MIME: o desempate pelo nome existe só para heic/heif', () => {
    const r = validarComprovante(arquivo({ tipo: '', nome: 'fatura.pdf' }));
    expect(r.ok).toBe(false);
  });

  it('recusa nome sem ponto e sem MIME, sem lançar exceção', () => {
    const r = validarComprovante(arquivo({ tipo: '', nome: 'comprovante' }));
    expect(r.ok).toBe(false);
  });
});

describe('validarComprovante — tipos recusados', () => {
  for (const tipo of ['text/html', 'image/svg+xml', 'application/zip']) {
    it(`recusa ${tipo} citando os formatos aceitos`, () => {
      const r = validarComprovante(arquivo({ tipo, nome: 'arquivo.bin' }));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.erro).toContain('JPG');
        expect(r.erro).toContain('PDF');
      }
    });
  }

  it('recusa .html mesmo com .heic no meio do nome', () => {
    const r = validarComprovante(arquivo({ tipo: 'text/html', nome: 'comprovante.heic.html' }));
    expect(r.ok).toBe(false);
  });
});

describe('validarComprovante — o nome não chega ao objeto gravado', () => {
  it('usa a extensão do MIME, não a do nome', () => {
    const r = validarComprovante(arquivo({ tipo: 'image/png', nome: 'payload.html' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.extensao).toBe('png');
      expect(r.contentType).toBe('image/png');
    }
  });
});

describe('validarComprovante — tamanho', () => {
  it('aceita exatamente o teto', () => {
    expect(validarComprovante(arquivo({ bytes: MAX_BYTES_COMPROVANTE })).ok).toBe(true);
  });

  it('recusa um byte acima do teto, informando tamanho e limite', () => {
    const r = validarComprovante(arquivo({ bytes: MAX_BYTES_COMPROVANTE + 1 }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // Arredondado para cima, de propósito: "10.0 MB e o limite é 10 MB"
      // diria ao usuário que o arquivo está dentro do limite que o recusou.
      expect(r.erro).toContain('10.1 MB');
      expect(r.erro).toContain('limite é 10 MB');
    }
  });

  it('recusa arquivo de 0 byte: gera objeto que nunca abre', () => {
    const r = validarComprovante(arquivo({ bytes: 0 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('vazio');
  });
});

describe('constantes — guardas contra divergência', () => {
  // Conjunto escrito à mão, de propósito: é o único teste que falha se alguém
  // acrescentar ou remover um MIME da lista. Os demais derivam de
  // TIPOS_COMPROVANTE e por isso acompanhariam a mudança em silêncio. Esta
  // lista tem que ser idêntica ao `allowed_mime_types` do bucket `receipts`:
  // divergir dela recusa upload legítimo em produção, e a lista também governa
  // o que /api/extract aceita.
  it('a lista de MIME é exatamente a combinada com o bucket', () => {
    expect([...TIPOS_COMPROVANTE].sort()).toEqual([
      'application/pdf',
      'image/heic',
      'image/heif',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
  });

  it('o teto é 10 MiB e é diferente dos 4 MB da rota de IA, de propósito', () => {
    expect(MAX_BYTES_COMPROVANTE).toBe(10 * 1024 * 1024);
    expect(MAX_BYTES_COMPROVANTE).not.toBe(4 * 1024 * 1024);
  });

  it('ACCEPT_COMPROVANTE cobre os 6 MIME mais .heic e .heif', () => {
    const partes = ACCEPT_COMPROVANTE.split(',');
    for (const tipo of TIPOS_COMPROVANTE) expect(partes).toContain(tipo);
    expect(partes).toContain('.heic');
    expect(partes).toContain('.heif');
  });

  it('todo MIME aceito tem extensão, e toda extensão tem MIME aceito', () => {
    expect(Object.keys(EXTENSAO_POR_TIPO).sort()).toEqual([...TIPOS_COMPROVANTE].sort());
  });
});

describe('validarComprovante — bytes que não são tamanho de arquivo', () => {
  // `file.size` sempre chega finito e positivo no navegador, mas a ordem das
  // checagens é o que garante isso: se a guarda `Number.isFinite` cair ou for
  // movida para depois da comparação com o teto, `NaN` e `Infinity` passam a
  // atravessar a validação em silêncio — `NaN > MAX` é `false`, então o
  // arquivo seria aceito, e `Infinity` produziria a mensagem "Infinity MB".
  for (const [rotulo, bytes] of [
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negativo', -1],
  ] as const) {
    it(`recusa bytes ${rotulo} sem aceitar e sem mensagem absurda`, () => {
      const r = validarComprovante(arquivo({ bytes }));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.erro).not.toContain('NaN');
        expect(r.erro).not.toContain('Infinity');
      }
    });
  }
});

describe('validarComprovante — MIME com caixa alta ou espaço', () => {
  // O `contentType` devolvido aqui é o que o upload força no objeto do Storage
  // e tem que bater exatamente com o `allowed_mime_types` do bucket, que é
  // sensível à caixa. Devolver o tipo cru do navegador gravaria `IMAGE/JPEG` e
  // o bucket recusaria o upload assim que a lista fosse configurada no painel.
  it('normaliza para minúsculas e devolve o tipo canônico', () => {
    const r = validarComprovante(arquivo({ tipo: 'IMAGE/JPEG', nome: 'foto.JPG' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.contentType).toBe('image/jpeg');
      expect(r.extensao).toBe('jpg');
    }
  });

  it('ignora espaço em volta do tipo declarado', () => {
    const r = validarComprovante(arquivo({ tipo: '  application/pdf  ', nome: 'fatura.pdf' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contentType).toBe('application/pdf');
  });
});

describe('EXTENSAO_POR_TIPO — guarda do valor gravado no bucket', () => {
  // Escrito à mão pelo mesmo motivo da lista de MIME: os testes que percorrem
  // TIPOS_COMPROVANTE comparam a extensão devolvida com este próprio mapa, e
  // por isso acompanhariam um erro de digitação ('pnp') sem falhar — enquanto
  // o objeto gravado no Storage ficaria com a extensão errada para sempre.
  it('cada tipo aceito grava exatamente a extensão combinada', () => {
    expect(EXTENSAO_POR_TIPO).toEqual({
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'image/heif': 'heif',
      'application/pdf': 'pdf',
    });
  });
});

describe('validarComprovante — nome degenerado sem MIME', () => {
  it('recusa nome terminando em ponto, sem lançar exceção', () => {
    expect(validarComprovante(arquivo({ tipo: '', nome: 'comprovante.' })).ok).toBe(false);
  });
});
