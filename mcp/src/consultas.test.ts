import { describe, it, expect } from 'vitest';
import { TOOLS, acharTool } from './consultas.js';
import { COLUNAS_PROIBIDAS } from './seguranca.js';

/** Validação dos parâmetros das tools que recebem janela de dias. */
function validar(nome: string, valor: unknown) {
  const tool = acharTool(nome);
  if (!tool?.parametro) throw new Error(`${nome} não tem parâmetro`);
  return tool.parametro.schema.safeParse(valor);
}

describe('catálogo de tools', () => {
  it('tem exatamente as nove tools combinadas', () => {
    expect(TOOLS.map(t => t.nome).sort()).toEqual([
      'ativacao_retencao',
      'cadastros_por_dia',
      'erros_7d',
      'feedback_recente',
      'feedback_resumo',
      'perfil_agregado',
      'resumo_geral',
      'uso_ia',
      'volume_dados',
    ]);
  });

  it('toda tool tem descrição em português e não trivial', () => {
    for (const t of TOOLS) {
      // Longa o bastante para o Claude distinguir uma tool da outra.
      expect(t.descricao.length).toBeGreaterThan(80);
      // Palavras funcionais do português. Acento não serve de prova: há
      // frase inteira correta sem nenhum ("Use para quantos cadastros...").
      expect(t.descricao.toLowerCase()).toMatch(/\b(para|que|quantos|quais|uso|sobre)\b/);
      // Descrição que só repete o nome da tool não ajuda ninguém a escolher.
      expect(t.descricao.toLowerCase()).not.toBe(t.nome.replace(/_/g, ' '));
    }
  });

  it('toda descrição diz quando usar, não só o que é', () => {
    // É o que faz o Claude escolher a tool certa a partir da pergunta do
    // dono em vez de chamar a primeira que parecer próxima.
    for (const t of TOOLS) {
      expect(t.descricao.toLowerCase()).toContain('use para');
    }
  });

  it('toda consulta aponta para o schema mcp, nunca para public', () => {
    for (const t of TOOLS) {
      expect(t.view).toMatch(/^mcp\./);
      expect(t.sql).toContain('FROM mcp.');
      expect(t.sql).not.toMatch(/\bpublic\./);
    }
  });

  it('toda consulta leva LIMIT 100', () => {
    for (const t of TOOLS) {
      expect(t.sql).toMatch(/LIMIT 100\s*$/);
    }
  });

  it('nenhuma consulta escreve no banco', () => {
    for (const t of TOOLS) {
      expect(t.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT)\b/i);
      expect(t.sql.trimStart().toUpperCase().startsWith('SELECT')).toBe(true);
    }
  });

  it('nenhuma consulta pede coluna proibida pelo nome', () => {
    for (const t of TOOLS) {
      for (const coluna of COLUNAS_PROIBIDAS) {
        expect(t.sql.toLowerCase()).not.toMatch(new RegExp(`\\b${coluna}\\b`));
      }
    }
  });

  it('só usa $1, e só onde há parâmetro declarado', () => {
    for (const t of TOOLS) {
      const temPlaceholder = t.sql.includes('$1');
      expect(temPlaceholder).toBe(t.parametro !== undefined);
      // $2 em diante indicaria consulta que o servidor não sabe alimentar.
      expect(t.sql).not.toMatch(/\$[2-9]/);
    }
  });

  it('a janela de dias nunca é interpolada na string', () => {
    // Se `dias` virasse texto concatenado, o teste acima passaria e a
    // injeção continuaria possível. Aqui garantimos o cast explícito.
    for (const t of TOOLS.filter(x => x.parametro)) {
      expect(t.sql).toContain('$1::int');
    }
  });

  it('acharTool devolve undefined para nome desconhecido', () => {
    expect(acharTool('tabela_de_usuarios')).toBeUndefined();
    expect(acharTool('')).toBeUndefined();
  });
});

describe('validação zod — cadastros_por_dia (1 a 90)', () => {
  it('aceita as pontas e o meio', () => {
    for (const v of [1, 45, 90]) expect(validar('cadastros_por_dia', v).success).toBe(true);
  });

  it('recusa fora da faixa', () => {
    for (const v of [0, -1, 91, 365]) {
      expect(validar('cadastros_por_dia', v).success).toBe(false);
    }
  });

  it('recusa não inteiro', () => {
    expect(validar('cadastros_por_dia', 7.5).success).toBe(false);
  });

  it('recusa texto, nulo e objeto', () => {
    for (const v of ['30', null, undefined, {}, [], true]) {
      expect(validar('cadastros_por_dia', v).success).toBe(false);
    }
  });

  it('recusa NaN e Infinity', () => {
    for (const v of [NaN, Infinity, -Infinity]) {
      expect(validar('cadastros_por_dia', v).success).toBe(false);
    }
  });

  it('recusa tentativa de injeção vinda como string', () => {
    expect(validar('cadastros_por_dia', '1; DROP TABLE transactions').success).toBe(false);
  });
});

describe('validação zod — uso_ia (1 a 60)', () => {
  it('aceita as pontas', () => {
    expect(validar('uso_ia', 1).success).toBe(true);
    expect(validar('uso_ia', 60).success).toBe(true);
  });

  it('recusa 61, que passaria no limite da outra tool', () => {
    expect(validar('uso_ia', 61).success).toBe(false);
    expect(validar('uso_ia', 90).success).toBe(false);
  });

  it('recusa zero e negativo', () => {
    expect(validar('uso_ia', 0).success).toBe(false);
    expect(validar('uso_ia', -30).success).toBe(false);
  });
});

describe('tools sem parâmetro', () => {
  it('as outras sete não declaram parâmetro', () => {
    const semParametro = TOOLS.filter(t => !t.parametro).map(t => t.nome).sort();
    expect(semParametro).toEqual([
      'ativacao_retencao',
      'erros_7d',
      'feedback_recente',
      'feedback_resumo',
      'perfil_agregado',
      'resumo_geral',
      'volume_dados',
    ]);
  });
});
