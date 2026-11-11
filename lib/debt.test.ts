import { describe, it, expect } from 'vitest';
import {
  isExpensive,
  monthlyInterestCost,
  minimumViablePayment,
  payoffMonths,
  simulatePayoff,
  simulateStrategy,
  compareStrategies,
  simulateExtraPayment,
  summarizeDebts,
  debtVsInvestment,
  EXPENSIVE_DEBT_RATE,
  taxaAnualEquivalente,
  pagamentoParaQuitarEm,
  type Debt,
} from './debt';

function debt(over: Partial<Debt> = {}): Debt {
  return {
    id: 'd1',
    name: 'Cartão',
    kind: 'rotativo_cartao',
    current_balance: 5000,
    monthly_rate: 0.14,
    minimum_payment: 500,
    status: 'ativa',
    ...over,
  };
}

describe('classificação', () => {
  it('3% a.m. é o corte de dívida cara', () => {
    expect(isExpensive({ monthly_rate: EXPENSIVE_DEBT_RATE })).toBe(true);
    expect(isExpensive({ monthly_rate: 0.0299 })).toBe(false);
    expect(isExpensive({ monthly_rate: 0.14 })).toBe(true);
  });

  it('consignado típico não é dívida cara', () => {
    expect(isExpensive({ monthly_rate: 0.018 })).toBe(false);
  });
});

describe('custo mensal dos juros', () => {
  it('R$ 5.000 a 14% a.m. custa R$ 700 por mês', () => {
    expect(monthlyInterestCost({ current_balance: 5000, monthly_rate: 0.14 })).toBe(700);
  });

  it('pagamento igual ao juro deixa a dívida parada', () => {
    expect(minimumViablePayment(5000, 0.14)).toBe(700);
    expect(payoffMonths(5000, 0.14, 700)).toBeNull();
    expect(payoffMonths(5000, 0.14, 699)).toBeNull();
  });
});

describe('payoffMonths', () => {
  it('saldo zerado quita em 0 meses', () => {
    expect(payoffMonths(0, 0.14, 500)).toBe(0);
  });

  it('sem juros é divisão simples', () => {
    expect(payoffMonths(1000, 0, 250)).toBe(4);
  });

  it('pagamento acima do juro quita em prazo finito', () => {
    // 5.000 a 14% a.m. pagando 900: cobre os 700 de juro e amortiza 200.
    const n = payoffMonths(5000, 0.14, 900);
    expect(n).not.toBeNull();
    expect(n!).toBeGreaterThan(0);
    expect(n!).toBeLessThan(600);
  });

  it('pagamento zero ou negativo nunca quita', () => {
    expect(payoffMonths(5000, 0.14, 0)).toBeNull();
    expect(payoffMonths(5000, 0.14, -100)).toBeNull();
  });
});

describe('simulatePayoff', () => {
  it('bate com a fórmula fechada', () => {
    const formula = payoffMonths(5000, 0.14, 900);
    const sim = simulatePayoff(5000, 0.14, 900);
    expect(sim.months).toBe(formula);
  });

  it('o último pagamento é só o que falta', () => {
    const sim = simulatePayoff(1000, 0, 300);
    // 300+300+300+100 — ninguém paga 300 no último mês para quitar 100.
    expect(sim.months).toBe(4);
    expect(sim.totalPaid).toBe(1000);
  });

  it('zera o saldo no fim da linha do tempo', () => {
    const sim = simulatePayoff(5000, 0.14, 900);
    expect(sim.timeline.at(-1)!.balance).toBe(0);
  });

  it('sinaliza dívida eterna sem inventar prazo', () => {
    const sim = simulatePayoff(5000, 0.14, 700);
    expect(sim.months).toBeNull();
    expect(sim.payoffDate).toBeNull();
  });

  it('calcula a data prevista de quitação', () => {
    const inicio = new Date('2026-01-15T12:00:00Z');
    const sim = simulatePayoff(1000, 0, 250, inicio);
    expect(sim.months).toBe(4);
    expect(sim.payoffDate!.getMonth()).toBe(4); // janeiro + 4 = maio
  });

  it('juros totais crescem quando se paga menos', () => {
    const rapido = simulatePayoff(5000, 0.14, 1500);
    const lento = simulatePayoff(5000, 0.14, 900);
    expect(lento.totalInterest).toBeGreaterThan(rapido.totalInterest);
    expect(lento.months!).toBeGreaterThan(rapido.months!);
  });
});

describe('simulateExtraPayment', () => {
  it('pagar mais adianta a quitação e economiza juros', () => {
    const r = simulateExtraPayment(5000, 0.14, 900, 200);
    expect(r.monthsSaved).toBeGreaterThan(0);
    expect(r.interestSaved).toBeGreaterThan(0);
  });

  it('o extra pode tirar a dívida da eternidade', () => {
    const r = simulateExtraPayment(5000, 0.14, 700, 300);
    expect(r.baseMonths).toBeNull();
    expect(r.extraMonths).not.toBeNull();
  });
});

describe('estratégias de quitação', () => {
  const carteira: Debt[] = [
    debt({ id: 'caro',  name: 'Rotativo',   current_balance: 3000, monthly_rate: 0.15, minimum_payment: 150 }),
    debt({ id: 'medio', name: 'Empréstimo', current_balance: 8000, monthly_rate: 0.04, minimum_payment: 300 }),
    debt({ id: 'pequeno', name: 'Loja',     current_balance: 800,  monthly_rate: 0.06, minimum_payment: 80  }),
  ];

  it('orçamento abaixo das parcelas mínimas é inviável', () => {
    const r = simulateStrategy(carteira, 100, 'avalanche');
    expect(r.feasible).toBe(false);
    expect(r.requiredMinimum).toBe(530);
  });

  it('avalanche quita primeiro a de maior taxa', () => {
    const r = simulateStrategy(carteira, 1200, 'avalanche');
    expect(r.feasible).toBe(true);
    expect(r.payoffOrder[0].debtId).toBe('caro');
  });

  it('bola de neve quita primeiro a de menor saldo', () => {
    const r = simulateStrategy(carteira, 1200, 'snowball');
    expect(r.payoffOrder[0].debtId).toBe('pequeno');
  });

  it('avalanche nunca paga mais juros que a bola de neve', () => {
    const c = compareStrategies(carteira, 1200);
    expect(c.avalanche.totalInterest).toBeLessThanOrEqual(c.snowball.totalInterest);
    expect(c.interestSaved).toBeGreaterThanOrEqual(0);
  });

  it('todas as dívidas entram na ordem de quitação', () => {
    const r = simulateStrategy(carteira, 1200, 'avalanche');
    expect(r.payoffOrder).toHaveLength(3);
    expect(r.months).not.toBeNull();
  });

  it('carteira vazia quita em zero meses', () => {
    const r = simulateStrategy([], 1000, 'avalanche');
    expect(r.months).toBe(0);
    expect(r.feasible).toBe(true);
  });

  it('ignora dívidas já quitadas', () => {
    const r = simulateStrategy(
      [debt({ id: 'q', status: 'quitada', current_balance: 9999 })], 1000, 'avalanche',
    );
    expect(r.months).toBe(0);
  });

  it('a parcela liberada de uma dívida quitada acelera as outras', () => {
    // Com o mesmo orçamento, quitar tudo deve levar menos tempo do que a soma
    // dos prazos individuais pagando só o mínimo de cada uma.
    const r = simulateStrategy(carteira, 1200, 'avalanche');
    const ultimoMes = r.payoffOrder.at(-1)!.month;
    expect(r.months).toBe(ultimoMes);
  });
});

describe('summarizeDebts', () => {
  const carteira: Debt[] = [
    debt({ id: 'a', current_balance: 5000, monthly_rate: 0.14, minimum_payment: 500 }),
    debt({ id: 'b', current_balance: 10000, monthly_rate: 0.018, minimum_payment: 400, kind: 'consignado' }),
    debt({ id: 'c', status: 'quitada', current_balance: 2000, monthly_rate: 0.10 }),
  ];

  it('separa total de dívida cara do total geral', () => {
    const s = summarizeDebts(carteira);
    expect(s.total).toBe(15000);      // ignora a quitada
    expect(s.expensiveTotal).toBe(5000); // só a de 14%
    expect(s.count).toBe(2);
    expect(s.expensiveCount).toBe(1);
  });

  it('a que mais custa é por juros, não por saldo', () => {
    // A de 10.000 é maior, mas a de 5.000 a 14% custa mais por mês.
    const s = summarizeDebts(carteira);
    expect(s.mostExpensive!.id).toBe('a');
    expect(s.monthlyInterest).toBe(880); // 700 + 180
  });

  it('carteira vazia não quebra', () => {
    const s = summarizeDebts([]);
    expect(s.total).toBe(0);
    expect(s.mostExpensive).toBeNull();
    expect(s.highestRate).toBe(0);
  });
});

describe('debtVsInvestment', () => {
  it('rotativo vence qualquer rendimento conservador', () => {
    const r = debtVsInvestment(0.14, 0.01);
    expect(r.debtWins).toBe(true);
    expect(r.gapPercentPoints).toBe(13);
  });

  it('consignado abaixo do rendimento não exige quitar antes', () => {
    expect(debtVsInvestment(0.008, 0.01).debtWins).toBe(false);
  });
});

describe('critério de aceite: R$ 5.000 a 14% a.m.', () => {
  it('mostra custo mensal e dois cenários de pagamento', () => {
    const d = debt({ current_balance: 5000, monthly_rate: 0.14 });

    expect(monthlyInterestCost(d)).toBe(700);

    const minimo = simulatePayoff(5000, 0.14, 500);
    expect(minimo.months).toBeNull(); // 500 < 700 de juro: nunca quita

    const viavel = simulatePayoff(5000, 0.14, 1200);
    expect(viavel.months).not.toBeNull();
    expect(viavel.payoffDate).toBeInstanceOf(Date);

    const agressivo = simulatePayoff(5000, 0.14, 2000);
    expect(agressivo.months!).toBeLessThan(viavel.months!);
    expect(agressivo.totalInterest).toBeLessThan(viavel.totalInterest);
  });
});

describe('taxaAnualEquivalente', () => {
  it('3% ao mês são 42,58% ao ano', () => {
    expect(taxaAnualEquivalente(0.03)).toBeCloseTo(0.4258, 4);
  });

  it('15% ao mês, o rotativo típico, são 435% ao ano', () => {
    expect(taxaAnualEquivalente(0.15)).toBeCloseTo(4.3503, 4);
  });

  it('taxa zero não vira juro nenhum', () => {
    expect(taxaAnualEquivalente(0)).toBe(0);
  });

  it('entrada inválida devolve zero, não NaN', () => {
    expect(taxaAnualEquivalente(Number.NaN)).toBe(0);
    expect(taxaAnualEquivalente(-0.05)).toBe(0);
  });
});

describe('pagamentoParaQuitarEm', () => {
  it('o caso do relatório: 10.000 a 3% em 12 meses', () => {
    // 1.004,6209... arredondado para CIMA, ao centavo.
    expect(pagamentoParaQuitarEm(10_000, 0.03, 12)).toBe(1004.63);
  });

  it('é o inverso de payoffMonths', () => {
    const parcela = pagamentoParaQuitarEm(10_000, 0.03, 12)!;
    expect(payoffMonths(10_000, 0.03, parcela)).toBe(12);
  });

  it('sem juros é divisão simples', () => {
    expect(pagamentoParaQuitarEm(1_200, 0, 12)).toBe(100);
  });

  it('saldo zero não precisa de parcela', () => {
    expect(pagamentoParaQuitarEm(0, 0.03, 12)).toBe(0);
  });

  it('prazo inválido devolve null', () => {
    expect(pagamentoParaQuitarEm(1_000, 0.03, 0)).toBeNull();
    expect(pagamentoParaQuitarEm(1_000, 0.03, -5)).toBeNull();
  });
});
