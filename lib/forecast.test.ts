import { describe, it, expect } from 'vitest';
import {
  addMonths, forecastMonths, upcomingBills, tightWeeks,
  projectGoal, requiredMonthly, whatIfCut, whatIfIncomeDrop,
  type Tx,
} from './forecast';

const tx = (over: Partial<Tx>): Tx => ({
  type: 'expense', category: 'Variáveis', amount: 100,
  date: '2026-11-10', title: 'Gasto', is_paid: false, ...over,
});

describe('addMonths', () => {
  it('soma meses dentro do ano', () => {
    expect(addMonths('2026-01', 2)).toBe('2026-03');
  });

  it('vira o ano corretamente', () => {
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });
});

describe('forecastMonths', () => {
  const parcelas: Tx[] = [
    tx({ amount: 800, date: '2026-11-15', title: 'Geladeira (2/12)' }),
    tx({ amount: 800, date: '2026-12-15', title: 'Geladeira (3/12)' }),
  ];

  it('separa o que ja esta lancado do que e estimativa', () => {
    const f = forecastMonths({
      allTransactions: parcelas, fromPeriod: '2026-10',
      monthlyCost: 3000, medianIncome: 5000, months: 3,
    });

    expect(f).toHaveLength(3);
    expect(f[0].period).toBe('2026-11');
    expect(f[0].committed).toBe(800);     // fato
    expect(f[0].estimatedRecurring).toBe(2200); // 3000 - 800, sem contar duas vezes
    expect(f[0].projectedBalance).toBe(2000);   // 5000 - 800 - 2200
  });

  it('nao conta o custo de vida em duplicidade', () => {
    // Se a parcela ja cobre todo o custo mediano, nada mais e estimado.
    const f = forecastMonths({
      allTransactions: [tx({ amount: 5000, date: '2026-11-15' })],
      fromPeriod: '2026-10', monthlyCost: 3000, medianIncome: 5000, months: 1,
    });
    expect(f[0].committed).toBe(5000);
    expect(f[0].estimatedRecurring).toBe(0);
  });

  it('marca o mes que fecha no vermelho', () => {
    const f = forecastMonths({
      allTransactions: [tx({ amount: 6000, date: '2026-11-15' })],
      fromPeriod: '2026-10', monthlyCost: 3000, medianIncome: 5000, months: 1,
    });
    expect(f[0].tight).toBe(true);
    expect(f[0].projectedBalance).toBeLessThan(0);
  });

  it('ignora o mes corrente e os passados', () => {
    const f = forecastMonths({
      allTransactions: [tx({ amount: 999, date: '2026-10-20' })],
      fromPeriod: '2026-10', monthlyCost: 1000, medianIncome: 5000, months: 1,
    });
    expect(f[0].committed).toBe(0);
  });

  it('ignora aportes na projecao de gasto', () => {
    const f = forecastMonths({
      allTransactions: [tx({ amount: 2000, category: 'Investimentos', date: '2026-11-10' })],
      fromPeriod: '2026-10', monthlyCost: 1000, medianIncome: 5000, months: 1,
    });
    expect(f[0].committed).toBe(0);
  });

  it('sem historico devolve projecao zerada, sem quebrar', () => {
    const f = forecastMonths({
      allTransactions: [], fromPeriod: '2026-10',
      monthlyCost: 0, medianIncome: 0, months: 2,
    });
    expect(f[0].projectedBalance).toBe(0);
    expect(f[0].tight).toBe(false);
  });
});

describe('upcomingBills', () => {
  const hoje = '2026-10-15';

  it('lista pendentes em ordem de data e marca atraso', () => {
    const b = upcomingBills([
      tx({ date: '2026-10-20', title: 'Luz', is_paid: false }),
      tx({ date: '2026-10-10', title: 'Água', is_paid: false }),
    ], hoje);

    expect(b[0].title).toBe('Água');
    expect(b[0].overdue).toBe(true);
    expect(b[1].daysUntil).toBe(5);
  });

  it('ignora o que ja foi pago', () => {
    expect(upcomingBills([tx({ is_paid: true })], hoje)).toHaveLength(0);
  });

  it('ignora receitas e aportes', () => {
    const b = upcomingBills([
      tx({ type: 'income', is_paid: false }),
      tx({ category: 'Investimentos', is_paid: false }),
    ], hoje);
    expect(b).toHaveLength(0);
  });

  it('respeita o horizonte de dias', () => {
    const b = upcomingBills([tx({ date: '2027-05-01' })], hoje, 45);
    expect(b).toHaveLength(0);
  });
});

describe('tightWeeks', () => {
  it('agrupa vencimentos por semana acima do limite', () => {
    const bills = upcomingBills([
      tx({ date: '2026-10-20', amount: 500 }),
      tx({ date: '2026-10-21', amount: 700 }),
      tx({ date: '2026-11-15', amount: 100 }),
    ], '2026-10-15');

    const semanas = tightWeeks(bills, 1000);
    expect(semanas).toHaveLength(1);
    expect(semanas[0].total).toBe(1200);
    expect(semanas[0].count).toBe(2);
  });
});

describe('projectGoal', () => {
  it('calcula meses e data para bater a meta', () => {
    const p = projectGoal(1000, 4000, 500, new Date('2026-01-15T12:00:00Z'));
    expect(p.months).toBe(6);
    expect(p.targetDate!.getMonth()).toBe(6); // janeiro + 6 = julho
  });

  it('meta ja alcancada e zero meses', () => {
    expect(projectGoal(5000, 4000, 100).months).toBe(0);
  });

  it('sem aporte, a meta nunca chega', () => {
    // null em vez de Infinity: obriga a tela a tratar o caso.
    expect(projectGoal(0, 4000, 0).months).toBeNull();
    expect(projectGoal(0, 4000, 0).targetDate).toBeNull();
  });
});

describe('requiredMonthly', () => {
  it('divide o que falta pelo prazo', () => {
    expect(requiredMonthly(1000, 4000, 6)).toBe(500);
  });

  it('meta ja batida nao exige aporte', () => {
    expect(requiredMonthly(5000, 4000, 6)).toBe(0);
  });

  it('prazo invalido nao divide por zero', () => {
    expect(requiredMonthly(0, 1000, 0)).toBe(0);
  });
});

describe('whatIfCut', () => {
  it('cortar gasto adianta a reserva', () => {
    const r = whatIfCut({
      reserveCurrent: 0, reserveTarget: 12000,
      currentContribution: 500, monthlyCut: 300,
    });
    expect(r.baseMonths).toBe(24);
    expect(r.newMonths).toBe(15);
    expect(r.monthsSaved).toBe(9);
    expect(r.newMonthlyContribution).toBe(800);
  });

  it('cortar tira a meta do impossivel', () => {
    const r = whatIfCut({
      reserveCurrent: 0, reserveTarget: 12000,
      currentContribution: 0, monthlyCut: 400,
    });
    expect(r.baseMonths).toBeNull();
    expect(r.newMonths).toBe(30);
  });
});

describe('whatIfIncomeDrop', () => {
  it('renda ainda cobre o custo', () => {
    const r = whatIfIncomeDrop({ income: 5000, monthlyCost: 3000, reserveAmount: 9000, dropPercent: 20 });
    expect(r.newIncome).toBe(4000);
    expect(r.survives).toBe(true);
    expect(r.monthsOfRunway).toBeNull();
  });

  it('renda nao cobre: calcula quanto a reserva aguenta', () => {
    const r = whatIfIncomeDrop({ income: 5000, monthlyCost: 4500, reserveAmount: 9000, dropPercent: 40 });
    expect(r.newIncome).toBe(3000);
    expect(r.survives).toBe(false);
    expect(r.deficit).toBe(1500);
    expect(r.monthsOfRunway).toBe(6); // 9000 / 1500
  });
});
