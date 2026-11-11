/**
 * F3 — "hoje" precisa ser hoje em Brasília, não em Londres.
 *
 * O caso que motivou: às 21h01 de 31/10 em Brasília, a gravação em UTC já
 * marcava 2026-11-01. O lançamento nascia no mês seguinte.
 */

import { describe, it, expect } from 'vitest';
import { hojeEmSaoPaulo, mesAtual, mesDe, somarDias, somarMeses, diasEntre, domingoDaSemana } from './data';

describe('hojeEmSaoPaulo', () => {
  it('21h de 31/10 em Brasília ainda é 31/10', () => {
    // 2026-11-01T00:00Z = 2026-10-31 21:00 em São Paulo.
    expect(hojeEmSaoPaulo(new Date('2026-11-01T00:00:00Z'))).toBe('2026-10-31');
  });

  it('23h59 de 31/10 em Brasília ainda é 31/10', () => {
    expect(hojeEmSaoPaulo(new Date('2026-11-01T02:59:00Z'))).toBe('2026-10-31');
  });

  it('00h00 de 01/11 em Brasília já é 01/11', () => {
    expect(hojeEmSaoPaulo(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-01');
  });

  it('meio-dia UTC e meio-dia local caem no mesmo dia', () => {
    expect(hojeEmSaoPaulo(new Date('2026-11-01T12:00:00Z'))).toBe('2026-11-01');
  });

  it('vira o ano no horário certo', () => {
    expect(hojeEmSaoPaulo(new Date('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
    expect(hojeEmSaoPaulo(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01');
  });

  it('o mês atual acompanha a virada', () => {
    expect(mesAtual(new Date('2026-11-01T02:00:00Z'))).toBe('2026-10');
    expect(mesAtual(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11');
  });
});

describe('mesDe', () => {
  it('fatia a string, sem construir Date', () => {
    expect(mesDe('2026-11-01')).toBe('2026-11');
    expect(mesDe('2026-01-31')).toBe('2026-01');
  });

  it('o mês sempre tem zero à esquerda, para ordenar como texto', () => {
    expect(mesDe('2026-09-01') < mesDe('2026-10-01')).toBe(true);
  });

  it('aguenta entrada ausente', () => {
    expect(mesDe(null)).toBe('');
    expect(mesDe(undefined)).toBe('');
  });
});

describe('somarDias', () => {
  it('atravessa a virada do mês', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('atravessa a virada do ano', () => {
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('anda para trás', () => {
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('acerta o ano bissexto', () => {
    expect(somarDias('2028-02-28', 1)).toBe('2028-02-29');
    expect(somarDias('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('45 dias à frente, o prazo usado nas contas a vencer', () => {
    expect(somarDias('2026-11-10', 45)).toBe('2026-12-25');
  });
});

describe('diasEntre', () => {
  it('conta dias inteiros', () => {
    expect(diasEntre('2026-11-10', '2026-11-20')).toBe(10);
  });

  it('é negativo quando já passou', () => {
    expect(diasEntre('2026-11-10', '2026-11-02')).toBe(-8);
  });

  it('mesmo dia dá zero', () => {
    expect(diasEntre('2026-11-10', '2026-11-10')).toBe(0);
  });

  it('não escorrega na virada do mês', () => {
    expect(diasEntre('2026-10-31', '2026-11-01')).toBe(1);
  });
});

describe('domingoDaSemana', () => {
  it('domingo é o próprio dia', () => {
    // 2026-11-08 é domingo.
    expect(domingoDaSemana('2026-11-08')).toBe('2026-11-08');
  });

  it('sábado volta para o domingo anterior', () => {
    expect(domingoDaSemana('2026-11-14')).toBe('2026-11-08');
  });

  it('atravessa a virada do mês para trás', () => {
    // 2026-11-02 é segunda; o domingo da semana é 01/11.
    expect(domingoDaSemana('2026-11-02')).toBe('2026-11-01');
  });
});

describe('somarMeses — a regra que o lançamento manual não seguia', () => {
  it('31/01 + 1 mês é 28/02, não 03/03', () => {
    // Com `setMonth` puro o JavaScript transborda para março.
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('o encurtamento não se acumula nas parcelas seguintes', () => {
    // A 3ª parcela de uma compra em 31/01 volta a cair no dia 31.
    expect(somarMeses('2026-01-31', 2)).toBe('2026-03-31');
    expect(somarMeses('2026-01-31', 3)).toBe('2026-04-30');
  });

  it('acerta fevereiro de ano bissexto', () => {
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('uma série de 12 parcelas desde 31/01 cai sempre no mês certo', () => {
    const meses = Array.from({ length: 12 }, (_, i) => somarMeses('2026-01-31', i).slice(0, 7));
    expect(meses).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ]);
  });

  it('vira o ano', () => {
    expect(somarMeses('2026-11-15', 3)).toBe('2027-02-15');
  });

  it('dia 30 em fevereiro também é preso', () => {
    expect(somarMeses('2026-01-30', 1)).toBe('2026-02-28');
  });
});
