# Status

## Em andamento
- Correção do achado M-1 da auditoria (validação do upload de comprovante) na
  branch `fix/upload-comprovante`: `lib/comprovante.ts` + testes,
  `TransactionModal` e `/api/extract` usando a mesma lista de MIME. Revisão e
  QA concluídos: nenhum achado Crítico ou Alto, 4 achados da revisão (3
  corrigidos, 1 pré-existente em pendência), 477 testes passando, `tsc` e lint
  limpos. Teste manual **parcial**, por decisão do dono (ver Decisões).
  Commitada na branch, **sem push**. Falta: PR e deploy.

## Decisões
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
- `npm run lint` fora do build e do CI, com ~34 erros pré-existentes.
- Limitações de produto e de código: seção 8 do `CONTEXTO-IA.md`.
