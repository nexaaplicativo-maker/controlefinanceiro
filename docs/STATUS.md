# Status

## Em andamento
- **Rodada 4: nova Visão Geral**, branch `design/visao-geral-rodada-4`
  (21/11/2026). Implementa o design aprovado pelo dono (tema escuro, brand
  atual, Inter; visual da proposta A + jornada da C), em 12 tarefas e um
  commit por tarefa. Sem SQL, sem dependência nova, sem query nova, sem mudança
  de tema. Novos: `JornadaCard`, `EscadaEstagios`, `CardQuantoSobra`,
  `DivisaoRenda`, `AlertaGargalo`, `EsqueletoVisaoGeral`; em `lib/`:
  `partesDoValor`, `rotuloDoDia`, `agruparPorDia`, `dividirRenda`,
  `getProximoPasso` (42 testes novos: 501 -> 543). `PillarCard` e
  `ReserveWidget` deixaram de existir. **`app/page.tsx`: 2.154 -> 1.857
  linhas** (-297), mesmo com a tela ganhando blocos, porque todo bloco novo
  nasceu em `components/`. Falta: conferência visual por largura (ver
  Pendências), que depende de navegador. Commitada na branch, **sem push**.
- **Rodada 1 de melhorias visuais da "Visão Geral"**, branch
  `design/visao-geral-rodada-1` (saiu da `main`, `7e6a548`). Quatro itens, sem
  tocar em cálculo, regra de negócio ou texto explicativo e sem nenhum SQL:
  (1) o botão flutuante de feedback deixa de cobrir o conteúdo — só existe a
  partir de `--breakpoint-gutter` (1368px) e abaixo disso virou ícone de
  cabeçalho em `/`, `/casais` e `/admin`; (2) hierarquia das ações do topo
  invertida ("Lançar" primária, "Ler Fatura" secundária), a faixa some no
  celular e o menu do `+` passou a ser `components/ui/Sheet.tsx`; (3) título
  dos cards de resumo em duas linhas em vez de cortado no celular, com a seta
  saindo no celular e o par empilhando abaixo de `--breakpoint-xs` (360px);
  (4) saudação com primeiro nome via `lib/saudacao.ts` (função pura, 19 testes
  novos), sem e-mail.
  `npx tsc --noEmit` limpo, `npm run lint` com 0 erros e 0 avisos, 496 testes
  passando (477 antes + 13 da implementação + 6 do QA).
  **Conferência visual concluída pelo dono em 20/11/2026**, em janela anônima
  em `localhost:3000`: os três ajustes pós-conferência (A, B e C) aprovados em
  390px, 320px e desktop, sem erro de hidratação. Commitada na branch, **sem
  merge**.
  QA automático concluído em 20/11/2026: nenhum reprovado. Fica provado por
  execução que os cinco números da faixa de resumo (Capacidade de Poupança,
  Renda Líquida, Custos Fixos, Cartões & Variáveis, Saldo em conta) e as
  legendas **não foram tocados** — as linhas 899-904 e 1418-1461 de
  `app/page.tsx` não aparecem em nenhum hunk do diff — e que os quatro
  variantes novos compilam com as medianas certas (`gutter:` ≥1368px,
  `max-gutter:` <1368px, `md:max-gutter:` 768-1367px, `xs:` ≥360px).
  Falta: conferência visual por largura (ver Pendências), que depende de
  navegador e é a única verificação possível do resto da rodada.
- Correção do achado M-1 da auditoria (validação do upload de comprovante) na
  branch `fix/upload-comprovante`: `lib/comprovante.ts` + testes,
  `TransactionModal` e `/api/extract` usando a mesma lista de MIME. Revisão e
  QA concluídos: nenhum achado Crítico ou Alto, 4 achados da revisão (3
  corrigidos, 1 pré-existente em pendência), 477 testes passando, `tsc` e lint
  limpos. Teste manual **parcial**, por decisão do dono (ver Decisões).
  Commitada na branch, **sem push**. Falta: PR e deploy.

## Decisões
- 21/11/2026 **Rodada 4, CORREÇÃO DO DESIGN pelo dono: o "Próximo passo" do
  estágio 2 é UM mês de custo, não a reserva mínima.** O mockup
  (`final-mes-com-dados`) mostrava "Reserva mínima R$ 0,00 de R$ 11.954,00" no
  estágio 2, mas a frase do estágio fala em "primeiro mês de reserva". Regra
  fechada: o alvo é **sempre** o do degrau atual de `getStageLadder()`, sem
  exceção por estágio (`getProximoPasso`, `lib/profile.ts`). Estágios 1 e 5 não
  têm alvo financeiro e mostram só a frase, sem barra. Efeito colateral
  assumido: a régua exibida muda de "ideal" (a antiga `ReserveWidget`) para o
  alvo do degrau; o ideal continua no `StageRoadmapModal` e em Metas.
- 21/11/2026 Rodada 4, decisões do dono como foram resolvidas: **D1** a
  `ReserveWidget` saiu, o "Próximo passo" a substitui. **D4**
  `PillarDetailModal` ganhou `total?: number`; "Já guardado"
  (`sumCategory(investimentos)`) e "Livre na conta" (`balance`) o passam, e o
  "% do total" por item some quando ele vem. **D5** "Onde foi o dinheiro"
  mantém 5 grupos (`GRUPOS_VISIVEIS = 5`) e o fundo antigo do card — trocar
  pelo utilitário `card` quebraria as bordas /50 do destaque. **D6**
  `OnboardingChecklist` e "Dica do Nexa" continuam; o checklist some só com
  `needsOnboarding` (o card Jornada já é o convite) e a dica fica logo abaixo
  do card. **D7** "Ver tudo", "A vencer" e "Selecionar" no cabeçalho dos
  lançamentos, com `flex-wrap`. **D8** rótulo "Classificar" no destaque sem
  categoria; a ação segue sendo filtrar, a linha "Ver estes gastos" explica o
  destino e o rótulo não muda entre estados (`aria-pressed` carrega o estado).
- 21/11/2026 Rodada 4, **a barra de "Onde foi o dinheiro" passa a medir o % do
  mês** (era relativa ao maior grupo). Uma barra cheia ao lado de "15% do mês"
  eram duas escalas na mesma linha. Custo: comparar grupos pequenos entre si
  fica mais difícil; o texto ao lado cobre, e o piso de 2% mantém a menor barra
  visível. O comentário do topo de `ResumoOndeFoi.tsx` foi reescrito junto.
- 21/11/2026 Rodada 4, **token novo `--color-line-contrast`** (branco a 42%):
  `line-strong` mede 1,34:1 e reprova 1.4.11 para componente gráfico. Medido
  3,65:1 (pior ponto, abertura do `card-hero`) a 4,09:1. Três usos: escada de
  estágios, trilha do "Próximo passo", contorno do mês sem renda.
- 21/11/2026 Rodada 4, **a borda do `AlertaGargalo` sobe para /60, não /50**:
  a nota de `ResumoOndeFoi` (/50 = 3,33:1) vale sobre `bg-white/5`; sobre o
  canvas, `neg/50` mede 2,55:1 e só `/60` fecha 3:1 (neg 3,16:1; warn 4,31:1).
- 21/11/2026 Rodada 4, **o cabeçalho do celular não tem mais avatar** e os três
  ícones ficam em **44px em toda largura**, inclusive abaixo de 360px: com o
  avatar fora, 3×44 + 2×8 = 148px deixam ~124px dos 272px internos; "Visão
  geral" a 22px/700 mede ~120px, então abaixo de 360px o `h1` usa 20px (~103px).
  **Estimativa por métrica média da Inter, não medida em navegador** — ver
  Pendências.
- 21/11/2026 Rodada 4, correções da revisão (sem achado crítico ou alto):
  (a) o "N meses de custo cobertos" do card Jornada vazava proporção com o
  olho fechado — agora vira "Reserva em andamento" e usa vírgula decimal; (b) a
  barra da divisão da renda e o percentual em texto passam a ter a **mesma base**
  (`DivisaoDaRenda.base`): com um resgate lançado como receita em Investimentos
  o saldo passa da renda e o texto chegava a dizer "250% livre"; (c) o modal de
  "Livre na conta" e de "Já guardado" mostra `+`/`−` por linha (e "entrada"/
  "saída" só para leitor de tela) e o total negativo sai em vermelho — fixos e
  cartões ficam como eram; (d) mês sem renda mantém a lista dos 4 itens (sem
  barra) quando há saídas; (e) o aporte só fecha e limpa o campo em sucesso;
  (f) 320px: o par rótulo/valor do "Próximo passo" empilha e a seta dos itens da
  divisão some abaixo de `xs`; (g) `TransactionRow` perdeu a prop `date`
  (código morto).
- 21/11/2026 Rodada 4, **desvio consciente do texto aprovado: o botão de aporte
  diz "Guardar na reserva"** (e não "Guardar agora") quando o alvo do degrau
  atual não é a própria reserva (estágios 1, 4 e 5). O aporte não é defeito —
  entra em `goals.current_amount`, que compõe o patrimônio do degrau 4 —, mas
  "Guardar agora" sob "Patrimônio para a independência" sugeria que o dinheiro
  ia para aquele alvo. Nos estágios 2 e 3 segue "Guardar agora".
- 21/11/2026 Rodada 4, a diretiva `eslint-disable` de
  `react-hooks/preserve-manual-memoization` no `useMemo` de `insights` foi
  removida: depois da troca dos cards o lint passou a acusá-la como "unused"
  (a regra não reporta mais nada ali). O comportamento do `useMemo` não mudou.
- 20/11/2026 **O service worker não é mais registrado em desenvolvimento** —
  e, em dev, o `RegistraServiceWorker` agora remove registro e caches que já
  existam. Motivo: `public/sw.js` trata `/_next/static/` como imutável e
  responde cache-first, o que é correto em produção (o Next põe hash no nome
  dos arquivos, build novo = URL nova) mas é veneno em `next dev`, onde o
  caminho dos chunks é fixo. O service worker passava a servir eternamente o
  JS da primeira visita, ignorando o que o dev server recompilava. O sintoma
  engana: o HTML vem novo e o JS vem velho, o React acusa **erro de
  hidratação apontando classes que já não existem no código**, e qualquer
  mudança parece "não ter surtido efeito". Custou duas investigações hoje — a
  primeira acabou em outra causa real (três `next dev` no mesmo `.next`).
  Custo aceito: offline e banner de instalação não se testam em dev; para
  isso, build de produção. **Máquina que já abriu o app em dev precisa de UMA
  limpeza manual** (DevTools → Application → Service Workers → Unregister),
  porque o service worker velho serve justamente o código que o removeria.
- 20/11/2026 Rodada 1, ajustes após a conferência visual do dono (três itens, na
  mesma branch): (A) o container das ações era `flex-col xl:flex-row`, então
  abaixo de 1280px o grupo da direita caía numa fileira própria — no celular
  sobrava o menu "⋯" sozinho acima do primeiro card, e entre 768 e 1279px
  "Lançar"/"Ler Fatura" esticavam a meia largura cada, virando dois blocos numa
  linha só deles. Agora é **uma linha em toda largura**: grupo da esquerda
  `min-w-0 flex-1` (o seletor de mês desce por `flex-wrap` quando não cabe) e
  grupo da direita `shrink-0`. (B) os botões perderam `flex-1 basis-28` e têm a
  largura do conteúdo (`shrink-0`, `px-5`), com "Lançar" preenchido e "Ler
  Fatura" secundário. (C) **abaixo de 360px os três ícones do cabeçalho caem de
  44 para 36px**, o vão de 8 para 4 e o avatar de 44 para 36: com os tamanhos
  cheios sobravam ~56px para a saudação e "Boa noite" pede ~95px, aparecendo
  "Boa ...". O dono preferiu encolher a esconder um ícone no menu — ver a
  ressalva de acessibilidade em Pendências.
- 20/11/2026 Rodada 1, limiar de goteira: `--breakpoint-gutter` ficou em
  **1368px**, não nos 1192px da primeira versão. A derivação é
  `V >= coluna + 72` (flutuante em `left-4` ocupa até x=60; a coluna começa em
  `(V−C)/2` e o conteúdo 24px depois), e **o app tem duas colunas**: `/` usa
  1120px (→ 1192) mas `/casais` e `/admin` usam `max-w-7xl` = 1280px (→ 1352).
  Vale a maior, mais 16px de folga real — em 1352 exatos o botão e a `shadow-xl`
  encostavam na aresta do primeiro card. Os 1192px da primeira versão deixavam o
  flutuante sobre o conteúdo dessas duas rotas em **1280 e 1366px**, as duas
  larguras de notebook mais comuns.
- 20/11/2026 Rodada 1, card de pilar: a **seta sai no celular**
  (`hidden md:block`) e o título ganha `min-h-10` abaixo de `md`. A seta é
  redundante no celular porque o card inteiro já é botão, e os 24px que ela
  devolve são o que faz "Renda Líquida" caber em duas linhas — aquele card é o
  único com lápis **e** seta (grupo direito de 50px, contra 16px dos demais), e
  sem isso o título ficava com 22px em 360px. O `min-h-10` reserva as duas
  linhas mesmo quando o título cabe em uma, senão o valor de um card da dupla
  nasceria ~18px acima do outro entre 414 e 767px.
- 20/11/2026 Rodada 1: a folha do `+` vive **fora** do wrapper `md:hidden` da
  barra. Dentro dele, abrir a folha em retrato e girar para paisagem (≥768px) a
  escondia com o `use-modal-a11y` ainda montado: `body.overflow` travado,
  página sem rolagem e nada visível para fechar — e no iOS não há Esc nem botão
  voltar. Fora do wrapper ela continua visível e fechável.
- 20/11/2026 Rodada 1: o botão de feedback do `/admin` fica com `rounded-lg`, e
  não com o token `rounded-field`, **de propósito** — é o raio dos dois vizinhos
  pré-existentes daquela barra. Alinhar a barra toda ao token é tarefa de outra
  rodada; um botão novo com raio diferente dos vizinhos seria pior.
- 20/11/2026 Visão Geral: **o feedback deixa de ser flutuante abaixo de
  1368px** e passa a ser um ícone no cabeçalho (decisão do dono). O botão era
  opaco e, durante a rolagem, cobria a faixa esquerda do conteúdo em 360, 768,
  1024 e 1152px — em modo de seleção deixava a caixa de marcação inalcançável.
  Mexer em `bottom` não resolvia, porque abaixo desse limiar a coluna ocupa a
  tela toda e não há onde flutuar. **Custo aceito:** o feedback não está mais
  "sempre na tela" no celular; ele rola com a página e some ao descer. Em
  troca, somem também as duas colisões entre flutuantes (o banner de
  instalação do Android cobria o botão inteiro, e o leque do `+` ficava abaixo
  dele no empilhamento). **A regra vale no app inteiro** (decisão do dono, em
  cima da primeira versão, que abria exceção para `/casais` e `/admin`): as
  duas telas receberam o ícone no próprio `<nav>`, o `FeedbackWidget` não tem
  prop de exceção e `/` tem duas entradas, uma para cada cabeçalho (celular e
  faixa do título, de 768px a 1191px). São quatro gatilhos, um painel.
- 20/11/2026 Visão Geral: a ligação do ícone de cabeçalho com o painel é um
  **evento de janela** (`abrirFeedback()`, exportado pelo próprio
  `FeedbackWidget`), não um segundo componente nem um contexto novo. O widget é
  montado pelo `ChromeDoApp`, irmão da página no layout raiz: não existe prop
  nem pai comum, e é o mesmo mecanismo que a barra inferior já usa para falar
  com o painel. Existe **um** formulário de feedback no app.
- 20/11/2026 Visão Geral: os quatro gatilhos de feedback **não viraram um
  componente**. O que eles têm em comum já está centralizado no
  `FeedbackWidget` (`abrirFeedback()` e `ROTULO_FEEDBACK`); o resto é
  acabamento que muda por tela e por motivos diferentes — fundo, raio, largura
  em que aparece e, em `/admin`, até o ícone (`MessageSquarePlus`, porque lá o
  `MessageSquare` já é a caixa de entrada do feedback recebido). Um componente
  teria `className` + `icone` + `children` para variar justamente isso: uma
  indireção que não esconderia decisão nenhuma.
- 20/11/2026 Visão Geral: o menu do `+` passou a usar **`components/ui/Sheet.tsx`**
  em vez de um 44º modal à mão — **quarta** adoção do componente (corrigido no
  QA: a folha NÃO estava órfã, `IncomeListModal`, `PillarDetailModal` e
  `ReportsModal` já a importavam na `main`).
  O leque anterior não tinha `role="dialog"`, Esc, armadilha de foco,
  devolução de foco nem resposta ao voltar do Android; e seu fundo escurecido
  (z-30) ficava abaixo do botão de feedback (z-40), que seguia clicável por
  cima. Com a IA desligada o `+` continua lançando direto, sem folha de uma
  opção só.
- 20/11/2026 Visão Geral: **o `+` da barra inferior só aparece em `/`**
  (decisão do dono). Quem escuta `openModal` é apenas `app/page.tsx`, então em
  `/casais` e `/admin` o botão abria um menu que não fazia nada. Os outros
  quatro itens da barra continuam como estavam — eles têm o mesmo problema e
  ficaram fora desta rodada.
- 20/11/2026 Visão Geral: **a saudação não usa mais o e-mail** (decisão do
  dono). Mostrava `userEmail.split('@')[0]` ("souza.higor") e "Usuário" como
  último recurso; nenhum dos dois é nome. Agora: com nome no perfil, só o
  primeiro nome capitalizado ("Bom dia, Higor"); sem nome, só a saudação ("Bom
  dia", sem vírgula pendurada). Como o app ainda não coleta nome, **o que
  aparece hoje na tela é só a saudação** — mudança intencional e visível.
  A cadeia está pronta em `lib/saudacao.ts` e o ponto de ligação está
  comentado em `app/page.tsx` (`nomeDoPerfil`), sem presumir nome de coluna.
- 19/11/2026 Comprovante (achado M-1): a **lista de MIME é compartilhada** entre
  o upload e `/api/extract` (`TIPOS_COMPROVANTE`, em `lib/comprovante.ts`) —
  é a mesma pergunta e tem que bater com o `allowed_mime_types` do bucket. Os
  **tetos ficam separados de propósito**: 4 MB na rota de IA (base64 na memória
  da função, borda de ~4,5 MB da Vercel, imagem já reduzida por
  `lib/imagem.ts`) e 10 MiB no comprovante (vai cru para o Storage, espelhando
  o `file_size_limit` do bucket). Há teste de guarda contra unificação.
- 19/11/2026 Comprovante: **HEIC/HEIF sem MIME é tolerado** — quando o
  navegador manda `''` ou `application/octet-stream`, só `.heic`/`.heif` no
  nome resolvem o tipo. É defeito de navegador com foto de iPhone, e recusar
  quebraria caso legítimo. A tolerância é só no cliente; a rota de IA continua
  exigindo MIME declarado.
- 19/11/2026 Comprovante: o upload **força o `contentType`** e deriva a extensão
  do MIME validado, nunca do nome do arquivo. Isso é pré-requisito para
  configurar `allowed_mime_types` no painel: sem ele o SDK enviaria o
  `file.type` vazio da foto de iPhone e o bucket recusaria o upload.
- 19/11/2026 Comprovante: **`allowed_mime_types` fica sem configurar por
  enquanto**, por decisão do dono. O teste manual (`docs/roteiro-teste-m1.md`,
  executado pelo dono) cobriu o passo 1 (JPG aceito, objeto gravado `.jpg` com
  `image/jpeg`), o passo 3 (`.html` recusado com a mensagem correta e nenhum
  objeto criado no bucket) e o passo 4 (arquivo de 11 MB recusado, mensagem
  "11.0 MB") — os três passaram. Os passos 2 (PDF), 5 (HEIC de iPhone) e 6
  (comprovante abandonado no estado) foram **pulados por decisão do dono**.
  Sem o passo 5 não existe prova de que a foto de iPhone grava objeto com
  `Content-Type: image/heic`, e preencher a lista sem essa prova recusaria todo
  upload de iPhone. Limpeza do teste concluída: o bucket voltou a 3 objetos.
- 19/11/2026 O `CLAUDE.md` **não duplica** o `CONTEXTO-IA.md`: o documento já é
  mantido à mão e reescrevê-lo criaria duas fontes de verdade divergentes.
- 19/11/2026 A referência ao `CONTEXTO-IA.md` é **em texto, não `@import`**
  (decisão do dono, substitui o import usado na primeira versão). Motivo: o
  import carregaria as 336 linhas do documento no início de toda sessão, mesmo
  em tarefa que não precisa delas. Em troca, o `CLAUDE.md` nomeia explicitamente
  os gatilhos de leitura obrigatória — comandos, estrutura de pastas, tokens de
  cor, padrão de modal, variáveis de ambiente e schema do banco.
- 19/11/2026 `.env.example` segue sem `NEXT_PUBLIC_GOOGLE_LOGIN` por decisão do
  dono; a flag existe em `lib/features.ts` e está documentada no `CONTEXTO-IA.md`.

## Pendências e riscos
- **Rodada 4: conferência visual NÃO feita** (nenhum navegador no ambiente de
  implementação). Roteiro em `docs/roteiro-teste-visao-geral-rodada-4.md`.
  O que mais precisa de olho: cabeçalho em 320px (o título em 20px cabe ao lado
  dos três ícones de 44px?), o herói "R$ 11.954,00" em 360px, a lista de 4
  itens em 320px, as bordas do alerta, a escada em 320px e o foco indo para o
  `h2` de "Onde foi o dinheiro" depois de "Ver onde cortar".
- **Rodada 4: o botão de aporte aparece também nos estágios 4 e 5**, rotulado
  "Guardar na reserva". O dinheiro vai de fato para a reserva (e a barra do
  degrau 4 anda, porque patrimônio inclui a reserva), mas o dono pode preferir
  esconder o botão ali ou apontá-lo para Patrimônio.
- **Rodada 4, DECISÃO DO DONO: política de privacidade inconsistente nas
  barras.** Com os valores ocultos, a `DivisaoRenda` colapsa a barra num bloco
  cinza (o argumento: uma barra 69% vermelha vaza o que o olho escondeu) e o
  `JornadaCard` mantém o preenchimento da barra de progresso desenhado (o
  argumento: o que se esconde é valor, não o estágio). As duas escolhas seguem o
  plano aprovado, mas não podem coexistir como regra — o preenchimento do
  "Próximo passo" também é uma proporção reserva ÷ alvo. Nenhum comportamento
  foi mudado; falta o dono escolher uma política.
- **Rodada 4, DECISÃO DO DONO: o herói e o item "Livre na conta" podem não
  fechar.** O herói é `capacidadePoupanca` (renda − fixos − gargalo) e o item é
  `balance`; com despesa em categoria própria do usuário, ou com resgate, a
  identidade `sobra = guardado + livre` quebra em silêncio, e a linha "Já
  descontados R$ X que você guardou" saiu com o `PillarCard`. As saídas
  possíveis mudam número exibido ou texto aprovado.
- **Rodada 4, A MEDIR EM NAVEGADOR: o herói a `text-[40px] font-extrabold`** sem
  plano B. Com 6 dígitos ou sinal negativo pode passar dos 232px internos em
  320px e causar rolagem horizontal.
- **Rodada 4: o título "% da renda" do alerta usa uma casa decimal** ("68,6%"),
  como o plano pediu; o selo antigo arredondava ("69%"). Se o dono preferir
  inteiro, é uma linha em `AlertaGargalo`.
- **Coletar o nome do usuário — pré-requisito para a saudação mostrar nome.**
  Hoje o nome não existe em lugar nenhum: o `signUp` não manda `options.data`
  (`app/login/page.tsx`), o `handle_new_user` grava só `id` e `role`,
  `profiles` não tem coluna de nome e nem o `WelcomeModal` nem o
  `ProfileSettingsModal` perguntam. Enquanto isso, o cabeçalho mostra só "Bom
  dia". A tarefa completa é: decidir a coluna e rodar o `ALTER TABLE` à mão no
  painel, pedir o nome no cadastro e/ou no onboarding, permitir editar nos
  ajustes, e então trocar o `nomeDoPerfil` de `app/page.tsx` (hoje fixo em
  `null`, com o ponto de ligação comentado) pelo campo do perfil — a consulta
  já é `select('*')`, a coluna nova chega sozinha.
- **Conferência visual da rodada 1: parcialmente feita** (20/11/2026, pelo dono,
  em janela anônima em `localhost:3000`). **Aprovado:** 390px, 320px e desktop,
  com os três ajustes pós-conferência (A, B e C) e sem erro de hidratação.
  **Ainda não conferido, por largura:** 360 e 414px (título dos cards em duas
  linhas e alinhamento dos números da dupla, com e sem valores visíveis e com a
  badge de %); 767 e 768px (faixa de ações reaparecendo e barra inferior
  desaparecendo no mesmo ponto); 1024 e 1152px (ícone de feedback ao lado do
  olho, flutuante ausente); **1280 e 1366px** (as duas larguras de notebook mais
  comuns — o flutuante não deve existir ainda, em nenhuma das três rotas);
  **1368 e 1440px** (flutuante voltando na goteira sem tocar o conteúdo). E o
  menu do `+` no celular: folha abrindo, Esc, voltar do Android, foco devolvido,
  **e girar para paisagem com a folha aberta** (tem que continuar visível e
  fechável). Em `/casais` e `/admin`, a fileira do `<nav>` em 360/768/1024px e
  em 1368px. O roteiro completo de 20 passos está no relatório de QA desta
  rodada.
- Barra de seleção múltipla da lista de lançamentos (`sticky bottom-2 z-10`,
  `app/page.tsx`) fica **atrás** da barra inferior de 80px no celular: o botão
  "Apagar" nasce coberto. Encontrado na rodada 1 e deixado de fora de
  propósito — é da lista de lançamentos, não da faixa de resumo.
- Os quatro itens da barra inferior (Início, Cartões, Gráficos, Ajustes) só
  funcionam em `/`: em `/casais` e `/admin` eles disparam `openModal` e ninguém
  escuta. O `+` foi escondido nessas rotas na rodada 1; os outros quatro não.
- **A conferir no Android com a IA ligada: corrida de histórico no
  modal-abre-modal.** Suspeita levantada na revisão da rodada 1 e **não
  reproduzida** (ninguém no ambiente tem navegador). Ao escolher "Novo
  lançamento" na folha do `+`, o cleanup da folha chama `history.back()` no
  mesmo commit em que o modal de lançamento agenda seu `pushState` em
  `setTimeout(0)`; sem ordem garantida, se o `pushState` ganhar, o `back()`
  consome a entrada nova e o modal fecha sozinho. **Não foi "consertado" de
  propósito:** mexer na ordem de operações de histórico sem poder testar podia
  virar um bug real. Reprodução: `NEXT_PUBLIC_AI_ENABLED=true`, Chrome no
  Android, `+` → "Novo lançamento". Se o modal abrir e fechar na hora, o
  conserto é despachar o `openModal` só depois da folha fechar
  (`requestAnimationFrame` ou `onExitComplete`). Hoje não afeta produção: com a
  IA desligada o `+` abre o lançamento direto, sem folha.
- **`prefers-reduced-motion` quase não existe no projeto.** A rodada 2 da lista
  de lançamentos trouxe a primeira ocorrência (`motion-reduce:transition-none`
  na revelação das ações em `components/TransactionRow.tsx`); o resto do app
  segue sem tratamento, nem em CSS nem como `MotionConfig`. Pré-existente. Uma
  regra global em `app/globals.css` ou `<MotionConfig reducedMotion="user">` no
  layout resolve o app inteiro de uma vez; é item próprio, não de uma rodada
  visual.
- **Linha de lançamento: dois resíduos conhecidos da rodada 2** (20/11/2026).
  (a) Aparelho híbrido (notebook com tela de toque) reporta `pointer: fine`, e
  ali o botão sobreposto não é renderizado: as ações dependem do `:hover` que o
  navegador emula no toque. O teclado alcança sempre, e trocar para
  `any-pointer` reabriria o problema no tablet. (b) Com cursor, em janela
  abaixo de 360px, o bloco do valor ocupa a linha inteira e o grupo de ações
  reservado cai numa terceira linha vazia (~40px). Os dois ficaram por decisão:
  o conserto cobraria apertar o valor contra o texto em tela estreita.
- **Ideia futura: número da parcela fora do título** (anotada em 20/11/2026,
  depois do teste em Android real). Hoje o `TransactionModal` cola `(3/12)` no
  fim do `title` (`components/TransactionModal.tsx:190`), e na lista o título
  trunca com reticências — então doze parcelas da mesma compra ficam com o
  rótulo visualmente idêntico, que é exatamente o que mais precisa distinguir.
  O caminho já está quase todo pronto: **a coluna `installment_info` existe e
  já é preenchida** pelos dois caminhos (`TransactionModal.tsx:205` no manual,
  `AiUploadModal.tsx:159` na importação), **já vem na consulta do dashboard**
  (`COLUNAS_TX`, `app/page.tsx:107`, sem query nova) e **já tem padrão visual
  pronto** — o `CreditCardManagerModal.tsx:204` mostra o `3/12` como selo
  `shrink-0` ao lado do título. Falta só exibir na linha de lançamento. Cuidado
  ao fazer: o título continua carregando o `(3/12)` colado, então sem usar o
  `tituloBase()` de `lib/parcelas.ts` (o mesmo que o `AiUploadModal` já usa) a
  informação apareceria duas vezes.
- **Melhoria futura: a linha do filtro ativo aperta em ~360px** (anotada em
  20/11/2026, depois do teste em Android real da rodada 3). A faixa
  "Mostrando apenas · [chip] · N compras" (`app/page.tsx:1653-1665`) é um
  `flex items-center gap-2` **sem `flex-wrap`**, e o chip **não trunca**. Com
  uma subcategoria longa (`Impostos e Tarifas` é a maior do vocabulário) mais
  "12 compras", os três itens disputam a largura em 360px e o chip encolhe o
  texto que é justamente o nome do filtro ligado. Caminhos possíveis, em ordem
  de custo: `flex-wrap` com `gap-y-1` (deixa quebrar em duas linhas);
  `truncate` + `min-w-0` no chip; ou encurtar "Mostrando apenas" para
  "Filtrando:", que devolve ~60px. Não foi feito na rodada 3 porque o card
  "Onde foi o dinheiro" era o escopo, e esta faixa é da lista de lançamentos.
- ~~**Abaixo de 360px, os três ícones do cabeçalho da Visão Geral têm 36×36px**~~ **FECHADA na rodada 4** (por estimativa, falta conferir em 320px): os três são 44×44 em toda largura. Texto original:
  **Abaixo de 360px, os três ícones do cabeçalho da Visão Geral têm 36×36px**,
  sob o piso de 44px do sistema de design. É troca consciente (20/11/2026): com
  44px a saudação não cabia e aparecia "Boa ...", e a alternativa era tirar um
  ícone da tela. Vale só nessa faixa; de 360px para cima os três voltam a 44px.
  Se um dia a saudação ganhar nome de verdade, reavaliar — com nome o texto
  cresce e a conta aperta de novo.
- ~~O lápis "Editar receitas" do card de pilar tem **26×26px**~~ **FECHADA na rodada 4**: o card de pilar não existe mais; editar receita é o botão "de R$ X que entraram no mês" (44px). Texto original: O lápis "Editar receitas" do card de pilar tem **26×26px**, abaixo do piso de
  44px que a rodada 1 adotou para alvo de toque. Não foi tocado porque mexer
  nele mudaria o layout do card que a rodada acabou de ajustar.
- **Painel do Supabase, bucket `receipts`: `allowed_mime_types` EM ESPERA** —
  não configurar até o passo 5 do `docs/roteiro-teste-m1.md` (HEIC de iPhone
  gravando objeto com `Content-Type: image/heic`) ser executado e passar. Esse
  passo foi pulado no teste de 19/11/2026. Quando for configurar, os valores são
  `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`,
  `application/pdf`, e a **ordem continua obrigatória: código em produção
  primeiro, painel depois** — o painel antes do código recusa upload de foto de
  iPhone, que chega sem MIME declarado e só passa a ter `contentType`
  normalizado com o código novo no ar.
- Comprovante ainda **sem conferência de magic number** (achado B-1 da
  auditoria): o conteúdo não é inspecionado, só o MIME declarado.
- A referência em texto depende de a leitura ser feita de fato: se aparecer
  trabalho refeito ou problema resolvido sendo reaberto, reavaliar o `@import`.
- `package.json` sem `engines`: CI em Node 20, máquina local em Node 26.
- `.env.example` não lista `NEXT_PUBLIC_GOOGLE_LOGIN` (divergência conhecida, aceita).
- `relatorio-levantamento.md` não está commitado.
- CI não bloqueia merge: falta marcar "Require status checks to pass" no GitHub.
- `npm run lint` fora do build e do CI: nada impede erro novo de entrar. O
  código está limpo hoje — 0 erros e 0 avisos em 139 arquivos (ESLint 9.39.1,
  verificado em 20/11/2026).
- Limitações de produto e de código: seção 8 do `CONTEXTO-IA.md`.
