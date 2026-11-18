import { describe, it, expect } from 'vitest';
import { buscarTudo, PAGINA, MAX_PAGINAS } from './consultas';

/**
 * O que estes testes protegem: o corte silencioso de 1.000 linhas do
 * PostgREST. Se esta função devolver menos linhas do que existem sem marcar
 * `truncado`, o painel soma um pedaço do mês e exibe um total errado sem
 * nenhum sinal na tela.
 */

/** Banco de mentira: devolve faixas de uma lista. */
function fonte(total: number, pagina: number) {
  const todas = Array.from({ length: total }, (_, i) => ({ id: i }));
  const chamadas: Array<[number, number]> = [];
  const pedir = async (de: number, ate: number) => {
    chamadas.push([de, ate]);
    return { data: todas.slice(de, ate + 1), error: null };
  };
  return { pedir, chamadas, opcoes: { pagina, maxPaginas: MAX_PAGINAS } };
}

describe('buscarTudo — quantidade de linhas', () => {
  it('traz tudo quando cabe em uma página curta', async () => {
    const f = fonte(7, 10);
    const r = await buscarTudo(f.pedir, f.opcoes);
    expect(r.linhas).toHaveLength(7);
    expect(r.truncado).toBe(false);
    expect(f.chamadas).toHaveLength(1);
  });

  it('traz tudo quando precisa de várias páginas', async () => {
    const f = fonte(25, 10);
    const r = await buscarTudo(f.pedir, f.opcoes);
    expect(r.linhas).toHaveLength(25);
    expect(r.truncado).toBe(false);
    expect(f.chamadas).toEqual([[0, 9], [10, 19], [20, 29]]);
  });

  it('pede uma página a mais quando o total é múltiplo exato', async () => {
    // Com 20 linhas e página de 10, a segunda página vem cheia: só a
    // terceira (vazia) prova que acabou. Parar na segunda seria arriscar
    // perder dados sempre que o total caísse redondo.
    const f = fonte(20, 10);
    const r = await buscarTudo(f.pedir, f.opcoes);
    expect(r.linhas).toHaveLength(20);
    expect(r.truncado).toBe(false);
    expect(f.chamadas).toHaveLength(3);
  });

  it('não perde nem duplica linha nas emendas', async () => {
    const f = fonte(25, 10);
    const r = await buscarTudo(f.pedir, f.opcoes);
    expect(r.linhas.map((l: any) => l.id)).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });

  it('lida com lista vazia', async () => {
    const f = fonte(0, 10);
    const r = await buscarTudo(f.pedir, f.opcoes);
    expect(r.linhas).toEqual([]);
    expect(r.truncado).toBe(false);
  });
});

describe('buscarTudo — teto', () => {
  it('marca truncado ao bater no teto de páginas', async () => {
    const f = fonte(1000, 10);
    const r = await buscarTudo(f.pedir, { pagina: 10, maxPaginas: 3 });
    expect(r.linhas).toHaveLength(30);
    expect(r.truncado).toBe(true);
  });

  it('não marca truncado quando acaba exatamente na última página', async () => {
    const f = fonte(29, 10);
    const r = await buscarTudo(f.pedir, { pagina: 10, maxPaginas: 3 });
    expect(r.linhas).toHaveLength(29);
    expect(r.truncado).toBe(false);
  });
});

describe('buscarTudo — erro', () => {
  it('devolve o erro e NENHUMA linha, mesmo com páginas já lidas', async () => {
    // Entregar as páginas que deram certo seria apresentar um total parcial
    // como se fosse o total — o erro que esta função existe para impedir.
    let n = 0;
    const pedir = async () => {
      n++;
      if (n === 2) return { data: null, error: { message: 'caiu' } };
      return { data: Array.from({ length: 10 }, (_, i) => ({ id: i })), error: null };
    };
    const r = await buscarTudo(pedir, { pagina: 10, maxPaginas: 5 });
    expect(r.linhas).toEqual([]);
    expect(r.truncado).toBe(false);
    expect(r.erro?.message).toBe('caiu');
  });

  it('para de pedir assim que uma página falha', async () => {
    let n = 0;
    const pedir = async () => { n++; return { data: null, error: { message: 'caiu' } }; };
    await buscarTudo(pedir, { pagina: 10, maxPaginas: 5 });
    expect(n).toBe(1);
  });
});

describe('buscarTudo — valores padrão', () => {
  it('usa a página de 1000 do PostgREST quando nada é passado', async () => {
    const chamadas: Array<[number, number]> = [];
    const pedir = async (de: number, ate: number) => {
      chamadas.push([de, ate]);
      return { data: [], error: null };
    };
    await buscarTudo(pedir);
    expect(PAGINA).toBe(1000);
    expect(chamadas[0]).toEqual([0, 999]);
  });

  it('o teto padrão cobre com folga a janela do painel', async () => {
    // 42 meses de janela a ~150 lançamentos/mês dá ~6.300 linhas.
    expect(PAGINA * MAX_PAGINAS).toBeGreaterThan(6300 * 3);
  });
});
