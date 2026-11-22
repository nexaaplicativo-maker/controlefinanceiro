/**
 * Agrupamento da lista de lançamentos por dia.
 *
 * Função pura, sem relógio e sem fuso: a chave do dia é o FATIAMENTO da string
 * `AAAA-MM-DD` que o banco guarda. Converter para `Date` aqui reabriria o bug
 * de fuso que o resto do app já pagou para tirar (ver `lib/data.ts`).
 */

export interface GrupoDoDia<T> {
  /** 'AAAA-MM-DD', ou '' para o grupo dos lançamentos sem data válida. */
  dia: string;
  itens: T[];
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Agrupa por dia preservando a ordem de ENTRADA: cada dia aparece na posição
 * do primeiro item dele, e os itens mantêm a ordem relativa. Quem chama já
 * ordenou a lista, e reordenar aqui desfaria a decisão dele.
 *
 * Lançamento sem data ou com data malformada vai para um grupo próprio, no
 * fim, com `dia: ''`. Uma linha ruim não pode derrubar nem esconder a lista.
 */
export function agruparPorDia<T extends { date?: string | null }>(lista: T[]): Array<GrupoDoDia<T>> {
  const porDia = new Map<string, T[]>();
  const semData: T[] = [];

  for (const item of lista) {
    const dia = (item.date ?? '').slice(0, 10);
    if (!DATA_ISO.test(dia)) {
      semData.push(item);
      continue;
    }
    const grupo = porDia.get(dia);
    if (grupo) grupo.push(item);
    else porDia.set(dia, [item]);
  }

  const grupos = Array.from(porDia, ([dia, itens]) => ({ dia, itens }));
  if (semData.length > 0) grupos.push({ dia: '', itens: semData });
  return grupos;
}
