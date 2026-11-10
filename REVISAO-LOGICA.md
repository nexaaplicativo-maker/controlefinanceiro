# Revisão de lógica e matemática — estado

**Branch:** `revisao-logica` · **Fase 0 concluída** · **Fase 1 entregue, aguardando aprovação**

A Fase 2 (implementação) só começa com o "aprovado" e as decisões D1 a D8.

---

## Fase 0 — feita

`lib/caracterizacao.test.ts` — 40 testes que **não afirmam estar certo** o que
testam. Congelam o comportamento atual, inclusive os defeitos, para que
qualquer correção apareça obrigatoriamente no diff dos testes.

Suíte completa verde em `TZ=UTC` e `TZ=America/Sao_Paulo`: **274 testes**.

---

## Divergências entre o resumo e o código

| # | O resumo dizia | O código faz |
|---|---|---|
| 1 | `detectRecurring` tem 2 critérios | Tem **3**: gate `desvio > 0.25` em `insights-gastos.ts:216`. Refuta A7 inteiro. |
| 2 | Previsão ignora despesa já realizada | A previsão só cobre meses **futuros** (`forecast.ts:76`). |
| 3 | Previsão soma todos os meses futuros | Indexa por período (`forecast.ts:72`, `:78`). |
| 4 | Aporte da reserva *pode* duplicar | **Duplica sempre**, pelo botão Poupar. |
| 5 | Conversão de taxa é só o teto no banco | `validateMonthlyRate` existe (`validation.ts:102`); `DebtsModal` não a usa. |

---

## Achados — ordem de ataque proposta

### Críticos

**F1 — Patrimônio conta o mesmo aporte duas vezes**
`PayYourselfFirstModal.tsx:64-90` grava a quantia como despesa em
`Investimentos` **e** soma em `goals.current_amount`. `profile.ts:334` faz
`patrimonio = reserveAmount + investedTotal`, e `investedTotal` já inclui
aquela transação. Cinco aportes de R$ 1.000 viram patrimônio de R$ 10.000.

**F2 — Independência em 92× o custo** (`profile.ts:342`, `:383`, `:406`)
A regra dos 4% dá 300× o custo mensal. 92× equivale a sacar 13% ao ano.
Com F1 junto, o app declara independência com cerca de 15% do necessário.

**F3 — Data de gravação em UTC** (`PayYourselfFirstModal.tsx:70`,
`forecast.ts:113`, `validation.ts:122`)
Às 21h de 31/10 em Brasília, grava 01/11. O mês das CHAVES está correto em
todo o resto (fatiamento de string); o problema é só o "hoje".

### Altos

- **F4** mediana pula meses sem movimento e inclui o mês corrente (`profile.ts:202-217`)
- **F5** gargalo fixo em 50% no estágio e déficit de um mês só (`profile.ts:333`, `:337`)
- **F6** custo de vida chutado em 70% da renda (`profile.ts:252`)
- **F7** aporte sugerido sai da renda, não do que sobra (`profile.ts:521`)
- **F8** estratégia 80/20 recebe o teto mais frouxo (`profile.ts:268`)
- **F9 (novo)** parcelamento manual não trava o dia do mês (`TransactionModal.tsx:127`);
  a importação por IA trava (`parcelas.ts:87`). Duas regras para a mesma coisa.
- **F10 (novo)** conversão de taxa duplicada: `validation.ts:102` versus
  `DebtsModal.tsx:112-128`, este com `parseFloat` cru, que não trata vírgula.

### Médios

- **F11** renda variável afrouxa o limite em +5 (`profile.ts:274`)
- **F12** gargalo mistura meio de pagamento com natureza (`profile.ts:167`)
- **F13** `reserveMinimum` calculado e nunca usado no estágio (`profile.ts:456`)
- **F14** divisões protegidas, mas devolvem `0` em vez de `null` — sem NaN
- **F15** piso de anomalia fixo em R$ 50; gasto novo nunca alerta

---

## Refutados, com evidência

| Hipótese | Por quê |
|---|---|
| A7 confiança negativa | Gate de desvio em `insights-gastos.ts:216` torna o caso inalcançável |
| A7 falso positivo do supermercado | Mesmo gate: desvio 0,4 é descartado antes |
| B3 soma todos os meses futuros | Indexa por período |
| B3 ignora despesa realizada | A previsão não cobre o mês corrente |
| B3 atrasadas não aparecem | Entram, com `overdue: true`; falta só separar na tela |
| B8 `r = 0` dá 0/0 | Tratado em `debt.ts:95` |
| B8 "1.5" vira 150% a.m. | `validation.ts:108` converte certo |
| B1 cliente e servidor divergem no mês | Mês é sempre fatiamento de string |

---

## Não verificável só pelo código

- **B7** fatura × extrato: o prompt exclui total, mínimo e saldo anterior
  (`extract/route.ts:92`), mas não `PAGAMENTO FATURA` de extrato bancário.
  Precisa de um extrato real.
- Categoria legada `Cartões de Crédito` nos dados: precisa de SQL de leitura.
- `numeric` chegando como string: precisa de dado real.

---

## Decisões pendentes

| | Decisão | Recomendação |
|---|---|---|
| D1 | Gargalo no estágio 1 | Opção A — remover |
| D2 | SWR padrão | 4%, com 3,5% só informativo |
| D3 | Renda variável | Mediana para exibir, P25 só para a meta de reserva |
| D4 | Subcategorias ambíguas | Pets e Serviços essenciais; Outros como desejo |
| D5 | `has_debt` sem dívida cadastrada | Pendência, não Emergência; piso de 1% da renda |
| D6 | `monthly_cost_declared` | Sim, depois de F4 e F6 |
| D7 | Aviso de cálculo atualizado | Sim, obrigatório para F1 e F2 |
| D8 | **(novo)** Onde mora o aporte à reserva | Transação como fonte; a meta deriva dela |

---

## O que está certo e não deve ser mexido

Tudo da Parte D do prompt, confirmado no código, mais três:

- `simulateStrategy` já tem desempate determinístico, limita a mínima ao saldo
  e transborda a sobra (`debt.ts:206-276`)
- Chaves de mês sempre com zero à esquerda — sem bug de ordenação
- `normalizeForGrouping` usa a faixa correta de diacríticos combinantes
