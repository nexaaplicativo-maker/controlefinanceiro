import { describe, it, expect } from 'vitest';
import {
  conferirColunas,
  conferirUsuarioDoBanco,
  limitarLinhas,
  COLUNAS_PROIBIDAS,
  MAX_LINHAS,
  TIMEOUT_MS,
  ViolacaoDeSeguranca,
} from './seguranca.js';

/**
 * Estes testes são a prova de que as promessas do README são código, não
 * intenção. Se um deles cair, o servidor passou a poder vazar algo.
 */

describe('conferirColunas — bloqueio de coluna proibida', () => {
  it('deixa passar uma resposta só com números agregados', () => {
    const linhas = [{ dia: '2026-11-18', cadastros: 12, ativos: 9 }];
    expect(() => conferirColunas('mcp.cadastros_por_dia', linhas)).not.toThrow();
  });

  it.each(['user_id', 'email', 'amount', 'balance', 'current_balance'])(
    'recusa a resposta quando aparece a coluna %s',
    coluna => {
      const linhas = [{ total: 10, [coluna]: 'qualquer coisa' }];
      expect(() => conferirColunas('mcp.resumo_geral', linhas)).toThrow(ViolacaoDeSeguranca);
    },
  );

  it('nomeia a view e a coluna no erro, para o conserto ser óbvio', () => {
    const linhas = [{ total: 1, user_id: 'abc' }];
    expect(() => conferirColunas('mcp.resumo_geral', linhas))
      .toThrow(/mcp\.resumo_geral.*user_id/s);
  });

  it('não ecoa o VALOR da coluna proibida na mensagem de erro', () => {
    // Senão o dado vaza justamente pelo caminho criado para impedi-lo.
    const segredo = 'pessoa@exemplo.com';
    const linhas = [{ total: 1, email: segredo }];
    try {
      conferirColunas('mcp.feedback_recente', linhas);
      expect.unreachable('devia ter lançado');
    } catch (erro) {
      expect((erro as Error).message).not.toContain(segredo);
    }
  });

  it('ignora maiúsculas e minúsculas', () => {
    const linhas = [{ total: 1, User_Id: 'abc' }];
    expect(() => conferirColunas('mcp.resumo_geral', linhas)).toThrow(ViolacaoDeSeguranca);
  });

  it('acusa todas as colunas proibidas de uma vez, não só a primeira', () => {
    const linhas = [{ user_id: 'a', amount: 1, email: 'b' }];
    try {
      conferirColunas('mcp.resumo_geral', linhas);
      expect.unreachable('devia ter lançado');
    } catch (erro) {
      const msg = (erro as Error).message;
      expect(msg).toContain('user_id');
      expect(msg).toContain('amount');
      expect(msg).toContain('email');
    }
  });

  it('aceita nome derivado: total_amount é soma da base, não gasto de ninguém', () => {
    const linhas = [{ total_amount: 99999, contas: 40 }];
    expect(() => conferirColunas('mcp.volume_dados', linhas)).not.toThrow();
  });

  it('não explode com resposta vazia', () => {
    expect(() => conferirColunas('mcp.erros_7d', [])).not.toThrow();
  });

  it('a lista de proibidas cobre as cinco do enunciado', () => {
    for (const c of ['user_id', 'email', 'amount', 'balance', 'current_balance']) {
      expect(COLUNAS_PROIBIDAS).toContain(c);
    }
  });
});

describe('limitarLinhas — teto de 100', () => {
  it('corta em 100', () => {
    const muitas = Array.from({ length: 500 }, (_, i) => ({ i }));
    expect(limitarLinhas(muitas)).toHaveLength(100);
  });

  it('não mexe no que já cabe', () => {
    const poucas = Array.from({ length: 7 }, (_, i) => ({ i }));
    expect(limitarLinhas(poucas)).toHaveLength(7);
  });

  it('mantém a ordem e corta do fim', () => {
    const muitas = Array.from({ length: 150 }, (_, i) => ({ i }));
    const cortadas = limitarLinhas(muitas);
    expect(cortadas[0]).toEqual({ i: 0 });
    expect(cortadas[99]).toEqual({ i: 99 });
  });

  it('o teto é exatamente 100 e o timeout 5s', () => {
    expect(MAX_LINHAS).toBe(100);
    expect(TIMEOUT_MS).toBe(5000);
  });
});

describe('conferirUsuarioDoBanco — só mcp_readonly', () => {
  it('aceita a string do usuário somente leitura', () => {
    expect(() =>
      conferirUsuarioDoBanco('postgresql://mcp_readonly:senha@db.exemplo.co:5432/postgres'),
    ).not.toThrow();
  });

  it('recusa postgres, que é o dono do banco', () => {
    expect(() =>
      conferirUsuarioDoBanco('postgresql://postgres:senha@db.exemplo.co:5432/postgres'),
    ).toThrow(ViolacaoDeSeguranca);
  });

  /* O pooler acrescenta `.<ref-do-projeto>` ao nome do usuário. Em projeto
     novo do Supabase a conexão direta é só IPv6, então para muita gente o
     pooler é o único caminho — e recusá-lo tornaria o servidor impossível
     de ligar. O que não pode passar é o PAPEL errado, com ou sem sufixo. */
  it('aceita a forma do pooler, com o sufixo do projeto', () => {
    expect(() =>
      conferirUsuarioDoBanco('postgresql://mcp_readonly.abcdefgh:senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres'),
    ).not.toThrow();
    expect(() =>
      conferirUsuarioDoBanco('postgresql://mcp_readonly.abcdefgh:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'),
    ).not.toThrow();
  });

  it('recusa o dono do banco TAMBÉM na forma do pooler', () => {
    expect(() =>
      conferirUsuarioDoBanco('postgresql://postgres.abcdefgh:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres'),
    ).toThrow(ViolacaoDeSeguranca);
  });

  it('recusa papel parecido que não é o nosso', () => {
    for (const papel of ['mcp_readonl', 'mcp_readonly2', 'mcp_write', 'readonly']) {
      expect(() =>
        conferirUsuarioDoBanco(`postgresql://${papel}:senha@db.exemplo.co:5432/postgres`),
      ).toThrow(ViolacaoDeSeguranca);
    }
  });

  it('recusa string sem usuário', () => {
    expect(() => conferirUsuarioDoBanco('postgresql://db.exemplo.co:5432/postgres'))
      .toThrow(ViolacaoDeSeguranca);
  });

  it('recusa o que nem é URL', () => {
    expect(() => conferirUsuarioDoBanco('cole aqui a senha')).toThrow(ViolacaoDeSeguranca);
  });

  it('não ecoa a senha na mensagem de erro', () => {
    const senha = 'SenhaSuperSecreta123';
    try {
      conferirUsuarioDoBanco(`postgresql://postgres:${senha}@db.exemplo.co:5432/postgres`);
      expect.unreachable('devia ter lançado');
    } catch (erro) {
      expect((erro as Error).message).not.toContain(senha);
    }
  });
});
