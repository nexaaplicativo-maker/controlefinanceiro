# Roteiro de teste manual: nova Visão Geral, rodada 4

**Branch:** `design/visao-geral-rodada-4`
**Escopo:** `app/page.tsx`, `components/JornadaCard.tsx`, `EscadaEstagios.tsx`, `CardQuantoSobra.tsx`, `DivisaoRenda.tsx`, `AlertaGargalo.tsx`, `EsqueletoVisaoGeral.tsx`, `ResumoOndeFoi.tsx`, `TransactionRow.tsx`, `PillarDetailModal.tsx`, `app/globals.css`.
**Fora de escopo:** barra inferior (não mudou) e os modais de Poupar, Metas, Patrimônio etc.

## Aviso

O banco de desenvolvimento é o de produção. **Este roteiro não grava nada.** Use só: clicar, abrir e fechar modais, olho de privacidade, trocar de mês, Tab, Esc, redimensionar a janela.

**Não toque** nestes botões, porque gravam de verdade: **"Guardar"** (o botão que confirma o aporte, depois de abrir o campo de "Guardar agora"), **"Criar minha reserva"**, **"Apagar"** da seleção e qualquer "Salvar" de modal. Abrir o campo de "Guardar agora" e fechar sem confirmar é seguro. Se um diálogo de exclusão abrir, **cancele**.

Os cenários dependem dos dados da sua conta: procure entre os meses existentes e marque "não testado: sem dado" quando faltar. Não crie lançamento só para testar.

## Preparação

1. `git branch --show-current` deve responder `design/visao-geral-rodada-4`.
2. `npm run dev` e abra `http://localhost:3000`. Não rode `build` nem `test:e2e` com o `dev` ativo.
3. Entre com sua conta e percorra os meses, anotando qual mês se encaixa em cada caso:
   - **M-A:** com renda e gargalo acima do teto (alerta aparece).
   - **M-B:** com renda e gargalo abaixo do teto (alerta **não** aparece).
   - **M-C:** com despesas e **sem nenhuma renda** lançada.
   - **M-D:** saídas maiores que a renda (saldo negativo).
   - **M-E:** mês sem nenhum lançamento.
   - **M-F:** 6 ou mais grupos em "Onde foi o dinheiro" e "Não classificado".
4. Estado da conta: você consegue enxergar o card Jornada em **estágio calculado** (onboarding respondido). Os estados `needsOnboarding`, "sem meta de reserva" e "sem custo de vida" só aparecem com conta nova ou sem dados; se a sua conta não os mostra, marque "não testado: sem dado".
5. DevTools em modo dispositivo para as larguras 320, 360, 390, 768 e 1280px. Ative também "Emular prefers-reduced-motion" quando o passo pedir.

---

## A. Cabeçalho e linha do mês (< 768px)

1. Em **390px**: lado esquerdo tem a saudação pequena ("Boa tarde") e **abaixo** o título "Visão geral"; à direita, olho, sino e feedback. Sem avatar.
2. Em **320px**: o título "Visão geral" cabe **em uma linha** ao lado dos três ícones e nada fica cortado. Meça os ícones: cada um com **44×44px**. *Se o título quebrar em duas linhas ou os ícones apertarem, anote: a regra dos 36px abaixo de 360px precisa voltar.*
3. Em **360px** e **390px**: ícones com 44×44px.
4. Abaixo do cabeçalho: um trilho com setas e "Novembro 2026" (mês em texto normal, ano mais apagado) e o "⋯" na mesma linha. Meça: trilho com 44px de altura, setas com **44×44px**, "⋯" com 44×44px.
5. Toque nas setas: o mês muda, e todos os cards trocam junto.
6. Abra o "⋯": o menu abre alinhado à direita, sem sair da tela. Esc ou toque fora fecha.
7. Em **768px e acima**: a faixa do título volta ("Visão Geral" + "Acompanhe e gerencie seu patrimônio"), o seletor de mês é a pílula compacta em caixa alta, e o cabeçalho de celular **não aparece**.
8. Com um leitor de tela (ou a árvore de acessibilidade do DevTools): há **um** `h1` em cada largura.

## B. Card Jornada

9. Eyebrow "SUA JORNADA · ESTÁGIO N DE 5", título (nome do estágio) e a frase do estágio.
10. A escada tem 5 círculos de 32px: concluídos com check no brand; o atual com o número, fundo âmbar e anel; os seguintes só contorno visível. Em **320px** os cinco cabem sem rolagem horizontal, com o conector de ponta a ponta.
11. Conectores: o trecho já percorrido está em brand; o resto, em branco semi-opaco (visível, não some no fundo).
12. Árvore de acessibilidade: a lista tem **5 itens** (não 9), cada um lido como "Estágio N, nome: concluído | atual | a seguir", e só o atual tem `aria-current="step"`.
13. "Ver o caminho completo" abre o mapa do caminho (`StageRoadmapModal`). Esc fecha e o foco volta ao botão.
14. O card **inteiro não é clicável**: clicar no fundo do card não abre nada.
15. **Próximo passo**, estágio 2: o alvo é **um mês de custo** (não a reserva mínima). Confira o número com o degrau "Buscando Estabilidade" no mapa do caminho: devem ser iguais.
16. Estágio 3: o alvo é a reserva **ideal**. Estágios 1 e 5: só a frase, **sem barra**.
17. A barra tem contorno visível mesmo em 0%. Na árvore de acessibilidade: `progressbar` com nome = nome do passo, valor mínimo 0, máximo = alvo, atual e texto "R$ X de R$ Y".
18. Texto "N meses de custo cobertos" ou "Ainda sem aporte" ao lado do título do passo. Abaixo da barra: "Faltam R$ X para completar este passo." com centavos.
19. Conta com meta de reserva: "Guardar agora" abre um campo numérico com rótulo (para o leitor) e o botão "Guardar". **Feche sem confirmar** (recarregue a página). Conta **sem** meta: o botão é "Criar minha reserva" e **nunca** "Guardar agora". *Não clique.*
20. Teclado: Tab percorre "Ver o caminho completo" → botão do passo, com foco visível.
21. *(conta nova, `needsOnboarding`)* Título "Descubra em que estágio você está", escada **toda em contorno**, sem `aria-current`, **sem** bloco "Próximo passo", botão "Responder as 4 perguntas" e o texto "Leva uns 2 minutos". O botão abre os ajustes de perfil. O `OnboardingChecklist` **não** aparece.
22. *(conta sem custo de vida)* Sem barra, e o texto "Lance algumas despesas para o Nexa descobrir seu custo de vida…".
23. Em **320px**: nenhum texto do card fica cortado e os alvos (botões) têm pelo menos 44px de altura.

## C. Card "Quanto sobra" (M-A)

24. Título pequeno "Quanto sobra em novembro", valor grande com centavos menores. Confira que o valor é o mesmo do antigo "Capacidade de Poupança" (renda − fixos − cartões e variáveis).
25. Em **360px** com um valor de 5 dígitos ("R$ 11.954,00" ou parecido): sem quebra e sem corte.
26. Linha "de R$ X que entraram no mês": é um botão. Clique: abre a lista de receitas do mês, e dá para editar uma receita dali (abra e **feche** a edição sem salvar). A soma da lista bate com o X.
27. Barra de 4 segmentos com espaço entre eles; o menor (guardado, ~2%) ainda é visível. Árvore de acessibilidade: `img` com "Divisão da renda: N% contas fixas, N% cartões e variáveis, N% já guardado, N% livre na conta". A soma não passa de 100.
28. Lista de 4 itens, cada um com marcador colorido, nome, valor e seta. Em **320px**: linhas de largura total (não grade 2×2), nome com reticências se faltar espaço, valor sem quebrar.
29. Clique em cada um e confira o modal:
    - **Contas fixas** e **Cartões e variáveis**: os mesmos lançamentos de antes; o total do modal bate com o valor da linha até o centavo.
    - **Já guardado**: total do modal = valor da linha; os itens **não** mostram "% do total".
    - **Livre na conta**: total do modal = valor da linha (saldo); sem "% do total".
30. M-D (saídas maiores que a renda): **não existe** fatia "livre" na barra, a frase "Você gastou mais do que ganhou" aparece, e "Livre na conta" na lista mostra o valor negativo em vermelho.
31. M-C (sem renda): o card mostra a frase "Lance o que entrou no mês para ver quanto sobra depois das contas.", um contorno **tracejado** no lugar da barra e o botão "Lançar renda". "Ler uma fatura" só aparece com a IA ligada (`NEXT_PUBLIC_AI_ENABLED=true`); sem ela, "Lançar renda" ocupa a largura toda. "Lançar renda" abre o modal de lançamento (**feche sem salvar**). Os 4 itens e o alerta **não** aparecem neste mês.
32. M-E (mês vazio): o mesmo estado do passo 31, e "Lançamentos" mostra o estado vazio.

## D. Alerta do gargalo

33. M-A: o alerta aparece **abaixo** do "Quanto sobra": título "Cartões e variáveis levam N,N% da renda" (uma casa decimal), frase conforme o tier, ícone em tile, borda **visível** sobre o fundo (âmbar na atenção, vermelha no crítico).
34. M-B e M-E: o alerta **não** aparece. M-C também não.
35. Clique em "Ver onde cortar →": a página rola até "Onde foi o dinheiro" (com o topo do card visível, sem ficar sob a barra superior em 1280px) e o **foco vai para o título** "Onde foi o dinheiro". Com Tab em seguida, o foco segue para o primeiro grupo do card.
36. Com "Emular prefers-reduced-motion: reduce": a rolagem é instantânea.
37. Clique no olho de privacidade: o título vira "Cartões e variáveis levam ••% da renda".

## E. Onde foi o dinheiro (M-F)

38. A largura de cada barra é o **mesmo percentual** escrito no texto: a barra de "15% · 9 gastos" é bem mais curta que a de "40% · 3 gastos". Nenhuma barra aparece cheia sem ser 100%.
39. O menor grupo ainda aparece como uma barra visível (piso de 2%).
40. No cabeçalho do card, ao lado do título: "% do mês" (some abaixo de 360px, junto com os percentuais da coluna).
41. Destaque "Não classificado": a pílula **"Classificar"** aparece, ao lado de "Ver estes gastos". Clique: a lista de lançamentos filtra (não abre classificação). A pílula e a linha de baixo **não mudam de texto** entre ativo e inativo; só as cores.
42. 5 grupos visíveis, "Ver todas (N)" mostra o resto. Clique num grupo: o chip de filtro aparece nos lançamentos. Os testes da rodada 3 (`docs/roteiro-teste-onde-foi-o-dinheiro-rodada-3.md`) continuam valendo.
43. O fundo do card é o mesmo de antes (levemente mais claro que o canvas), e as bordas do destaque continuam visíveis.

## F. Lançamentos

44. Cabeçalho do card: título "Lançamentos de novembro" e, à direita, "A vencer" e "Selecionar" (e "Ver tudo" quando há mais de 8). Em **320px** os botões descem para uma segunda linha em vez de apertar o título. Cada botão com 36px de altura.
45. A lista está **agrupada por dia**: cada grupo tem um título ("Segunda-feira, 23 de novembro", em maiúsculas pequenas) e as linhas abaixo. Os dias seguem a ordem da lista. A linha **não** repete a data.
46. Árvore de acessibilidade: cada grupo é uma lista (`ul`) com um item (`li`) por lançamento, e os títulos de dia são `h3` (a ordem é `h1` → `h2` → `h3`, sem salto).
47. Confira uma data na virada de mês e no dia 1º: o dia mostrado bate com o do modal de edição do mesmo lançamento (sem deslocar um dia).
48. Selos de pendência: despesa não paga mostra **"A pagar"**; receita não recebida mostra **"A receber"**.
49. Busca: o campo tem rótulo "Buscar lançamentos" para o leitor de tela (clique no rótulo na árvore e o campo recebe foco). Digite algo que exista de outro mês: o título vira "Resultados", e os cabeçalhos de dia passam a levar o **ano** ("… de novembro de 2026"). Limpe a busca.
50. "A vencer": liga e desliga (âmbar quando ligado), e o estado é anunciado como pressionado.
51. "Selecionar": entra no modo seleção, a barra inferior esconde o "+", "Cancelar" sai. **Não apague nada.** Se abrir "Apagar", cancele o diálogo.
52. "Ver tudo" / "Ver mais N lançamentos" / "Mostrar menos" continuam funcionando e o corte é de 8.
53. Mês sem lançamentos: estado vazio com o botão "Lançar" e **nenhum** cabeçalho de dia.

## G. Carregando, erro e privacidade

54. Recarregue com a rede em "Slow 3G" (DevTools): o esqueleto tem o formato dos dois cards (Jornada com 5 círculos; Quanto sobra com valor, barra e 4 linhas) e **3 linhas** no lugar dos lançamentos. Quando os dados chegam, nada **salta** de lugar de forma perceptível. O alerta e "Onde foi o dinheiro" não aparecem durante o carregamento.
55. Rede em "Offline" e recarregue: o card de erro com "Tentar de novo" aparece **com o texto de antes**, e **nenhum** card novo (Jornada, Quanto sobra, alerta, Onde foi, Lançamentos) aparece. Volte para "No throttling" e clique "Tentar de novo".
56. Clique no olho (valores ocultos):
    - Jornada: valores em "R$ •••••"; a barra continua desenhada; na árvore de acessibilidade a barra tem texto "Valores ocultos" e **sem** valor atual.
    - Quanto sobra: herói e os 4 itens em "R$ •••••"; a barra vira **um bloco cinza único**, sem as proporções; o rótulo da barra é "Divisão da renda oculta".
    - Procure no DevTools (Elements) por "%" em `aria-label`, `title` e `aria-valuenow` dentro desses dois cards: **não pode haver nenhum**.
    - Alerta: "••% da renda". Lançamentos e "Onde foi": como antes.
57. Desligue o olho e confirme que tudo volta.

## H. Geral

58. Rolagem horizontal: nenhuma, em 320, 360, 390, 768 e 1280px.
59. Em **1280px**: Jornada e Quanto sobra ocupam a largura toda, com a barra superior sticky sem cobrir o destino do "Ver onde cortar".
60. Zoom do navegador em 200% em 390px: nada fica cortado e nenhum botão sai da tela.
61. Console do navegador: nenhum erro de hidratação nem aviso novo ao carregar, trocar de mês e abrir os modais.
62. Barra inferior: igual a antes (nenhuma mudança esperada).
