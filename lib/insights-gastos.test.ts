import { describe, it, expect } from 'vitest';
import {
  normalizeForGrouping,
  breakdownByCategory,
  detectAnomalies,
  detectRecurring,
  detectInvisibleSpending,
  type Tx,
} from './insights-gastos';

const tx = (over: Partial<Tx>): Tx => ({
  type: 'expense', category: 'Variáveis', amount: 100, date: '2026-10-05', title: 'Gasto', ...over,
});

describe('normalizeForGrouping', () => {
  it('agrupa o que é a mesma despesa escrita de formas diferentes', () => {
    expect(normalizeForGrouping('NETFLIX 10/2026')).toBe(normalizeForGrouping('netflix'));
  });

  it('remove sufixo de parcela', () => {
    expect(normalizeForGrouping('Geladeira (3/12)')).toBe('geladeira');
  });
});

describe('breakdownByCategory', () => {
  const allTransactions: Tx[] = [
    tx({ category: 'Variáveis', amount: 400, date: '2026-07-10' }),
    tx({ category: 'Variáveis', amount: 400, date: '2026-08-10' }),
    tx({ category: 'Variáveis', amount: 400, date: '2026-09-10' }),
    tx({ category: 'Contas Fixas', amount: 1000, date: '2026-09-05' }),
  ];

  it('calcula valor, % da renda e variação contra a mediana', () => {
    const r = breakdownByCategory({
      monthTransactions: [tx({ category: 'Variáveis', amount: 800, date: '2026-10-10' })],
      allTransactions,
      currentMonth: '2026-10',
      income: 4000,
    });

    const variaveis = r.find(b => b.category === 'Variáveis')!;
    expect(variaveis.amount).toBe(800);
    expect(variaveis.percentOfIncome).toBe(20);
    expect(variaveis.median).toBe(400);
    expect(variaveis.variationPercent).toBe(100);
    expect(variaveis.variationAmount).toBe(400);
  });

  it('sem histórico a variação é null, não zero', () => {
    // Dizer "0% de variação" para quem não tem histórico é inventar contexto.
    const r = breakdownByCategory({
      monthTransactions: [tx({ category: 'Saúde', amount: 300, date: '2026-10-10' })],
      allTransactions: [],
      currentMonth: '2026-10',
      income: 4000,
    });
    expect(r[0].variationPercent).toBeNull();
  });

  it('exclui aportes do raio-x de gastos', () => {
    const r = breakdownByCategory({
      monthTransactions: [tx({ category: 'Investimentos', amount: 5000, date: '2026-10-10' })],
      allTransactions: [],
      currentMonth: '2026-10',
      income: 4000,
    });
    expect(r).toHaveLength(0);
  });

  it('não deixa o mês corrente contaminar a própria mediana', () => {
    const r = breakdownByCategory({
      monthTransactions: [tx({ category: 'Variáveis', amount: 800, date: '2026-10-10' })],
      allTransactions: [...allTransactions, tx({ category: 'Variáveis', amount: 800, date: '2026-10-10' })],
      currentMonth: '2026-10',
      income: 4000,
    });
    expect(r.find(b => b.category === 'Variáveis')!.median).toBe(400);
  });

  it('renda zero não quebra o percentual', () => {
    const r = breakdownByCategory({
      monthTransactions: [tx({ amount: 100, date: '2026-10-10' })],
      allTransactions: [], currentMonth: '2026-10', income: 0,
    });
    expect(r[0].percentOfIncome).toBe(0);
  });
});

describe('detectAnomalies', () => {
  const base = {
    category: 'Variáveis', amount: 800, percentOfIncome: 20,
    median: 400, variationPercent: 100, variationAmount: 400,
  };

  it('aponta a categoria que fugiu do padrão', () => {
    const a = detectAnomalies([base]);
    expect(a).toHaveLength(1);
    expect(a[0].severity).toBe('alta');
    expect(a[0].message).toContain('400,00');
  });

  it('ignora variação pequena em valor', () => {
    // 50% a mais sobre R$ 20 não é notícia.
    const a = detectAnomalies([{ ...base, amount: 30, median: 20, variationPercent: 50, variationAmount: 10 }]);
    expect(a).toHaveLength(0);
  });

  // ATUALIZADO em F15: gasto NOVO passou a gerar alerta próprio. Antes a
  // ausência de mediana descartava a categoria inteira, e uma viagem de
  // R$ 8.000 estreando no mês não dizia nada.
  it('gasto novo acima do piso vira alerta de severidade "novo"', () => {
    const r = detectAnomalies([{ ...base, variationPercent: null }]);
    expect(r).toHaveLength(1);
    expect(r[0].severity).toBe('novo');
    expect(r[0].variationPercent).toBeNull();
  });

  it('gasto novo abaixo do piso continua sem alertar', () => {
    expect(detectAnomalies([{ ...base, amount: 10, variationPercent: null }])).toHaveLength(0);
  });

  it('gasto abaixo do normal não é anomalia', () => {
    expect(detectAnomalies([{ ...base, amount: 200, variationPercent: -50, variationAmount: -200 }])).toHaveLength(0);
  });

  it('ordena pelo maior impacto em reais', () => {
    const a = detectAnomalies([
      { ...base, category: 'A', variationAmount: 100, variationPercent: 200 },
      { ...base, category: 'B', variationAmount: 500, variationPercent: 40 },
    ]);
    expect(a[0].category).toBe('B');
  });
});

describe('detectRecurring', () => {
  it('detecta assinatura sem depender de lista de marcas', () => {
    // "Alura" não está em nenhum dicionário — mas se repete todo mês.
    const r = detectRecurring([
      tx({ title: 'Alura', amount: 85, date: '2026-08-10', category: 'Contas Fixas' }),
      tx({ title: 'Alura', amount: 85, date: '2026-09-10', category: 'Contas Fixas' }),
      tx({ title: 'Alura', amount: 85, date: '2026-10-10', category: 'Contas Fixas' }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].displayName).toBe('Alura');
    expect(r[0].monthlyAmount).toBe(85);
    expect(r[0].yearlyAmount).toBe(1020);
    expect(r[0].confidence).toBeGreaterThan(0.9);
  });

  it('ignora gasto que aconteceu uma vez só', () => {
    expect(detectRecurring([tx({ title: 'TV nova', amount: 2000 })])).toHaveLength(0);
  });

  it('ignora gasto de valor instável', () => {
    // Supermercado repete todo mês, mas o valor varia demais: não é assinatura.
    const r = detectRecurring([
      tx({ title: 'Supermercado', amount: 200, date: '2026-08-10' }),
      tx({ title: 'Supermercado', amount: 900, date: '2026-09-10' }),
      tx({ title: 'Supermercado', amount: 450, date: '2026-10-10' }),
    ]);
    expect(r).toHaveLength(0);
  });

  it('duas cobranças no mesmo mês não viram recorrência', () => {
    const r = detectRecurring([
      tx({ title: 'Farmacia', amount: 50, date: '2026-10-02' }),
      tx({ title: 'Farmacia', amount: 50, date: '2026-10-20' }),
    ]);
    expect(r).toHaveLength(0);
  });

  it('confiança cai quando há meses sem cobrança', () => {
    const cheio = detectRecurring([
      tx({ title: 'X', amount: 50, date: '2026-08-10' }),
      tx({ title: 'X', amount: 50, date: '2026-09-10' }),
      tx({ title: 'X', amount: 50, date: '2026-10-10' }),
    ]);
    const furado = detectRecurring([
      tx({ title: 'Y', amount: 50, date: '2026-05-10' }),
      tx({ title: 'Y', amount: 50, date: '2026-10-10' }),
    ]);
    expect(furado[0].confidence).toBeLessThan(cheio[0].confidence);
  });

  it('ignora aportes', () => {
    const r = detectRecurring([
      tx({ title: 'Aporte', category: 'Investimentos', amount: 500, date: '2026-09-10' }),
      tx({ title: 'Aporte', category: 'Investimentos', amount: 500, date: '2026-10-10' }),
    ]);
    expect(r).toHaveLength(0);
  });

  it('ignora aporte mesmo quando é o gasto mais estável do usuário', () => {
    // Aporte mensal é o padrão MAIS regular que existe — exatamente o que a
    // detecção procura. Sem a exclusão, ele lideraria a lista de "vazamentos"
    // e o app pediria para o usuário cancelar o que ele faz de melhor.
    const r = detectRecurring([
      tx({ title: 'Aporte - Reserva de Emergência', category: 'Investimentos', amount: 1000, date: '2026-07-05' }),
      tx({ title: 'Aporte - Reserva de Emergência', category: 'Investimentos', amount: 1000, date: '2026-08-05' }),
      tx({ title: 'Aporte - Reserva de Emergência', category: 'Investimentos', amount: 1000, date: '2026-09-05' }),
      tx({ title: 'Aporte - Reserva de Emergência', category: 'Investimentos', amount: 1000, date: '2026-10-05' }),
      tx({ title: 'Netflix', category: 'Variáveis', amount: 55, date: '2026-09-10' }),
      tx({ title: 'Netflix', category: 'Variáveis', amount: 55, date: '2026-10-10' }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].displayName).toBe('Netflix');
  });

  it('ordena do mais caro para o mais barato', () => {
    const r = detectRecurring([
      tx({ title: 'Barato', amount: 20, date: '2026-09-01' }),
      tx({ title: 'Barato', amount: 20, date: '2026-10-01' }),
      tx({ title: 'Caro', amount: 300, date: '2026-09-01' }),
      tx({ title: 'Caro', amount: 300, date: '2026-10-01' }),
    ]);
    expect(r[0].displayName).toBe('Caro');
  });
});

describe('detectInvisibleSpending', () => {
  it('soma os gastos pequenos e frequentes', () => {
    const r = detectInvisibleSpending([
      tx({ amount: 25 }), tx({ amount: 30 }), tx({ amount: 18 }),
      tx({ amount: 500 }), // grande: fora
    ]);
    expect(r.count).toBe(3);
    expect(r.total).toBe(73);
    expect(r.topCategory).toBe('Variáveis');
  });

  it('mês sem gastos pequenos devolve zeros, sem quebrar', () => {
    const r = detectInvisibleSpending([]);
    expect(r.count).toBe(0);
    expect(r.averageTicket).toBe(0);
    expect(r.topCategory).toBeNull();
  });
});
