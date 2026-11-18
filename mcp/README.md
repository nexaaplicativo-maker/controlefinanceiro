# Servidor MCP do dono do Nexa

Um servidor MCP **somente leitura** que responde perguntas sobre o app com
**métricas agregadas**. Você pergunta ao Claude em português — *"quantos
cadastros esta semana?"*, *"quais erros mais aparecem?"* — e ele consulta o
banco por aqui.

> **Não devolve dado de ninguém.** Nem lançamento, nem saldo, nem dívida, nem
> e-mail, nem identificador de usuário. Isso não é um detalhe de
> implementação: é o motivo de este servidor existir separado do app, com
> usuário de banco próprio e nenhuma tool de SQL livre.

Vive em `mcp/`, com `package.json` e `tsconfig.json` próprios. **Não depende
do app e não é afetado por ele** — nada em `app/`, `components/`, `lib/` ou
`.github/workflows/` foi tocado.

---

## As nove perguntas que ele responde

| Tool | View | Para que serve |
|---|---|---|
| `resumo_geral` | `mcp.resumo_geral` | Quantas contas, quantas ativas, quantos lançamentos |
| `cadastros_por_dia` | `mcp.cadastros_por_dia` | Contas novas por dia (`dias`: 1 a 90) |
| `ativacao_retencao` | `mcp.ativacao_retencao` | Quantos usam de verdade, quantos voltaram |
| `uso_ia` | `mcp.uso_ia` | Uso das rotas de IA por dia (`dias`: 1 a 60) |
| `feedback_resumo` | `mcp.feedback_resumo` | Feedbacks por situação |
| `feedback_recente` | `mcp.feedback_recente` | O que escreveram, sem dizer quem |
| `erros_7d` | `mcp.erros_7d` | Erros da semana, do mais frequente ao menos |
| `perfil_agregado` | `mcp.perfil_agregado` | Distribuição de estágio, renda e estratégia |
| `volume_dados` | `mcp.volume_dados` | Linhas por tabela, para dimensionar custo |

---

## Como ele é seguro

Quatro travas independentes. Nenhuma depende de as outras funcionarem.

**1. O usuário do banco.** Conecta como `mcp_readonly`, um papel sem `USAGE`
no schema `public`. Um `SELECT` na tabela de transações falha com *permission
denied* nessa conexão. É a trava que vale: as outras protegem contra engano,
esta protege contra qualquer coisa.

**2. Consultas fixas.** **Não existe tool de SQL livre.** Cada tool é uma
entrada em `src/consultas.ts` com a consulta escrita por extenso. O nome da
view nunca vem de parâmetro. Valores entram por `$1`, com cast explícito.

**3. Validação com zod.** `dias` precisa ser inteiro na faixa certa (1–90 ou
1–60). Texto, decimal, `NaN`, objeto — tudo barrado antes de chegar ao banco.

**4. Bloqueio de coluna proibida.** Toda resposta é conferida antes de sair.
Se uma view passar a devolver `user_id`, `email`, `amount`, `balance` ou
`current_balance`, **a resposta inteira é descartada** com um erro que nomeia
a view e a coluna. Protege contra o erro mais plausível: alguém adicionar uma
coluna numa view para depurar e esquecer de tirar.

Mais: **5 segundos** de timeout por consulta (no Node e no Postgres),
**100 linhas** por resposta, e toda chamada registrada em
`mcp/logs/chamadas.jsonl` (data, tool, parâmetros, nº de linhas).

O servidor **se recusa a subir** se a string de conexão não for a do
`mcp_readonly`, ou se o ambiente tiver variável do app.

---

## Instalação

### 1. Rode o SQL no Supabase

Abra o painel → **SQL Editor** → cole [`sql/leitura.sql`](sql/leitura.sql) →
**Run**. Ele cria o schema `mcp`, as nove views e o usuário `mcp_readonly`.

> ⚠️ **Troque `TROQUE_ESTA_SENHA`** por uma senha longa e aleatória antes de
> rodar.
>
> ⚠️ **Confira se este arquivo é o SQL que você rodou.** O pedido original
> trazia um marcador `[COLE AQUI O SQL DO PASSO 1]` que ficou sem preencher,
> então o script foi escrito para casar com o que as tools consultam. O
> cabeçalho do arquivo lista o contrato que as views precisam cumprir.

Confira, conectado como `mcp_readonly`:

```sql
select * from mcp.resumo_geral;          -- deve funcionar
select * from public.transactions limit 1;  -- deve FALHAR
```

Se a segunda linha devolver dados, pare: o `REVOKE` não pegou.

### 2. Instale e configure

```bash
cd mcp
npm install
cp .env.example .env
```

Abra `mcp/.env` e preencha:

```
NEXA_MCP_DATABASE_URL=postgresql://mcp_readonly:SUA_SENHA@db.SEU-PROJETO.supabase.co:5432/postgres
```

Pegue a string no painel → botão **Connect** → *Connection string*, e troque
usuário e senha pelos do `mcp_readonly`. Duas formas funcionam:

| | Usuário | Host |
|---|---|---|
| **Direta** | `mcp_readonly` | `db.SEU-PROJETO.supabase.co:5432` |
| **Pooler** (Session) | `mcp_readonly.SEU-PROJETO` | `aws-0-REGIAO.pooler.supabase.com:5432` |

**Na prática, provavelmente é o pooler.** Em projeto novo do Supabase o host
direto não tem registro IPv4 nenhum — só IPv6 — e a maioria das redes
domésticas e de escritório não alcança IPv6. O sintoma é um
`Connection terminated due to connection timeout` que parece problema de
senha e não é. Para confirmar:

```bash
node -e "require('dns').promises.resolve4('db.SEU-PROJETO.supabase.co').then(console.log).catch(e=>console.log('sem IPv4:',e.code))"
```

`sem IPv4: ENODATA` significa pooler.

Repare no `.SEU-PROJETO` **colado no nome do usuário** — é assim que o pooler
sabe para qual projeto rotear, e é o detalhe que mais passa batido.

A região (`aws-0` ou `aws-1`, `sa-east-1`…) aparece na string que o painel
mostra em **Connect → Session pooler**. Se não tiver certeza, conectar na
região errada responde `Tenant or user not found` — é um erro inofensivo e
serve para procurar por eliminação.

Se a senha tiver `@ : / ? #`, codifique em percent-encoding (`@` → `%40`,
`:` → `%3A`, `/` → `%2F`, `?` → `%3F`, `#` → `%23`).

> `mcp/.env` e `mcp/logs/` estão no `.gitignore`. Nunca commite os dois.

### 3. Confira contra o banco

```bash
npm run verificar
```

Compila e roda as nove consultas no banco de verdade. É o passo que os testes
não conseguem fazer, e o que pega a divergência mais provável: uma view sua com
nome de coluna diferente do que a tool espera.

Ele mostra **nome de coluna e contagem de linhas, nunca o conteúdo** — a saída
pode ser colada numa conversa sem pensar duas vezes. E confere o principal:
que `public.transactions`, `public.profiles` e `auth.users` são **negadas**
nessa conexão.

Se alguma view falhar com `column "dia" does not exist`, o nome da data na sua
view é outro — ajuste o `WHERE` em `src/consultas.ts`.

---

## Testar com o Inspector

O Inspector abre uma interface web onde você chama cada tool à mão e vê a
resposta crua — bom para conferir o SQL antes de ligar no Claude.

```bash
npm run inspect
```

Compila e sobe `npx @modelcontextprotocol/inspector node dist/index.js`. Abra
o endereço que ele imprime, clique em **Connect**, depois em **Tools → List
Tools**. As nove devem aparecer. Chame `resumo_geral` primeiro: é a que não
tem parâmetro.

Se aparecer erro de conexão, o motivo quase sempre está em `mcp/.env`. O
servidor escreve o diagnóstico em **stderr**, que o Inspector mostra no painel
de log.

---

## Ligar no Claude Code

Se você já usa o Claude Code neste projeto, é um comando — e não precisa do
Claude Desktop instalado:

```bash
claude mcp add nexa-dono --scope local -- node "CAMINHO-ABSOLUTO/mcp/dist/index.js"
claude mcp list          # deve mostrar "nexa-dono: ... ✔ Connected"
```

`--scope local` guarda a configuração no seu perfil, associada a este
projeto — não cria arquivo no repositório e não vaza para quem clonar.

As tools só aparecem em uma sessão **nova**: os servidores MCP são carregados
na abertura. Saia e entre de novo.

---

## Ligar no Claude Desktop

Edite `claude_desktop_config.json`:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nexa-dono": {
      "command": "node",
      "args": [
        "C:\\Users\\SEU-USUARIO\\Desktop\\Projeto SaaS\\controlefinanceiro-main\\mcp\\dist\\index.js"
      ],
      "env": {
        "NEXA_MCP_DATABASE_URL": "postgresql://mcp_readonly:SUA_SENHA@db.SEU-PROJETO.supabase.co:5432/postgres"
      }
    }
  }
}
```

Três detalhes que costumam custar meia hora:

- **Caminho absoluto**, apontando para `dist/index.js` — não para `src/`. O
  Claude Desktop não roda TypeScript, e inicia o processo de um diretório que
  não é o seu.
- **No Windows, barras invertidas duplas** (`\\`) dentro do JSON.
- **Rode `npm run build` antes.** Sem `dist/`, o servidor não sobe.

Você pode omitir o bloco `env` se preferir deixar a senha só em `mcp/.env` —
o servidor lê aquele arquivo sozinho, pelo caminho dele, independente de onde
foi iniciado. **Não coloque nenhuma variável do app aqui**: o servidor se
recusa a subir se encontrar uma.

Reinicie o Claude Desktop. O ícone de ferramentas deve listar `nexa-dono`.

Então é só perguntar:

> *Quantos cadastros entraram nos últimos 14 dias?*
> *Quais erros mais apareceram essa semana?*
> *A galera que se cadastra chega a usar o app?*

---

## Comandos

```bash
npm run build      # compila para dist/
npm start          # roda o servidor (stdio — espera um cliente MCP)
npm run verificar  # build + confere as 9 views no banco de verdade
npm run inspect    # build + Inspector
npm test           # testes das travas de segurança
npm run typecheck  # tsc --noEmit
```

`npm start` sozinho parece travado: é esperado. O transporte é stdio, e ele
fica aguardando um cliente falar JSON-RPC pela entrada padrão.

---

## Quando algo der errado

| Sintoma | Causa provável |
|---|---|
| `NEXA_MCP_DATABASE_URL conecta como "postgres"` | Você usou a string do dono do banco. Use a do `mcp_readonly`. |
| `O ambiente deste servidor tem variável do app` | O `.env` do Nexa foi copiado para `mcp/.env`, ou essas variáveis estão no `env` do config do Claude. |
| `permission denied for schema mcp` | O SQL do passo 1 não rodou, ou rodou noutro banco. |
| `relation "mcp.resumo_geral" does not exist` | As views não existem. Rode `sql/leitura.sql`. |
| `A view ... devolveu coluna(s) de dado pessoal` | Alguém alterou a view e ela passou a expor dado individual. O servidor bloqueou de propósito — corrija a view. |
| As tools não aparecem no Claude Desktop | Caminho errado no `args`, ou faltou `npm run build`. |

Para ver o que foi consultado:

```bash
tail -5 logs/chamadas.jsonl
```
