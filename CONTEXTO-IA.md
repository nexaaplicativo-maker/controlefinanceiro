# Contexto do Projeto — Nexa (Controle Financeiro)

> Cole este documento no início da conversa com qualquer IA antes de pedir
> alterações no código. Ele descreve o projeto como ele é hoje.
>
> **Mantenha este arquivo atualizado.** Documento desatualizado aqui é pior que
> documento nenhum: a IA lê "não existe X", conclui que precisa criar X, e
> desfaz trabalho já feito.

---

## 1. O que é o produto

**Nexa** é um app de controle financeiro pessoal em português do Brasil,
mobile-first, PWA instalável. Público: classe média brasileira, com cartão
parcelado e pouca educação financeira.

O diferencial não é lançar despesa — é o **perfil financeiro adaptativo**: o
app classifica o usuário em 5 estágios (Emergência → Estabilidade → Reserva →
Acumulação → Independência) e calibra limites, metas e conselhos ao caso dele,
em vez de aplicar constantes universais.

Funcionalidades: lançamentos com parcelamento e recorrência · múltiplas
carteiras · categorias e subcategorias · contas a vencer · cartões (fatura do
mês separada de parcelas futuras) · dívidas com juros · investimentos e
patrimônio · orçamentos mensais · metas · previsão · raio-x de gastos ·
calendário · assinaturas · módulo casais · relatórios com gráficos e PDF ·
leitura de recibo/PIX/fatura por foto (IA) · conselheiro financeiro (IA) ·
painel `/admin`.

**Não há cobrança, plano nem assinatura paga.** O acesso é um **beta fechado
por convite nominal** (tabela `beta_invites`). Não existe Stripe, checkout,
trial ou nível premium — "Nexa Premium" é só o nome do PWA. O
`SubscriptionTrackerModal` rastreia as assinaturas *do usuário* (Netflix,
academia), não a dele conosco.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 |
| Linguagem | TypeScript (`strict: true`) — `tsc --noEmit` passa limpo |
| Estilo | Tailwind CSS v4, tokens em `@theme`, **sem `tailwind.config`** |
| Backend | Supabase — Auth, Postgres e Storage |
| IA | Google Gemini (`gemini-flash-latest`) via REST direto, sem SDK |
| Gráficos | `recharts` · PDF: `jspdf` · Ícones: `lucide-react` · Animação: `motion` |
| Testes | **Vitest** (unitários) + **Playwright** (E2E) |
| Hospedagem | Vercel · Gerenciador: **npm** |

**É um repositório Git**, branch principal `main`.

**Há CI** em `.github/workflows/ci.yml`: roda `tsc --noEmit`, `npm test`,
`npm run build` e `npm audit --omit=dev --audit-level=high` em todo push e PR.
Ele **não** roda `npm run lint`, e não bloqueia merge (falta marcar "Require
status checks" no GitHub).

**Não há:** `middleware.ts`, state manager global, ORM, Docker, worker, fila,
cron, webhook, gateway de pagamento.

---

## 3. Estrutura de arquivos

```
app/
  page.tsx              Dashboard — ~2.100 linhas, o coração do app
  layout.tsx            Layout raiz: fonte, PWA, Toast, ConfirmDialog, ErrorBoundary
  globals.css           Tokens de design (@theme) + utilitários próprios
  login/ casais/ admin/ recuperar-senha/ privacidade/ termos/
  api/
    extract/route.ts      POST — imagem/PDF -> lista de lançamentos
    advisor/route.ts      POST — contexto do mês -> conselho em Markdown
    auto-budget/route.ts  POST — renda -> orçamento em JSON
    health/route.ts       GET  — estado da configuração e commit servido

components/   45 arquivos: 29 modais + moldura do app + `TransactionRow` + 4 primitivas em ui/
lib/          32 arquivos de regra de negócio + 23 de teste
hooks/        use-mobile, use-modal-a11y
supabase/     17 scripts SQL idempotentes, rodados À MÃO no painel
e2e/          smoke.spec.ts
public/       Ícones, manifest.json, sw.js
scripts/      carga-banco.mjs (teste de carga, uso manual)
```

**Não existe `app/manifest.ts`** — o manifest é só `public/manifest.json`.

---

## 4. Como a aplicação funciona

### Tudo é client-side
Praticamente todo componente começa com `"use client"`. Não há Server
Components buscando dados nem `middleware.ts`. Os componentes falam **direto**
com o Supabase pelo navegador.

**As rotas em `app/api/` existem por um motivo só: manter a `GEMINI_API_KEY`
fora do navegador.** Não são camada de negócio.

### A navegação NÃO usa rotas
As ~14 "telas" do menu (Poupar, Cartões, Relatórios, Orçamentos, Metas,
Calendário, Assinaturas, Conselheiro IA, Casal, Previsão, Raio-x, Dívidas,
Patrimônio, Perfil financeiro) **são modais dentro de `/`**, carregados sob
demanda com `next/dynamic` + `ssr: false`.

A barra inferior dispara um evento, não navega:

```ts
// components/BottomNav.tsx
window.dispatchEvent(new CustomEvent('openModal', { detail: name }));
// app/page.tsx escuta e abre o modal
```

Consequência: nenhuma tem URL própria, não dá para compartilhar link, e o
"voltar" do Android sai do app em vez de fechar o modal.

O **`+` central da barra só aparece em `/`** (`usePathname`): quem escuta
`openModal` é apenas `app/page.tsx`, então em `/casais` e `/admin` ele abria um
menu que não levava a nada. Com a IA ligada, o `+` abre uma folha ("Adicionar")
com "Novo lançamento" e "Ler fatura"; com a IA desligada sobraria uma opção só,
então ele lança direto, sem menu. Essa folha é o `components/ui/Sheet.tsx`.

A entrada do **feedback** não é mais um flutuante em toda largura, e a regra
vale para **toda rota autenticada**: o botão `fixed` só aparece a partir de
`--breakpoint-gutter` (1368px), onde existe margem externa para ele; abaixo
disso é um ícone no cabeçalho. O limiar cobre a **maior** coluna do app
(`max-w-7xl` = 1280px em `/casais` e `/admin`, não os 1120px da `/`), senão o
flutuante volta a cobrir conteúdo em 1280 e 1366px. São quatro gatilhos, em
três telas:

| Tela | Onde | Larguras |
|---|---|---|
| `/` | cabeçalho do celular, ao lado do olho e do sino | < 768px |
| `/` | faixa do título, ao lado do olho | 768–1367px |
| `/casais` | `<nav>`, depois de "Configurar Cofre" | < 1368px |
| `/admin` | `<nav>`, depois de "Atualizar" | < 1368px |

Todos disparam o mesmo evento e abrem o **mesmo** painel — existe um
formulário de feedback só. `abrirFeedback()` e `ROTULO_FEEDBACK` saem de
`components/FeedbackWidget.tsx`; o acabamento visual é de cada cabeçalho.
Em `/admin` o ícone é `MessageSquarePlus` porque ali `MessageSquare` já é a
caixa de entrada do feedback recebido (`FeedbackInboxModal`).

### Proteção de rota
Feita no navegador (`window.location.href = '/login'`) — ou seja, **cosmética**.
**A proteção real dos dados é a RLS no Postgres.** A REST API do Supabase é
acessível diretamente com a anon key, que é pública por desenho.

### Estado
Só `useState` local. O dashboard tem ~30 flags booleanas de modal.

### Regra de negócio
Vive em `lib/`, em **funções puras sem I/O** — é por isso que é testável.
`lib/profile.ts` (917 linhas) é o centro: estágios, limites e diagnóstico.
Constantes em `lib/constantes-financeiras.ts`, cada uma com a fonte declarada
(ou marcada como HEURÍSTICA, explicitamente).

Regra não óbvia em `sumCategory` (`app/page.tsx`): para `Investimentos` o valor
**sempre soma**; nas demais, despesa soma e receita subtrai.

### Parcelamento
`TransactionModal` gera N linhas em `transactions` num `insert` com array,
todas com o mesmo `installment_group`. Só a primeira nasce com o `is_paid`
escolhido; as demais nascem `false`.

A data de cada parcela sai de `somarMeses(date, i)` (`lib/data.ts`), que opera
na string `YYYY-MM-DD` e prende o dia ao último dia do mês de destino: 31/01
mais um mês dá 28/02, não 03/03.

**Não converta essa data para `Date` nem reintroduza correção manual de fuso.**
Até 20/11/2026 esta seção mandava manter um
`startDate.setMinutes(startDate.getMinutes() + startDate.getTimezoneOffset())`
que **não existe mais no código**: ele saiu de propósito no commit `f46c795`,
porque a conversão para `Date` era exatamente a chance de errar o dia. O
comentário em `components/TransactionModal.tsx` registra a troca.

---

## 5. Schema do banco (Supabase / Postgres)

> ⚠️ **O schema NÃO vive neste repositório.** Ele foi montado à mão pelo painel
> do Supabase. Os SQL em `supabase/` são o que se lembrou de escrever, não o
> estado atual — tabelas centrais como `transactions`, `profiles`, `wallets`,
> `categories`, `budgets` e `goals` **não têm `CREATE TABLE` em arquivo
> nenhum**. O que segue foi reconstruído do que o código lê e grava.
> **Antes de qualquer `ALTER TABLE`, confira a tabela real no painel.**
> Não invente coluna: se precisar de uma nova, diga explicitamente qual
> `ALTER TABLE` é necessário — o dono roda o SQL à mão.

Todas as tabelas têm `id` (uuid) e `user_id` (uuid, dono da linha), e
**todas são protegidas por RLS por dono**.

### `transactions` — tabela central
| Coluna | Tipo | Observação |
|---|---|---|
| `title` | text | nome do lançamento |
| `amount` | numeric | **sempre positivo**; o sinal vem do `type` |
| `type` | text | `'income'` \| `'expense'` |
| `category` | text | ver categorias abaixo |
| `subcategoria` | text | vocabulário fechado em `lib/subcategorias.ts` |
| `date` | date | `YYYY-MM-DD` |
| `is_paid` | boolean | `false` = pendente |
| `installment_group` | uuid \| null | agrupa parcelas da mesma compra |
| `installment_info` | text \| null | ex.: `"3/12"` |
| `import_group` | uuid \| null | agrupa linhas da mesma fatura importada |
| `goal_id` | uuid \| null | → `goals(id)` `on delete set null` |
| `is_split` | boolean | despesa dividida com o parceiro(a) |
| `wallet_id` | uuid \| null | → `wallets(id)` |
| `receipt_url` | text \| null | **caminho** no Storage, não URL pública |

### Demais tabelas
| Tabela | Colunas principais |
|---|---|
| `profiles` | `id` (= id no Auth), `role` (`'client'`\|`'admin'`), `monthly_income`, `income_type` (`'fixa'`\|`'variavel'`), `has_debt`, `main_goal`, `strategy`, `onboarded_at`, `accepted_terms_at`, `accepted_terms_version` |
| `wallets` | `name`, `type`, `balance` — ⚠️ `balance` **não é atualizado**; saldos são somados das transações |
| `categories` | `name`, `type` — personalizadas do usuário |
| `budgets` | `category`, `amount`, `month` (text `YYYY-MM`), único por categoria+mês |
| `goals` | `title`, `target_amount`, `current_amount` |
| `debts` | `name`, `creditor`, `kind`, `current_balance`, `monthly_rate`, `minimum_payment`, `status` |
| `debt_payments` | `debt_id` → `debts(id)` cascade, `amount`, `paid_at`, `note` |
| `investments` | `name`, `kind`, `invested_amount`, `current_value` |
| `advice_history` | `period`, `advice`, `snapshot` (jsonb) — permite a IA cobrar no mês seguinte o que foi combinado |
| `category_corrections` | `title_pattern`, `to_category`, `hits` — as 15 maiores vão no prompt do `/api/extract` |
| `ai_rate_limits` | `route`, `window_start`, `call_count` |
| `beta_invites` | `email`, `code`, `used_by`, `expires_at` — só admin lê |
| `couple_settings` | `joint_wealth`, `emergency_fund`, `house_expenses` |
| `couple_goals` | `title`, `target_amount`, `current_amount`, `color` |
| `feedback`, `error_log` | feedback do beta e erros do cliente |

**Storage:** bucket `receipts`, arquivos em `{user_id}/{timestamp}.{ext}`. O
`{ext}` vem do **MIME validado** (`lib/comprovante.ts`), não do nome do arquivo
escolhido pelo usuário, e o upload força o `contentType` correspondente.

Configuração esperada do bucket (aplicada à mão no painel, como o resto):

| Campo | Valor |
|---|---|
| `public` | `false` — leitura só por URL assinada de 5 min (`lib/receipts.ts`) |
| `file_size_limit` | 10 MiB (10485760), igual ao `MAX_BYTES_COMPROVANTE` |
| `allowed_mime_types` | **pendente** — `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`, `application/pdf` |

O `allowed_mime_types` só pode ser preenchido **depois** de o código que força
o `contentType` estar em produção: antes disso, foto de iPhone (que chega sem
MIME declarado) passaria a ser recusada pelo bucket.

**RPCs:** `has_beta_access`, `redeem_beta_invite`, `delete_user`,
`admin_user_stats`, `admin_platform_totals`, `admin_feedback_list`,
`is_admin(uid)`. As de admin são `SECURITY DEFINER` e verificam elas mesmas
quem está chamando.

### Categorias (string, não enum)
- **Despesa:** `Contas Fixas` · `Variáveis` · `Cartões` · `Investimentos`
- **Receita:** `Salário` · `Renda Extra`

`Cartões de Crédito` ainda é aceito como sinônimo legado de `Cartões`.
Usuários podem criar categorias próprias, que convivem com essas.

---

## 6. Segurança — JÁ RESOLVIDO, não reportar como novidade

- ✅ **Nenhuma credencial no código.** Não há URL nem chave como fallback.
  `lib/supabase.ts` cria o cliente de forma preguiçosa (via `Proxy`) e falha
  com mensagem nominal se faltar variável.
- ✅ **`GEMINI_API_KEY` só no servidor.** Nunca em código de cliente.
- ✅ **As 3 rotas de IA exigem JWT** — `lib/api-auth.ts` (`requireUser`),
  centralizado, devolve 401 sem token válido.
- ✅ **Rate limit por usuário, no banco** (`lib/rate-limit.ts`, tabela
  `ai_rate_limits`): advisor 10/h, auto-budget 10/h, extract 40/h. No banco e
  não em memória porque em serverless um `Map` de módulo não limita nada.
- ✅ **Recibos por URL assinada de 5 minutos** (`lib/receipts.ts`). O banco
  guarda o caminho; registros antigos têm o caminho extraído da URL antiga.
- ✅ **RLS por `user_id`** em todas as tabelas, com `is_admin(uid)` como
  `SECURITY DEFINER` e trigger `prevent_self_role_escalation`.
- ✅ **Cabeçalhos de segurança** em `next.config.ts`: HSTS, `nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- ✅ **Os dois caminhos de arquivo são validados**, com a **mesma lista fechada
  de MIME** (`TIPOS_COMPROVANTE`, em `lib/comprovante.ts`) e **tetos diferentes
  de propósito**: 4 MB em `/api/extract` (vira base64 na memória da função e
  tem a borda de ~4,5 MB da Vercel no caminho) e 10 MiB no upload do
  comprovante (vai cru para o Storage; o teto espelha o `file_size_limit` do
  bucket). Não unifique os tetos. No comprovante, a extensão do objeto e o
  `contentType` vêm do MIME validado, nunca do nome do arquivo. Ainda **não há
  conferência de magic number** em nenhum dos dois.
- ✅ **Rotas de IA não vazam erro cru** ao cliente: detalhe no log, mensagem
  genérica na resposta.
- ✅ **Sem `dangerouslySetInnerHTML`** em lugar nenhum.
- ✅ **Formatação de dinheiro consolidada** em `lib/format.ts` (`formatMoney`,
  `formatMoneySigned`, `formatPercent`). Não crie outra.
- ✅ **Acesso à sessão consolidado** em `lib/session.ts` (`getUserId`,
  `requireUserId`, `getAccessToken`, `getSessionUser`). Não copie o bloco de
  `getSession` de novo — 7 arquivos ainda o fazem e devem migrar.

**Regra ao alterar o banco:** toda tabela nova precisa de RLS por `user_id`
desde o início. Filtro só no frontend não protege nada.

---

## 7. Variáveis de ambiente (apenas nomes)

```env
NEXT_PUBLIC_SUPABASE_URL=      # obrigatória
NEXT_PUBLIC_SUPABASE_ANON_KEY= # obrigatória
GEMINI_API_KEY=                # apenas servidor — nunca expor ao cliente
NEXT_PUBLIC_AI_ENABLED=        # 'true' mostra os botões de IA
NEXT_PUBLIC_GOOGLE_LOGIN=      # 'true' mostra o login com Google
```

As flags estão em `lib/features.ts` e são **desligadas por padrão**: botão que
sempre falha é pior que botão ausente. O login com Google exige também habilitar
o provedor no painel do Supabase. `/api/health` informa o estado da configuração
sem expor valor nenhum.

---

## 8. Limitações conhecidas — não replicar, não reportar como descoberta

1. **`app/page.tsx` tem ~2.100 linhas** e ~30 flags de modal. É a maior fonte
   de atrito do projeto.
2. **44 de 46 queries não têm `limit()`** — o dashboard baixa o histórico
   inteiro do usuário a cada abertura.
3. **O lint não é barreira**: `next.config.ts` tem
   `eslint.ignoreDuringBuilds: true` e o CI não roda lint, então nada impede um
   erro novo de entrar sem ninguém ver. O código em si está limpo — `npm run
   lint` sai com 0 erros e 0 avisos em 139 arquivos (ESLint 9.39.1, verificado
   em 20/11/2026); a afirmação anterior de "~34 erros pré-existentes" estava
   vencida. Rode à mão.
4. **`components/ui/Sheet.tsx` tem 4 imports** — `IncomeListModal`,
   `PillarDetailModal`, `ReportsModal` e, desde 20/11/2026, o menu do `+` em
   `components/BottomNav.tsx` (quarta adoção, não a primeira: as outras três já
   estavam na `main`). Ainda são **26 arquivos** repetindo `role="dialog"` à
   mão. `EmptyState` e `Skeleton` (`ui/Surface.tsx`) são importados em 4
   arquivos de 45.
5. ~~`--color-ink-3` reprova no contraste~~ **RESOLVIDO.** `--color-ink-3` e
   `--color-cents` estão em **#7f8c98**, que mede **5,74:1 sobre
   `--color-canvas`** e **5,00:1 sobre o gradiente do `card`** — passa AA para
   texto normal (4,5:1) nos dois fundos. O valor antigo (#5d6975, ~3,6:1) saiu;
   o comentário em `app/globals.css` registra a subida e os números.
6. **O service worker é fachada:** `public/sw.js` intercepta `fetch` e não faz
   nada. **O app não funciona offline**, apesar de se anunciar como PWA.
7. **~84 usos de `any`** — não há tipos gerados do Supabase.
8. **CSP está em `Content-Security-Policy-Report-Only`**, com `'unsafe-inline'`
   e `'unsafe-eval'`. Não bloqueia nada hoje; é deliberado, para calibrar antes
   de ligar.
9. **`BetaGate` e o rate limit falham abertos** por decisão explícita (ver
   comentários nos arquivos). O rate limit também é *ler-depois-gravar*, sem
   operação atômica.
10. **Nenhum teste de componente React.** A cobertura é toda de `lib/`.

---

## 9. Como trabalhar neste projeto

**Convenções:**

- **Idioma:** UI, mensagens de erro e comentários em **português do Brasil**.
  Nomes de variáveis e funções em inglês ou português — o padrão é misto e
  já existente; siga o do arquivo que estiver editando.
- **Comentários explicam o PORQUÊ**, não o quê. O padrão da base é registrar a
  decisão e o que acontecia antes dela. Mantenha isso.
- **Modais:** um arquivo por modal em `components/`, *named export*
  (`export function XModal`), props `{ isOpen, onClose, onSave? }`, envolvidos
  em `<AnimatePresence>` + `motion.div`, usando o hook `use-modal-a11y`.
- **Cor e raio vêm dos tokens** de `app/globals.css`: `bg-canvas`, `bg-surface`,
  `text-ink`/`-2`/`-3`, `brand`, `pos`, `neg`, `warn`, `rounded-card`.
  Não escreva `bg-neutral-900` nem `indigo-500`.
- Além dos padrões do Tailwind, há **dois breakpoints próprios**:
  - `--breakpoint-gutter` (1368px) = a largura a partir da qual sobra margem
    externa ao lado da **maior** coluna do app (`max-w-7xl` = 1280px, usada em
    `/casais` e `/admin`; a `/` usa 1120px). Conta: `V >= coluna + 72`, mais
    16px de folga. É o limiar de qualquer elemento flutuante nos cantos; use
    `gutter:` / `max-gutter:` em vez de recalcular.
  - `--breakpoint-xs` (360px) = o piso em que dois cards cabem lado a lado. O
    par de cards de resumo da Visão Geral é `grid-cols-1 xs:grid-cols-2`,
    porque em 320px o título do card "Renda Líquida" ficava com 26px.
- **Revelação por tipo de ponteiro (`components/TransactionRow.tsx`):** as ações
  da linha de lançamento nascem em `opacity-0` com cursor (`pointer-fine:`) e
  aparecem no hover/foco; no toque (`pointer-coarse:`) são uma disclosure aberta
  pelo botão sobreposto à linha. **Não é bug** e não se "conserta" trocando por
  `sm:`/`md:` — o `group-hover:` do Tailwind v4 só dispara em
  `@media (hover: hover)`, então um corte por largura prenderia as ações
  invisíveis num tablet de toque. A camada de conteúdo da linha é
  `pointer-events-none`; todo elemento interativo dentro dela precisa de
  `pointer-events-auto`.
- **Feedback:** sempre `toast(msg, "success"|"error"|"warning"|"info")` de
  `components/Toast`. Nunca `alert()`.
- **Dinheiro:** `amount` é sempre positivo no banco; o sinal é semântico, via
  `type`. Formate com `lib/format.ts`.
- **Regra nova de negócio vai para `lib/`**, como função pura, com teste. Não
  escreva cálculo dentro do JSX.

**Ao propor mudanças:**

- Não introduza biblioteca de UI nova (shadcn, MUI) sem ser pedido.
- Não converta tudo para Server Components de uma vez.
- Toda tabela nova precisa de policy de RLS junto.
- Não converta a data da parcela para `Date` nem reintroduza correção manual
  de fuso: `somarMeses` opera na string e é a regra certa (ver "Parcelamento").
- Prefira consolidar duplicação existente a criar mais uma cópia.
- Não altere `.github/workflows/` sem pedir — o token em uso não tem escopo
  para isso e o push é recusado.

**Comandos:**

```bash
npm install
npm run dev        # desenvolvimento
npm test           # 496 testes unitários em lib/ (Vitest)
npm run test:e2e   # fumaça (Playwright) — sobe o servidor
npx tsc --noEmit   # tipos
npm run lint       # ESLint — NÃO roda no build nem no CI
npm run build      # produção
```

> Não rode `npm run build` com o `npm run dev` ativo: os dois escrevem em
> `.next` e o cache corrompe. Se acontecer, apague `.next` e reinicie.
