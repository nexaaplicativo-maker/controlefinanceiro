import { describe, it, expect } from 'vitest';
import { linhasDaMesmaFatura } from './fatura';

const G = 'grupo-da-fatura';

/** Fatura de novembro: três compras à vista mais uma parcela 3/10. */
const NOVEMBRO = [
  { id: 'a', date: '2026-11-02', import_group: G },
  { id: 'b', date: '2026-11-02', import_group: G },
  { id: 'c', date: '2026-11-02', import_group: G },
  { id: 'p3', date: '2026-11-02', import_group: G },
];

/** As parcelas projetadas pela MESMA leitura, nos meses seguintes. */
const PROJETADAS = [
  { id: 'p4', date: '2026-12-02', import_group: G },
  { id: 'p5', date: '2027-01-02', import_group: G },
];

const TUDO = [...NOVEMBRO, ...PROJETADAS];

describe('linhasDaMesmaFatura', () => {
  it('junta as linhas da cobrança deste mês', () => {
    const r = linhasDaMesmaFatura(TUDO, NOVEMBRO[0]);
    expect(r.map(t => t.id).sort()).toEqual(['a', 'b', 'c', 'p3']);
  });

  it('NÃO arrasta as parcelas futuras da mesma importação', () => {
    // O ponto inteiro desta função: elas têm o mesmo import_group.
    const r = linhasDaMesmaFatura(TUDO, NOVEMBRO[0]);
    expect(r.map(t => t.id)).not.toContain('p4');
    expect(r.map(t => t.id)).not.toContain('p5');
  });

  it('cada mês projetado fica sozinho, e portanto não agrupa', () => {
    expect(linhasDaMesmaFatura(TUDO, PROJETADAS[0])).toEqual([]);
  });

  it('não mistura faturas diferentes do mesmo mês', () => {
    const outra = { id: 'z', date: '2026-11-02', import_group: 'outro-grupo' };
    const r = linhasDaMesmaFatura([...TUDO, outra], NOVEMBRO[0]);
    expect(r.map(t => t.id)).not.toContain('z');
  });

  it('lançamento avulso não agrupa', () => {
    const avulso = { id: 'x', date: '2026-11-02', import_group: null };
    expect(linhasDaMesmaFatura([...TUDO, avulso], avulso)).toEqual([]);
  });

  it('compra anterior à coluna import_group não agrupa', () => {
    const antiga = { id: 'velha', date: '2026-11-02' };
    expect(linhasDaMesmaFatura([antiga], antiga)).toEqual([]);
  });

  it('importação de item único não vira fatura', () => {
    const unico = { id: 'u', date: '2026-11-02', import_group: 'so-um' };
    expect(linhasDaMesmaFatura([unico], unico)).toEqual([]);
  });

  it('linha sem data não agrupa, para não varrer o grupo inteiro', () => {
    const semData = { id: 's', date: null, import_group: G };
    expect(linhasDaMesmaFatura([...TUDO, semData], semData)).toEqual([]);
  });

  it('aguenta alvo ausente', () => {
    expect(linhasDaMesmaFatura(TUDO, null)).toEqual([]);
    expect(linhasDaMesmaFatura(TUDO, undefined)).toEqual([]);
  });

  it('inclui a própria linha no resultado', () => {
    const r = linhasDaMesmaFatura(TUDO, NOVEMBRO[1]);
    expect(r.map(t => t.id)).toContain('b');
  });
});
