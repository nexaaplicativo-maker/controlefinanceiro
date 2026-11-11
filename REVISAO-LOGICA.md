# Revisão de lógica e matemática — fechamento

**Branch:** `revisao-logica` · **Fases 0, 1, 2 e 3 concluídas** · **não publicado**

16 achados corrigidos, um commit cada. **415 testes** verdes em `TZ=UTC` e
`TZ=America/Sao_Paulo`. Nenhuma dependência nova. Build compilando.

---

## O que muda na tela de quem já usa

Em ordem do mais visível para o menos.

### Estágio financeiro pode mudar, nos dois sentidos

**Sobe de estágio** quem estava em Modo Emergência só por consumir muito
(gargalo acima de 50%) sem dívida cara nem déficit recorrente. Essas pessoas
voltam a receber sugestão de aporte, que o Estágio 1 bloqueava.

**Desce de estágio** quem aparecia como Independência com patrimônio entre
92× e 300× o custo mensal. O alvo correto da regra dos 4% é 300×.

**Também desce** quem usou o botão "Poupar": o patrimônio cai pelo valor total
já aportado na reserva, que estava sendo contado duas vezes. *No seu banco
isso é zero — você nunca usou o botão.*

### Números que mudam de valor

| Número | Como muda |
|---|---|
| Renda de referência | **Cai** para quem tem mês sem receita no histórico; para de oscilar durante o mês |
| Meta de reserva | **Sobe** para quem não tem histórico de despesa (80% da renda, não 70%) |
| Aporte sugerido | **Cai** para quem fecha o mês apertado; vira 0 para quem fecha no vermelho |
| Patrimônio | **Cai** pelo total aportado via "Poupar" |
| Alerta de consumo | Muda de base para a estratégia 80/20 e para renda variável |
| Taxa da dívida | Passa a mostrar o equivalente anual: `15,0% a.m. (435% a.a.)` |

### Comportamento

- Lançamento feito depois das 21h **para de nascer no mês seguinte**
- Parcela de compra em 31/01 **para de pular para 03/03**
- Guardar numa meta agora **gera lançamento** e derruba o saldo em conta
- Gasto em categoria nova **passa a gerar alerta**, com o rótulo "novo"

---

## Checklist de verificação manual

Para rodar depois de publicar, no app de produção, pelo celular.

### Datas — F3 e F9
- [ ] Lançar uma despesa **depois das 21h** e conferir que ela cai no mês de hoje
- [ ] Lançar uma compra parcelada em **3x com data 31/01** (ou qualquer dia 31)
      e conferir que as parcelas caem em 31/01, 28/02 e 31/03 — nenhuma em março
      duas vezes
- [ ] Trocar de mês para trás até passar de 18 meses e confirmar que os
      lançamentos aparecem, em vez de R$ 0,00

### Metas — F1, F16
- [ ] Usar o botão **"Poupar"** e conferir que aparece um lançamento novo na
      lista do mês, como despesa
- [ ] Conferir que o **saldo em conta caiu** pelo valor guardado
- [ ] Conferir que o **patrimônio subiu só uma vez** — não o dobro
- [ ] Usar o **"+" do card de Reserva** e conferir o mesmo
- [ ] Em **Metas**, adicionar e depois retirar valor; conferir que gera os dois
      lançamentos e que não dá para retirar mais do que há guardado

### Dívidas — F10
- [ ] Cadastrar uma dívida com taxa **15** e conferir que a lista mostra
      `15,0% a.m. (435% a.a.)`
- [ ] Tentar salvar com taxa vazia e com saldo vazio: deve avisar, não gravar

### Estágio e aporte — F5, F7
- [ ] Conferir em que estágio você está e se faz sentido
- [ ] Conferir o valor do aporte sugerido contra o que de fato sobrou nos
      últimos três meses

### Alertas — F8, F11, F15
- [ ] Abrir **Raio-x dos gastos** e conferir que categoria estreando no mês
      aparece com o rótulo "novo", sem percentual

---

## Riscos remanescentes

**Nada disso está na interface.** Estes campos foram calculados e testados,
mas nenhuma tela os exibe ainda:

`destinoDoAporte` · `nivelDeAlerta` · `percentualDoAlerta` · `baseDoAlerta` ·
`fonteDaRenda` · `fonteDoCusto` · `mesesNaBase` · `volatilidadeDaRenda` ·
`independenciaAlvo` · `independenciaProgresso` · `rendaPassivaEstimada` ·
`patrimonio` · `poupancaTipica` · `reservaMinimaConcluida` ·
`repartirPorNatureza`

Em particular, **o usuário não vê se um número é observado ou estimado**. A
cascata do F6 rotula a fonte, mas a tela mostra o número igual nos dois casos.

**O aviso de cálculo atualizado não existe** (D7). Quem abrir o app depois da
publicação vai ver o patrimônio e o estágio diferentes, sem explicação.

**O marcador por título ainda é o caminho das linhas antigas.** `goal_id`
manda para o que for gravado daqui em diante, mas lançamentos anteriores
continuam reconhecidos pelo título. O backfill está no SQL, comentado.

**B7 segue sem verificação**: se o usuário importar a fatura E o extrato
bancário, o "PAGAMENTO FATURA" do extrato conta como despesa de novo. Precisa
de um extrato real para testar.

**O teste de carga do banco nunca rodou.** `scripts/carga-banco.mjs` está
pronto e se recusa a apontar para produção; falta um projeto Supabase de teste.

---

## Como medir o impacto antes de publicar

`supabase/2026-11-11-impacto-revisao.sql` — **somente leitura**, oito blocos.
Diz quantas pessoas mudam de estágio, quantas veem a renda cair, quantas veem
a meta de reserva subir, e quantos lançamentos antigos nasceram no mês errado.

---

## Divergências entre o relatório original e o código

Metade das hipóteses do prompt foi **refutada** lendo o código:

| Hipótese | Veredito |
|---|---|
| A7 — confiança da recorrência negativa | Refutada: gate de desvio em `insights-gastos.ts:216` |
| A7 — falso positivo do supermercado | Refutada: mesmo gate |
| B3 — previsão soma todos os meses futuros | Refutada: indexa por período |
| B3 — ignora despesa já realizada | Refutada: a previsão não cobre o mês corrente |
| B3 — atrasadas não aparecem | Refutada: entram, com `overdue: true` |
| B8 — `r = 0` dá 0/0 | Refutada: tratado em `debt.ts` |
| B8 — "1.5" vira 150% a.m. | Refutada: `validateMonthlyRate` converte certo |
| B1 — cliente e servidor divergem no mês | Refutada: mês é fatiamento de string |

E dois achados **não estavam na lista**, apareceram lendo o código ao lado:

- **F9** — parcelamento manual não travava o dia do mês, enquanto a importação
  por IA travava. Duas regras para a mesma coisa.
- **F16** — o "+" da Reserva e a tela de Metas subiam a meta sem gravar
  lançamento. O mesmo real aparecia como saldo disponível e como reserva.

---

## O que está certo e não foi mexido

- `amount` sempre positivo, sinal por `type`; dois eixos independentes
- Mediana em vez de média; exclusão de Investimentos da renda líquida
- Reserva em múltiplos do custo de vida, com mais meses para renda variável
- `investedTotal` = posições **ou** aportes, nunca os dois
- Fórmula fechada do prazo de quitação, simulação iterativa com juros antes do
  pagamento, bola de neve nas duas ordens
- `simulateStrategy` já tinha desempate determinístico e transbordo da sobra
- Validade de parcela, chave anti-duplicata sem o valor, mesma fatura por
  `import_group` + data
- Ordem dos testes de estágio como lógica; limiar de dívida cara em 3% a.m.
