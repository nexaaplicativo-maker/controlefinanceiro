import { describe, it, expect } from 'vitest';
import { moverNaMeta, ehMovimentoDeMeta } from './aporte-meta';

const base = {
  userId: 'u1',
  goalId: 'g1',
  tituloDaMeta: 'Reserva de Emergência',
  saldoAtualDaMeta: 2_000,
  data: '2026-11-11',
};

describe('moverNaMeta — guardar', () => {
  it('gera despesa e sobe a meta', () => {
    const r = moverNaMeta({ ...base, valor: 500, sentido: 'guardar' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.movimento.transacao).toMatchObject({
      user_id: 'u1',
      goal_id: 'g1',
      amount: 500,
      type: 'expense',
      category: 'Investimentos',
      date: '2026-11-11',
      is_paid: true,
    });
    expect(r.movimento.novoSaldoDaMeta).toBe(2_500);
  });

  it('o título diz o movimento e a meta', () => {
    const r = moverNaMeta({ ...base, valor: 500, sentido: 'guardar' });
    if (!r.ok) throw new Error('deveria ter dado certo');
    expect(r.movimento.transacao.title).toBe('Guardado em: Reserva de Emergência');
  });

  it('o valor fica positivo; o sinal mora em type', () => {
    const r = moverNaMeta({ ...base, valor: 500, sentido: 'guardar' });
    if (!r.ok) throw new Error('deveria ter dado certo');
    expect(r.movimento.transacao.amount).toBeGreaterThan(0);
  });
});

describe('moverNaMeta — retirar', () => {
  it('gera receita e baixa a meta', () => {
    const r = moverNaMeta({ ...base, valor: 500, sentido: 'retirar' });
    if (!r.ok) throw new Error('deveria ter dado certo');

    expect(r.movimento.transacao.type).toBe('income');
    expect(r.movimento.transacao.title).toBe('Retirado de: Reserva de Emergência');
    expect(r.movimento.novoSaldoDaMeta).toBe(1_500);
  });

  it('recusa tirar mais do que há guardado', () => {
    const r = moverNaMeta({ ...base, valor: 2_001, sentido: 'retirar' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toMatch(/mais do que/);
  });

  it('tirar exatamente tudo é permitido e zera a meta', () => {
    const r = moverNaMeta({ ...base, valor: 2_000, sentido: 'retirar' });
    if (!r.ok) throw new Error('deveria ter dado certo');
    expect(r.movimento.novoSaldoDaMeta).toBe(0);
  });
});

describe('moverNaMeta — entradas inválidas', () => {
  it('recusa zero', () => {
    expect(moverNaMeta({ ...base, valor: 0, sentido: 'guardar' }).ok).toBe(false);
  });

  it('recusa negativo — a direção vem de sentido, não do sinal', () => {
    expect(moverNaMeta({ ...base, valor: -100, sentido: 'guardar' }).ok).toBe(false);
  });

  it('recusa NaN', () => {
    expect(moverNaMeta({ ...base, valor: Number.NaN, sentido: 'guardar' }).ok).toBe(false);
  });

  it('recusa meta sem identificação', () => {
    expect(moverNaMeta({ ...base, goalId: '', valor: 100, sentido: 'guardar' }).ok).toBe(false);
  });

  it('não acumula centavo de ponto flutuante', () => {
    const r = moverNaMeta({ ...base, saldoAtualDaMeta: 0.1, valor: 0.2, sentido: 'guardar' });
    if (!r.ok) throw new Error('deveria ter dado certo');
    expect(r.movimento.novoSaldoDaMeta).toBe(0.3);   // não 0.30000000000000004
  });
});

describe('ehMovimentoDeMeta', () => {
  it('goal_id é a resposta confiável', () => {
    expect(ehMovimentoDeMeta({ goal_id: 'g1', category: 'Investimentos', title: 'qualquer coisa' })).toBe(true);
  });

  it('reconhece o título antigo do botão Poupar', () => {
    expect(ehMovimentoDeMeta({ category: 'Investimentos', title: 'Aporte - Reserva de Emergência' })).toBe(true);
  });

  it('reconhece os títulos novos', () => {
    expect(ehMovimentoDeMeta({ category: 'Investimentos', title: 'Guardado em: Viagem' })).toBe(true);
    expect(ehMovimentoDeMeta({ category: 'Investimentos', title: 'Retirado de: Viagem' })).toBe(true);
  });

  it('ignora acento e caixa no título antigo', () => {
    expect(ehMovimentoDeMeta({ category: 'Investimentos', title: 'APORTE - RESERVA DE EMERGENCIA' })).toBe(true);
  });

  it('investimento comum NÃO é movimento de meta', () => {
    expect(ehMovimentoDeMeta({ category: 'Investimentos', title: 'Tesouro Selic' })).toBe(false);
  });

  it('título parecido fora de Investimentos não conta', () => {
    expect(ehMovimentoDeMeta({ category: 'Variáveis', title: 'Guardado em: cofrinho' })).toBe(false);
  });

  it('aguenta campos ausentes', () => {
    expect(ehMovimentoDeMeta({})).toBe(false);
    expect(ehMovimentoDeMeta({ title: null, category: null })).toBe(false);
  });
});
