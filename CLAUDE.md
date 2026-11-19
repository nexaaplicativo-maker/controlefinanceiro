# Nexa — Controle Financeiro

App de controle financeiro pessoal em pt-BR, mobile-first, PWA, em beta fechado
por convite nominal. O diferencial é o perfil financeiro adaptativo (5 estágios),
não o lançamento de despesa. Não há cobrança, plano pago nem gateway.

**`CONTEXTO-IA.md`, na raiz, é a fonte de verdade técnica deste projeto** e não
é carregado automaticamente junto com este arquivo. Leia-o antes de agir sempre
que a tarefa envolver: comandos do projeto · estrutura de pastas · tokens de cor
e padrão de modal · variáveis de ambiente · schema do banco. Ele também lista o
que já está resolvido em segurança e as 10 limitações conhecidas — sem essa
leitura há risco concreto de reabrir problema resolvido ou desfazer trabalho
pronto. É mantido à mão: se uma entrega sua contrariar o que está escrito lá,
atualize o documento na mesma entrega.

## Banco de dados
- O schema NÃO vive no repositório e não há Supabase CLI. Os SQL em `supabase/`
  são idempotentes e **rodados à mão pelo dono no painel** — nunca aplique nada
  em banco remoto. Entregue o script; quem roda é ele.
- Arquivo novo: `supabase/AAAA-MM-DD-descricao.sql`, e o bloco de reversão
  correspondente em `supabase/ROLLBACK.sql` (catálogo; não se roda inteiro).
- Antes de qualquer `ALTER TABLE`, confira a tabela real no painel: não invente coluna.
- Tabela nova nasce com RLS por `user_id` e policies explícitas.

## Testes
- **O banco de desenvolvimento é o mesmo de produção.** Nenhum teste cria, edita
  ou apaga dado. O E2E (`e2e/smoke.spec.ts`) é só leitura, de propósito.
- Vitest cobre apenas `lib/**/*.test.ts` (funções puras, sem DOM). Não há teste
  de componente React.
- `npm run test:e2e` faz `build` + `start -p 3100`; não rode com o `dev` ativo.

## Ambiente e build
- CI usa **Node 20** (`.github/workflows/ci.yml`) e `package.json` não tem
  `engines`. Em dúvida sobre comportamento de build, assuma Node 20.
- `npm run lint` não roda no build (`eslint.ignoreDuringBuilds: true`) nem no CI.
  Há ~34 erros pré-existentes: rode o lint à mão e não acrescente erro novo.
- `npx tsc --noEmit` precisa passar limpo — `ignoreBuildErrors: false`, isto quebra o deploy.
- Não altere `.github/workflows/` sem pedir: o token em uso não tem escopo e o push é recusado.
- Não rode `npm run build` com o `npm run dev` ativo (ambos escrevem em `.next`).

## `mcp/` é outro projeto
Servidor MCP somente leitura com métricas agregadas, com `package.json` e
`tsconfig.json` próprios, fora do `tsconfig` do app. Não importe código do app
nele, e rode os comandos dele de dentro de `mcp/`.

## Documentos da raiz
`CONTEXTO-IA.md` é a fonte de verdade técnica. `PROMPT-NEXA.md` é o briefing de
produto (objetivo, público, definições — "dívida cara" é taxa >= 3% a.m.).
`REVISAO-LOGICA.md`, `RELATORIO-MELHORIAS.md` e `relatorio-levantamento.md` são
levantamentos pontuais, podem estar vencidos: confirme no código antes de agir.
