# Status

## Em andamento
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
- **Abaixo de 360px, os três ícones do cabeçalho da Visão Geral têm 36×36px**,
  sob o piso de 44px do sistema de design. É troca consciente (20/11/2026): com
  44px a saudação não cabia e aparecia "Boa ...", e a alternativa era tirar um
  ícone da tela. Vale só nessa faixa; de 360px para cima os três voltam a 44px.
  Se um dia a saudação ganhar nome de verdade, reavaliar — com nome o texto
  cresce e a conta aperta de novo.
- O lápis "Editar receitas" do card de pilar tem **26×26px**, abaixo do piso de
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
