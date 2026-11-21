# Roteiro de teste manual: "Onde foi o dinheiro", rodada 3

**Branch:** `design/onde-foi-o-dinheiro-rodada-3`
**Escopo:** `components/ResumoOndeFoi.tsx` (novo), `app/page.tsx`, `components/BottomNav.tsx`.
**Fora de escopo:** `SpendingInsightsModal` e `SubscriptionTrackerModal` ainda mostram `{n}x` (ocorrências, não gastos). Isso é esperado.

## Aviso

O banco de desenvolvimento é o de produção. **Este roteiro não grava nada.** Use só: clicar em grupos e no destaque, "Ver todas", "Selecionar", Cancelar, olho de privacidade, trocar de mês e de rota, Tab, Esc.
**Não** salve, edite, marque pago nem exclua. Se abrir o "Apagar" da seleção, **cancele** o diálogo.
Os cenários de mês dependem dos dados da sua conta: procure entre os meses existentes. Não crie lançamento só para testar.

## Preparação

1. `git branch --show-current` deve responder `design/onde-foi-o-dinheiro-rodada-3`.
2. `npm run dev` e abra `http://localhost:3000`. Não rode `build` nem `test:e2e` com o `dev` ativo.
3. Entre com sua conta e percorra os meses com as setas, anotando qual mês se encaixa em cada caso:
   - **M-A:** 6 ou mais grupos nomeados e "Não classificado".
   - **M-B:** até 5 grupos nomeados, com "Não classificado".
   - **M-C:** grupos nomeados, sem "Não classificado".
   - **M-D:** só `Outros` e/ou "Não classificado".
   - **M-E:** um grupo com exatamente 1 gasto (e outro com 2 ou mais).
   Se faltar algum mês, marque o passo como "não testado: sem dado" e siga. Não crie dado.
4. Para o celular real, abra o mesmo `dev` pelo IP da máquina (mesma rede Wi-Fi).

---

## A. Contagem e texto (M-E)

1. Na seção "Onde foi o dinheiro", olhe a coluna à direita de cada barra.
   Esperado: `N gasto(s)`, nunca `Nx`. Grupo com 1 gasto mostra "1 gasto"; com 2 ou mais, "N gastos".
2. Olhe o destaque "Não classificado" (se houver).
   Esperado: segunda linha `N gasto(s) · X% do mês`, singular quando N = 1.
3. Clique num grupo (ativo).
   Esperado: o texto da coluna fica mais claro (`ink-2`), legível sobre o fundo verde claro.

## B. Larguras (DevTools, modo dispositivo, M-A)

Para cada largura: sem rolagem horizontal, barras alinhadas entre as linhas, valor não cortado.

4. **320px:** esperado: **só a contagem** ("12 gastos"), sem percentual. A barra de progresso continua visível e com largura útil.
5. **360px:** esperado: `NN% · N gastos` na coluna. Compare uma linha de 1 dígito com uma de 3 dígitos (ex.: "5%" e "100%"): as barras terminam alinhadas.
6. **390px:** igual a 360px.
7. **768px:** igual, card sem quebra.
8. **1280px:** igual, card sem quebra.
9. Em 320px e 360px, procure o grupo com mais gastos (3 ou 4 dígitos, se existir).
   Esperado: o texto não quebra em duas linhas e não desalinha a barra.

## C. Destaque "Não classificado" (M-A ou M-B)

10. Confira a ordem.
    Esperado: barras dos grupos nomeados primeiro; **depois**, separado por uma linha, o destaque (ícone de interrogação âmbar, valor, `N gastos · X% do mês`, "Ver estes gastos >"). "Não classificado" **não** aparece como barra na lista.
11. Clique no destaque (inativo -> ativo).
    Esperado: a lista "Lançamentos de..." filtra só por esses gastos; o destaque troca para borda e fundo verdes, ícone de check e "Ver estes gastos" em verde. **O texto "Não classificado" e a linha de contagem não mudam.**
12. Clique de novo no destaque (ativo -> inativo).
    Esperado: o filtro sai e volta ao visual âmbar. Mesmo comportamento de clicar numa barra.
13. Com o destaque ativo, clique numa barra de grupo.
    Esperado: o filtro passa para o grupo, o destaque volta a inativo e a barra fica ativa.
14. Troque para **M-C** (sem "Não classificado").
    Esperado: **nenhum** destaque, nem separador. A seção termina nas barras e no texto de ajuda.
15. Com o filtro "Não classificado" ligado, troque de mês para o M-C.
    Esperado: sem destaque e sem erro. Anote o que aparece na lista de lançamentos.

## D. Mês só com Outros / Não classificado (M-D)

16. Abra o M-D.
    Esperado: cartão de explicação ("As despesas deste mês ainda não estão separadas..."). **Sem barras, sem destaque, sem "Ver todas", sem texto repetido.** Com IA ligada: botão "Ler fatura e separar as compras" (**não clique**). Com IA desligada: orientação do lápis, em "Onde foi o gasto".
17. Volte a um mês normal.
    Esperado: barras e destaque voltam normais.

## E. "Ver todas (N)" (M-A e M-B)

18. **M-B (até 5 grupos nomeados):** esperado: **não existe** o botão "Ver todas". Só as barras e o destaque.
19. **M-A (6 ou mais):** esperado: 5 barras, botão "Ver todas (N)" logo abaixo delas e antes do destaque. Conte os grupos nomeados do mês (o "Não classificado" **não** entra na conta): N tem de ser igual.
20. Clique em "Ver todas (N)".
    Esperado: as barras restantes aparecem **abaixo** do botão; o texto vira "Ver menos" e a seta inverte. O botão não muda de posição na tela.
21. Clique em "Ver menos".
    Esperado: as extras somem e o botão volta a "Ver todas (N)" no mesmo lugar.
22. Recolhido, clique num grupo que está entre os 5 e depois noutro.
    Esperado: o filtro troca normalmente e a lista continua com 5 linhas.
23. **Filtro fora dos 5, recolhido:** expanda, clique numa barra que não estava entre as 5 maiores (a 6ª ou além) e depois clique em "Ver menos".
    Esperado: a barra ativa fica **visível como 6ª linha**, acima do botão (nunca filtro ligado sem ver qual). O botão continua dizendo "Ver todas (N)" com o mesmo N.
24. No estado do passo 23 (6 linhas, recolhido), clique em "Ver todas".
    Esperado: a barra ativa desce para sua posição natural. **Observação conhecida:** neste caso o botão sobe uma linha, porque a 6ª linha deixa de ficar acima dele. Se o botão se mover nos passos 20 ou 21, reprove.
25. Troque de mês estando expandido.
    Esperado: o card continua expandido no outro mês (decisão do dono; é intencional).
26. Troque para um mês com até 5 grupos (M-B) estando expandido.
    Esperado: sem botão e sem linhas extras duplicadas.

## F. Teclado e leitor de tela (M-A)

27. Tab até a seção.
    Esperado: ordem: barra 1 a 5, "Ver todas (N)", destaque. Anel de foco visível em todos, sem corte.
28. No "Ver todas", Enter e depois Espaço.
    Esperado: cada um alterna. O foco **continua no botão** e ele não se move.
29. Expanda e continue com Tab.
    Esperado: a ordem é botão, **barras extras**, destaque. Shift+Tab percorre ao contrário.
30. Com leitor de tela (NVDA, VoiceOver ou TalkBack), foque no botão.
    Esperado: anuncia "Ver todas (N), botão, recolhido"; depois de acionar, "Ver menos, botão, **expandido**".
31. Foque numa barra e no destaque.
    Esperado: lidos como botão com estado pressionado/não pressionado (`aria-pressed`). **O nome do destaque é o mesmo** ligado e desligado; só o estado muda. O ícone não é lido.
32. DevTools, Elements: no "Ver todas", confira `aria-expanded` e `aria-controls="onde-foi-extras"`, e que existe `<div id="onde-foi-extras">` tanto recolhido quanto expandido. O botão **não** tem `aria-pressed`; barras e destaque **não** têm `aria-expanded`.

## G. O "+" da barra inferior (celular, abaixo de 768px)

33. Visão Geral, fora da seleção.
    Esperado: o "+" aparece no centro da BottomNav.
34. Toque em "Selecionar".
    Esperado: o "+" **some** (não fica desabilitado), a zona da barra de seleção fica livre, e o leitor de tela anuncia "Modo de seleção ligado. Toque em Cancelar para sair."
35. Toque em "Cancelar".
    Esperado: o "+" volta. A folha de lançamento **não** abre sozinha.
36. Abra a folha do "+", feche, entre na seleção e saia.
    Esperado: a folha não reabre.
37. Com a folha do "+" **aberta**, entre na seleção (leitor ou teclado externo, se conseguir).
    Esperado: a folha fecha junto e o "+" some. Se for impossível chegar lá, marque "não testado".
38. Entre na seleção e **navegue** para outra rota (Dívidas, Relatórios, Configurações) pela BottomNav.
    Esperado: o "+" não aparece lá (só existe na Visão Geral); volte à Visão Geral: o "+" **reaparece**, fora da seleção.
39. Entre na seleção, troque de mês e depois recarregue a página (F5).
    Esperado: depois do F5 o "+" aparece.
40. Em 768px e 1280px (sem BottomNav): sem erro no console ao entrar e sair da seleção.

## H. Privacidade

41. Com valores visíveis, anote os valores das barras e do destaque.
42. Clique no olho de privacidade.
    Esperado: **todos** os valores das barras, das extras (expanda) e do destaque ficam mascarados. A contagem (`N gastos`) e o percentual **continuam** visíveis (não são valores). Clique de novo: os valores voltam iguais.

## I. Regressões vizinhas

43. Clique num grupo: a lista de lançamentos filtra e mostra só as compras dele. Clique de novo: sai do filtro. O comportamento é o de antes da rodada.
44. Com filtro ligado, use "Ver tudo" e a busca por texto.
    Esperado: sem erro; a linha aberta volta fechada (regra do roteiro da rodada 2).
45. Console do navegador (F12): sem erro vermelho nem aviso de `key` repetida ao percorrer os passos 11 a 26.

---

## Se um passo reprovar

- Anote o número do passo, o aparelho, o navegador, a largura e uma captura de tela.
- Não conserte no código por conta própria nem mexa em dado real para "ver melhor".
- "Percentual aparece em 320px" ou "barras desalinhadas" (passos 4, 5 e 9): breakpoint `xs` e a coluna `w-[4.75rem] xs:w-[6.75rem] whitespace-nowrap` em `components/ResumoOndeFoi.tsx`.
- "Destaque aparece sem 'Não classificado' no mês" (passo 14) ou "texto muda entre ativo e inativo" (passo 11): bloco `semCategoria` em `components/ResumoOndeFoi.tsx`.
- "Ver todas aparece com 5 ou menos" ou "N errado" (passos 18 e 19): condição `nomeados.length > GRUPOS_VISIVEIS`; o "Não classificado" não conta.
- "+" fica escondido para sempre (passos 35, 38 e 39): emissão `false` na limpeza do `useEffect` em `app/page.tsx` e ouvinte em `components/BottomNav.tsx`. Anote o caminho exato e avise com prioridade.
- "Leitor não anuncia a seleção" (passo 34): o `<p role="status">` em `app/page.tsx` precisa estar montado desde o carregamento, vazio.
- Leve a lista de passos reprovados ao agente `developer` e peça nova rodada de QA depois da correção.
