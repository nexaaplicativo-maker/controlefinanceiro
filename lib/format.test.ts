import { describe, it, expect } from 'vitest';
import { formatMoney, HIDDEN_MONEY, partesDoValor } from './format';

/** O Intl do pt-BR separa "R$" do número com um espaço sem quebra (U+00A0). */
const NB = ' ';

describe('partesDoValor', () => {
  it('separa reais e centavos, com a vírgula nos centavos', () => {
    expect(partesDoValor(797.02)).toEqual({ reais: `R$${NB}797`, centavos: ',02', oculto: false });
  });

  it('mantém o separador de milhar nos reais', () => {
    expect(partesDoValor(11954)).toEqual({ reais: `R$${NB}11.954`, centavos: ',00', oculto: false });
    expect(partesDoValor(1234567.8)).toEqual({ reais: `R$${NB}1.234.567`, centavos: ',80', oculto: false });
  });

  it('zero tem centavos', () => {
    expect(partesDoValor(0)).toEqual({ reais: `R$${NB}0`, centavos: ',00', oculto: false });
  });

  it('negativo leva o sinal nos reais', () => {
    const p = partesDoValor(-45.5);
    expect(p.reais).toBe(`-R$${NB}45`);
    expect(p.centavos).toBe(',50');
  });

  it('null, undefined e NaN viram zero, nunca "NaN"', () => {
    for (const v of [null, undefined, NaN]) {
      expect(partesDoValor(v)).toEqual({ reais: `R$${NB}0`, centavos: ',00', oculto: false });
    }
  });

  it('modo privado devolve a máscara inteira e nenhum centavo', () => {
    expect(partesDoValor(797.02, false)).toEqual({ reais: HIDDEN_MONEY, centavos: '', oculto: true });
  });

  it('juntas, as partes reproduzem exatamente o texto de formatMoney', () => {
    for (const v of [0, 0.5, 797.02, -1234.56, 1000000, null]) {
      const p = partesDoValor(v);
      expect(p.reais + p.centavos).toBe(formatMoney(v));
    }
  });
});
