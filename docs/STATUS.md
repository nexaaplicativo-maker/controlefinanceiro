# Status

## Em andamento
- Nada em aberto. Última ação: configuração do `CLAUDE.md` do projeto (19/11/2026).

## Decisões
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
- A referência em texto depende de a leitura ser feita de fato: se aparecer
  trabalho refeito ou problema resolvido sendo reaberto, reavaliar o `@import`.
- `package.json` sem `engines`: CI em Node 20, máquina local em Node 26.
- `.env.example` não lista `NEXT_PUBLIC_GOOGLE_LOGIN` (divergência conhecida, aceita).
- `relatorio-levantamento.md` não está commitado.
- CI não bloqueia merge: falta marcar "Require status checks to pass" no GitHub.
- `npm run lint` fora do build e do CI, com ~34 erros pré-existentes.
- Limitações de produto e de código: seção 8 do `CONTEXTO-IA.md`.
