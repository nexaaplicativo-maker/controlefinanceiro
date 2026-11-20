import { describe, it, expect } from 'vitest';
import { primeiroNome, saudacao, saudacaoPorHora } from './saudacao';

/**
 * O que estes testes protegem: a primeira linha da tela inicial. Três coisas
 * podem regredir aqui sem ninguém perceber:
 *
 * 1. o e-mail voltar a ser usado como nome ("souza.higor"), ou um "Usuário"
 *    genérico reaparecer no lugar da saudação sozinha;
 * 2. a capitalização comer o hífen de nomes compostos ("Ana-Luísa" virando
 *    "Ana-luísa") ou perder acento;
 * 3. a saudação voltar a depender do relógio interno, o que a torna
 *    intestável — é por isso que `saudacao` aceita a data por parâmetro.
 */

describe('primeiroNome — quando existe nome', () => {
  it('devolve só o primeiro nome, descartando o sobrenome', () => {
    expect(primeiroNome('Higor Souza')).toBe('Higor');
    expect(primeiroNome('Maria Clara de Oliveira Santos')).toBe('Maria');
  });

  it('ignora espaços nas pontas e espaços repetidos no meio', () => {
    expect(primeiroNome('   Higor   Souza  ')).toBe('Higor');
    expect(primeiroNome('\tHigor\nSouza')).toBe('Higor');
  });

  it('capitaliza nome digitado em caixa alta', () => {
    expect(primeiroNome('HIGOR')).toBe('Higor');
    expect(primeiroNome('HIGOR SOUZA')).toBe('Higor');
  });

  it('capitaliza nome digitado em caixa baixa', () => {
    expect(primeiroNome('higor souza')).toBe('Higor');
  });

  it('preserva acento e trata o hífen como parte do mesmo primeiro nome', () => {
    expect(primeiroNome('Ana-Luísa Prado')).toBe('Ana-Luísa');
    expect(primeiroNome('ANA-LUÍSA PRADO')).toBe('Ana-Luísa');
    expect(primeiroNome('josé antônio')).toBe('José');
  });

  it('capitaliza nome de uma letra só', () => {
    // `slice(1)` de uma string de um caractere devolve `''`. É o caminho em
    // que uma capitalização reescrita com índices passaria a concatenar
    // `undefined` — e "Bom dia, undefined" é exatamente o tipo de linha que
    // esta função existe para impedir.
    expect(primeiroNome('a')).toBe('A');
    expect(primeiroNome('é')).toBe('É');
    expect(primeiroNome('a souza')).toBe('A');
  });

  it('ignora espaço no fim e o espaço que não quebra (U+00A0)', () => {
    expect(primeiroNome('Higor ')).toBe('Higor');
    // Nome colado de outra tela ou de uma página web vem com U+00A0 no lugar
    // do espaço comum. Ele é coberto por `\s` e por `trim()`, então separa
    // primeiro nome de sobrenome como qualquer espaço — sem isto, a saudação
    // mostraria o nome inteiro ("Higor Souza") onde cabe só o primeiro.
    expect(primeiroNome('Higor Souza')).toBe('Higor');
    expect(primeiroNome(' Higor ')).toBe('Higor');
  });
});

describe('primeiroNome — quando não existe nome', () => {
  it('devolve string vazia para vazio, nulo, indefinido e só espaços', () => {
    expect(primeiroNome('')).toBe('');
    expect(primeiroNome(null)).toBe('');
    expect(primeiroNome(undefined)).toBe('');
    expect(primeiroNome('   ')).toBe('');
    expect(primeiroNome('\n\t ')).toBe('');
  });
});

describe('primeiroNome — entrada fora do esperado', () => {
  it('não lança com nome absurdamente longo e não o corta por conta própria', () => {
    // Quem limita o tamanho na tela é o CSS (`truncate`), não esta função:
    // cortar aqui esconderia o dado de quem usa o valor em outro contexto.
    const longo = 'a'.repeat(5000);
    const r = primeiroNome(longo);
    expect(r).toHaveLength(5000);
    expect(r.startsWith('A')).toBe(true);
  });

  it('não lança com nome formado só por separadores', () => {
    expect(primeiroNome('---')).toBe('---');
  });

  it('devolve dígitos como estão, sem tentar interpretá-los', () => {
    // A função não julga se o valor "parece nome": se o campo do perfil vier
    // com "123", a tela mostra "123". Feio de ler, mas é o dado real — o que
    // não pode é a função quebrar nem inventar um nome no lugar.
    expect(primeiroNome('123')).toBe('123');
    expect(primeiroNome('123 456')).toBe('123');
    expect(primeiroNome('3po')).toBe('3po');
  });
});

describe('saudacaoPorHora — bordas das três faixas', () => {
  it('trata a manhã de 0h a 11h', () => {
    expect(saudacaoPorHora(0)).toBe('Bom dia');
    expect(saudacaoPorHora(11)).toBe('Bom dia');
  });

  it('trata a tarde de 12h a 17h', () => {
    expect(saudacaoPorHora(12)).toBe('Boa tarde');
    expect(saudacaoPorHora(17)).toBe('Boa tarde');
  });

  it('trata a noite de 18h a 23h', () => {
    expect(saudacaoPorHora(18)).toBe('Boa noite');
    expect(saudacaoPorHora(23)).toBe('Boa noite');
  });
});

describe('saudacao — com data fixa, sem depender do relógio', () => {
  // Datas montadas com os componentes locais de propósito: a saudação fala do
  // relógio de quem olha a tela, não de UTC.
  it('usa a hora local da data recebida', () => {
    expect(saudacao(new Date(2026, 10, 20, 7, 30))).toBe('Bom dia');
    expect(saudacao(new Date(2026, 10, 20, 11, 59))).toBe('Bom dia');
    expect(saudacao(new Date(2026, 10, 20, 12, 0))).toBe('Boa tarde');
    expect(saudacao(new Date(2026, 10, 20, 17, 59))).toBe('Boa tarde');
    expect(saudacao(new Date(2026, 10, 20, 18, 0))).toBe('Boa noite');
    expect(saudacao(new Date(2026, 10, 20, 23, 59))).toBe('Boa noite');
  });

  /* Comparar `saudacao(data)` com `saudacao(data)` não provaria nada: duas
     chamadas no mesmo milissegundo passariam igual se a função ignorasse o
     argumento e lesse o relógio. O que prova é o argumento MUDAR o resultado. */
  it('usa o argumento, e não o relógio do sistema', () => {
    const manha = new Date(2026, 0, 1, 9, 0);
    const noite = new Date(2026, 0, 1, 23, 0);
    expect(saudacao(manha)).toBe('Bom dia');
    expect(saudacao(noite)).toBe('Boa noite');
    expect(saudacao(manha)).not.toBe(saudacao(noite));
  });

  it('vira no milissegundo exato do meio-dia e das seis da tarde', () => {
    // Os testes acima param no minuto (11:59 / 12:00). O corte real está em
    // `hora < 12`, então o último instante da manhã é 11:59:59.999 — é aí que
    // uma troca de `<` por `<=`, ou um arredondamento de hora, apareceria.
    expect(saudacao(new Date(2026, 10, 20, 11, 59, 59, 999))).toBe('Bom dia');
    expect(saudacao(new Date(2026, 10, 20, 12, 0, 0, 0))).toBe('Boa tarde');
    expect(saudacao(new Date(2026, 10, 20, 17, 59, 59, 999))).toBe('Boa tarde');
    expect(saudacao(new Date(2026, 10, 20, 18, 0, 0, 0))).toBe('Boa noite');
  });
});

describe('saudacao — sem argumento, que é como a tela chama', () => {
  /* O cabeçalho chama `saudacao()` sem nada: o valor padrão do parâmetro é o
     único caminho que roda em produção, e era o único que nenhum teste
     cobria. Trocar `= new Date()` por uma data fixa não reprovaria nada. */
  it('usa o relógio local e concorda com `saudacaoPorHora` da hora atual', () => {
    // A hora é lida antes e depois para o teste não falhar na virada: se a
    // chamada cair justo em 11:59:59.999, as duas respostas são aceitáveis.
    const antes = new Date().getHours();
    const resultado = saudacao();
    const depois = new Date().getHours();
    expect([saudacaoPorHora(antes), saudacaoPorHora(depois)]).toContain(resultado);
  });

  it('devolve sempre uma das três saudações, nunca vazio', () => {
    expect(['Bom dia', 'Boa tarde', 'Boa noite']).toContain(saudacao());
  });
});
