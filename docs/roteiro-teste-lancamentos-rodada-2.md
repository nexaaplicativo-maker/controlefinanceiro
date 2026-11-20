# Roteiro de teste manual: lista de lançamentos, rodada 2

**Branch:** `design/lancamentos-rodada-2`
**Escopo:** lista "Lançamentos de <mês>" da Visão Geral (`components/TransactionRow.tsx`).
**Fora de escopo:** `IncomeListModal` e `PillarDetailModal` têm marcação própria e ainda usam ponto âmbar. Isso é esperado.

## Aviso

O banco de desenvolvimento é o de produção. **Este roteiro foi escrito para não gravar nada.** Só use ações que não alteram dado:
abrir e fechar as ações, selecionar linhas, Esc, Tab. **Não toque em pago/editar/excluir.**
Se quiser testar o "Apagar" da seleção, clique e **cancele** no diálogo de confirmação.
Ensaios de "pago" e "excluir" só valem em lançamento de teste que você mesmo criou e vai apagar.

## Preparação

1. `git branch --show-current` deve responder `design/lancamentos-rodada-2`.
2. `npm run dev` e abra `http://localhost:3000`. Não rode `build` nem `test:e2e` com o `dev` ativo.
3. Entre com sua conta, num mês que tenha lançamentos. Ideal: um não pago, um com comprovante, uma receita e uma categoria própria.
4. Para ver o celular de verdade, abra o mesmo `dev` no aparelho pelo IP da máquina (mesma rede Wi-Fi).

---

## A. Celular real (toque)

1. Abra a Visão Geral e role até os lançamentos.
   Esperado: cada linha é uma só: ícone, título, `categoria · dd/MM` embaixo, valor à direita. Nenhum botão de ação aparece.
2. Procure um lançamento não pago.
   Esperado: selo de texto "Não paga" (ou "Não recebida" para receita) ao lado da categoria. Sem ponto âmbar e sem a legenda "Ponto âmbar..." acima da lista.
3. Toque no meio de uma linha (texto ou valor).
   Esperado: abre uma segunda linha com pago/editar/excluir, com separador em cima. Os botões têm cerca de 44px.
4. Toque em outra linha.
   Esperado: a primeira fecha e a nova abre. Só uma aberta por vez.
5. Toque de novo na linha aberta.
   Esperado: ela fecha.
6. Numa linha com comprovante, sem abrir as ações, toque no ícone do comprovante.
   Esperado: abre o comprovante e **não** abre as ações da linha. O ícone é visível o tempo todo.
7. Toque em "Selecionar".
   Esperado: qualquer ação aberta fecha, aparecem checkboxes e somem lápis, lixeira e comprovante.
8. Toque no meio de uma linha e depois no checkbox de outra.
   Esperado: ambas marcam e desmarcam. Nada é excluído.
9. Marque 2 ou 3 linhas.
   Esperado: a barra "N selecionados" aparece **acima** da BottomNav, sem ficar tapada por ela.
10. Toque em "Apagar" **uma vez**, no primeiro toque.
    Esperado: abre o diálogo de confirmação (sem precisar de segundo toque). **Cancele.** Nada é apagado.
11. Toque em "Cancelar" (ao lado do título da lista).
    Esperado: sai da seleção, a barra some e nenhuma linha fica com ações abertas.
12. Abra as ações de uma linha e troque de mês pelas setas.
    Esperado: o outro mês vem sem nenhuma linha aberta. Volte ao mês anterior: também sem linha aberta.

## B. iPhone real (safe area)

O DevTools não reproduz `env(safe-area-inset-bottom)`; só o aparelho real mostra.

13. Abra o app no iPhone com Dynamic Island ou barra home, no Safari e (se puder) instalado como PWA.
14. Repita os passos 7 a 10.
    Esperado: a barra de seleção fica acima da BottomNav **sem sobreposição e sem vão grande**, no Safari e no PWA. "Apagar" está inteiro na tela e responde ao primeiro toque.
15. Gire o aparelho para paisagem e volte.
    Esperado: a barra continua acima da BottomNav.

## C. Desktop (cursor)

16. Abra a lista em 1280px, com mouse.
    Esperado: as ações **não** aparecem em repouso, mas o espaço delas está reservado. O valor não pula quando você passa o mouse.
17. Passe o mouse numa linha.
    Esperado: pago/editar/excluir aparecem com transição suave.
18. Tire o mouse da linha.
    Esperado: as ações somem de novo.
19. Com o mouse num ponto onde a lixeira fica invisível (linha sem hover não conta: passe o mouse na linha e então pare num ponto vazio da mesma linha), clique.
    Esperado: **nada acontece** (sem clique fantasma, sem modal, sem exclusão).
20. Clique no corpo de uma linha (texto ou valor).
    Esperado: nada acontece. Não existe o botão sobreposto com cursor.
21. Pressione Tab até entrar na lista.
    Esperado: o foco cai nos botões da primeira linha, que se revelam sozinhos, e o anel de foco é visível. Nenhum foco "some" num botão invisível.
22. Continue com Tab e depois Shift+Tab.
    Esperado: a ordem é pago, editar, excluir (o comprovante, quando existir, vem na ordem do DOM, antes das ações) e depois a próxima linha. Shift+Tab percorre ao contrário. Nenhum botão é pulado.
23. Em "Selecionar", marque linhas com o mouse e com Espaço no checkbox.
    Esperado: o checkbox é focável por Tab, e a barra de seleção fica perto do rodapé da janela (`md:bottom-2`), **não** 7rem acima.

## D. Larguras (DevTools, modo dispositivo)

Para cada largura, confira uma linha de título longo e uma com selo "Não paga".

24. **320px:** abaixo de 360px é decisão de projeto: o bloco ícone+texto ocupa a linha toda e o valor desce, à direita. Esperado: sem corte nem rolagem horizontal; o título trunca com reticências.
25. **360px:** valor ao lado do texto, na mesma linha. Sem rolagem horizontal.
26. **390px:** igual a 360px. Selo, categoria e data cabem; só a categoria trunca.
27. **834px (tablet):** lista sem quebra de layout. Toque e cursor: passos 29 e 30.
28. **1280px:** passos 16 a 23.

## E. Tablet e emulação de ponteiro

29. DevTools, 834px, com emulação de **toque** ligada.
    Esperado: comportamento do celular (passos 3 a 5). **As ações nunca ficam presas invisíveis.** É o ponto que a revelação por tipo de ponteiro existe para proteger.
30. Desligue a emulação de toque e use o mouse, mantendo 834px.
    Esperado: comportamento de desktop (passos 16 a 19). A largura não decide nada.
31. Para forçar os dois casos: DevTools, `Ctrl+Shift+P`, "Show Rendering", e emule `pointer: coarse` com `hover: none`, depois `pointer: fine` com `hover: hover`.
    Esperado: coarse mostra o botão sobreposto e mantém as ações fechadas. fine esconde o botão sobreposto e revela por hover.

## F. Esc, foco e movimento

32. Em modo toque, abra as ações de uma linha e pressione Esc (teclado externo ou emulação).
    Esperado: as ações fecham e o foco volta ao botão da linha, com anel de foco visível dentro da linha (não cortado).
33. Em modo toque, com a linha aberta, inspecione o botão sobreposto no DevTools (Elements).
    Esperado: `aria-expanded="true"` e `aria-controls` apontando para o `id` do grupo de ações, que existe no DOM.
34. DevTools, "Show Rendering", "Emulate CSS media feature prefers-reduced-motion" = `reduce`. Passe o mouse nas linhas.
    Esperado: as ações aparecem e somem **sem fade**. Com `no-preference` há um fade curto.

## G. Ícones e regras que não podem ter mudado

35. Receita: ícone de tendência (seta subindo), sempre, qualquer que seja a categoria.
36. Despesa com subcategoria reconhecida: ícone da subcategoria (carrinho, carro...).
37. Despesa sem subcategoria em `Contas Fixas`, `Variáveis`, `Cartões`, `Cartões de Crédito` ou `Investimentos`: ícone da **categoria**. `Cartões` e `Cartões de Crédito` mostram o mesmo cartão.
38. Despesa de categoria própria sem subcategoria: círculo tracejado.
39. Busca por texto que traga lançamentos de outro mês, ou o filtro "A Vencer": a data aparece **completa** (`dd/MM/aaaa`). No mês normal, só `dd/MM`.
40. Confira um lançamento no dia 1 ou no último dia do mês: o dia mostrado bate com o cadastrado (sem voltar um dia).
41. Clique num grupo de "Onde foi o dinheiro", use "Ver tudo", troque a busca e o filtro: a lista continua coerente. **Se uma linha reaparecer aberta ao voltar de um filtro, anote:** é um caso conhecido de baixa gravidade (o estado de linha aberta não é zerado ao buscar ou filtrar).

---

## Se um passo reprovar

- Anote o número do passo, o aparelho, o navegador, a largura e uma captura de tela.
- Não conserte no código por conta própria nem mexa em dado real para "ver melhor".
- "As ações nunca aparecem no desktop" (passos 17 e 21): sintoma típico de `group-hover:` trocado por seletor de classe única, ou de `opacity-0` vencendo.
- "As ações nunca abrem no toque" (passos 3 e 29): confira no DevTools se o aparelho cai em `pointer: coarse` (passo 31).
- "O toque no comprovante ou no checkbox não responde": a camada de conteúdo é `pointer-events-none`; esses elementos precisam de `pointer-events-auto`.
- "A barra de seleção fica tapada ou longe demais no iPhone" (passos 14 e 15): `sticky bottom-[calc(7rem+env(safe-area-inset-bottom,0px))]` em `app/page.tsx`.
- Leve a lista de passos reprovados ao agente `developer` e peça nova rodada de QA depois da correção.
