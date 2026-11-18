-- =============================================================================
-- Nexa — camada de leitura do servidor MCP do dono
--
-- EXECUTAR MANUALMENTE NO SQL EDITOR DO PAINEL SUPABASE.
-- NÃO FAZ PARTE DAS MIGRATIONS DO APP.
--
-- Os scripts de `supabase/` são o schema do produto. Este aqui é
-- infraestrutura de observação: cria um schema separado (`mcp`), nove views
-- agregadas e um usuário de banco que só enxerga essas views. Nada em
-- `public` é alterado. É seguro rodar mais de uma vez.
--
-- -----------------------------------------------------------------------------
-- ATENÇÃO — ESTE ARQUIVO PODE NÃO SER O QUE VOCÊ RODOU
--
-- O pedido que gerou este servidor trazia um marcador
-- "[COLE AQUI O SQL DO PASSO 1]" que ficou sem preencher, então o SQL abaixo
-- foi ESCRITO AQUI para casar com o que as tools consultam — não é cópia do
-- seu script.
--
-- Antes de confiar nele, faça uma de duas coisas:
--   (a) substitua este arquivo pelo SQL que você realmente rodou; ou
--   (b) rode este aqui, que recria as views no formato que o servidor espera.
--
-- O que o servidor exige das views, em qualquer um dos casos:
--   • vivem no schema `mcp`, com estes nove nomes exatos;
--   • `mcp.cadastros_por_dia` e `mcp.uso_ia` têm uma coluna `dia` do tipo
--     date — é por ela que a janela de dias é filtrada;
--   • NENHUMA devolve user_id, email, amount, balance, current_balance ou
--     outra coluna da lista em `src/seguranca.ts`. Se devolver, o servidor
--     recusa a resposta inteira em vez de entregá-la.
-- -----------------------------------------------------------------------------
-- =============================================================================

create schema if not exists mcp;

comment on schema mcp is
  'Views agregadas para o servidor MCP do dono. Somente leitura, sem dado pessoal.';


-- =============================================================================
-- 1) VIEWS
--
-- Todas usam `security_invoker = off` (o padrão): rodam com os direitos de
-- quem as criou, não de quem consulta. É o que permite ao `mcp_readonly`
-- enxergar o agregado sem ter permissão nenhuma nas tabelas de origem.
-- =============================================================================

-- Visão de uma linha só: o estado do app agora.
create or replace view mcp.resumo_geral as
select
  (select count(*) from auth.users)                                as contas,
  (select count(*) from auth.users
     where last_sign_in_at >= now() - interval '30 days')          as ativas_30d,
  (select count(*) from auth.users
     where created_at >= now() - interval '7 days')                as novas_7d,
  (select count(*) from public.transactions)                       as lancamentos,
  (select count(*) from public.profiles
     where onboarded_at is not null)                               as perfis_preenchidos,
  (select min(created_at)::date from auth.users)                   as primeiro_cadastro;


-- Cadastros por dia. A coluna `dia` é o que o servidor filtra.
create or replace view mcp.cadastros_por_dia as
select
  created_at::date as dia,
  count(*)         as cadastros
from auth.users
group by 1
order by 1 desc;


-- Quantos cadastrados chegaram a usar, e quantos voltaram.
create or replace view mcp.ativacao_retencao as
with uso as (
  select user_id as u, count(*) as n, max(created_at) as ultimo
  from public.transactions
  group by 1
)
select
  (select count(*) from auth.users)                                   as cadastrados,
  (select count(*) from uso)                                          as lancaram_algo,
  (select count(*) from uso where n >= 5)                             as lancaram_5_ou_mais,
  (select count(*) from uso where ultimo >= now() - interval '7 days') as ativos_7d,
  (select count(*) from uso where ultimo >= now() - interval '30 days')as ativos_30d;


-- Uso das rotas de IA por dia. A coluna `dia` é o que o servidor filtra.
create or replace view mcp.uso_ia as
select
  window_start::date   as dia,
  route                as rota,
  count(*)             as sessoes,
  sum(call_count)      as chamadas
from public.ai_rate_limits
group by 1, 2
order by 1 desc, 2;


-- Feedback por situação.
create or replace view mcp.feedback_resumo as
select
  coalesce(status, 'sem status') as status,
  count(*)                       as total,
  max(created_at)::date          as mais_recente
from public.feedback
group by 1
order by 2 desc;


-- Os feedbacks mais recentes, SEM autor.
--
-- O texto é o produto do beta e precisa ser lido; quem escreveu, não. Sem
-- user_id e sem e-mail, isto é leitura de recado, não perfilamento.
create or replace view mcp.feedback_recente as
select
  created_at::date                 as dia,
  coalesce(status, 'sem status')   as status,
  left(message, 280)               as trecho
from public.feedback
order by created_at desc
limit 100;


-- Erros dos últimos 7 dias, do mais frequente para o menos.
create or replace view mcp.erros_7d as
select
  left(coalesce(message, '(sem mensagem)'), 200) as mensagem,
  count(*)                                       as ocorrencias,
  count(distinct user_id)                        as contas_afetadas,
  max(created_at)::date                          as ultima_vez
from public.error_log
where created_at >= now() - interval '7 days'
group by 1
order by 2 desc;


-- Distribuição dos perfis. Contagens, nunca a renda de alguém.
create or replace view mcp.perfil_agregado as
select
  coalesce(income_type, 'não informado') as tipo_de_renda,
  coalesce(strategy,    'não informada') as estrategia,
  coalesce(main_goal,   'não informado') as objetivo,
  count(*) filter (where has_debt is true)  as com_divida,
  count(*) filter (where has_debt is false) as sem_divida,
  count(*)                                  as contas
from public.profiles
group by 1, 2, 3
order by 6 desc;


-- Tamanho de cada tabela, para dimensionar custo e plano.
create or replace view mcp.volume_dados as
select 'transactions' as tabela, count(*) as linhas from public.transactions
union all select 'profiles',     count(*) from public.profiles
union all select 'wallets',      count(*) from public.wallets
union all select 'goals',        count(*) from public.goals
union all select 'budgets',      count(*) from public.budgets
union all select 'debts',        count(*) from public.debts
union all select 'investments',  count(*) from public.investments
union all select 'feedback',     count(*) from public.feedback
union all select 'error_log',    count(*) from public.error_log
order by 2 desc;


-- =============================================================================
-- 2) O USUÁRIO SOMENTE LEITURA
--
-- É esta parte que faz o servidor MCP ser seguro de verdade. As travas no
-- código TypeScript protegem contra engano; esta protege contra qualquer
-- coisa, porque o banco simplesmente não devolve.
--
-- TROQUE A SENHA ABAIXO ANTES DE RODAR. Depois, cole a string de conexão em
-- mcp/.env — nunca neste arquivo, que vai para o git.
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mcp_readonly') then
    -- Use uma senha longa e aleatória. Esta string é um marcador.
    create role mcp_readonly with login password 'TROQUE_ESTA_SENHA';
  end if;
end
$$;

-- Nada de herdar permissão de grupo por acidente.
alter role mcp_readonly nosuperuser nocreatedb nocreaterole noreplication nobypassrls;

-- Conectar, e enxergar SÓ o schema mcp.
grant connect on database postgres to mcp_readonly;
grant usage on schema mcp to mcp_readonly;
grant select on all tables in schema mcp to mcp_readonly;

-- Views criadas depois também ficam legíveis, sem precisar rodar isto de novo.
alter default privileges in schema mcp grant select on tables to mcp_readonly;

-- O ponto central: o schema do app fica inacessível a este papel.
revoke all on all tables in schema public from mcp_readonly;
revoke all on all sequences in schema public from mcp_readonly;
revoke all on schema auth from mcp_readonly;

-- POR QUE NÃO MEXEMOS NO SCHEMA `public` EM SI
--
-- A tentação é `revoke all on schema public from public`, para tirar o USAGE
-- que todo papel herda. NÃO FAÇA ISSO aqui: esse comando atinge TODOS os
-- papéis do banco, o app inclusive, e devolver os privilégios certos depois é
-- fácil de errar — num script que você vai colar em produção, é risco sem
-- retorno.
--
-- E não é preciso. USAGE num schema só dá o direito de RESOLVER nomes dentro
-- dele; não dá direito de ler tabela nenhuma. O Supabase concede SELECT nas
-- tabelas de `public` a `anon` e `authenticated`, e `mcp_readonly` não é
-- membro de nenhum dos dois. Sem privilégio na tabela, `select * from
-- public.transactions` falha mesmo com USAGE no schema.
--
-- A conferência do passo 3 prova isso na prática. Rode-a.


-- =============================================================================
-- 3) CONFERÊNCIA
--
-- Rode isto DEPOIS, conectado como mcp_readonly, para provar as duas coisas
-- que importam. A primeira deve devolver dados; as outras precisam falhar
-- com "permission denied".
--
-- Se qualquer uma das que precisam falhar devolver linha, PARE e confira os
-- GRANTs: a trava principal do servidor não está de pé.
-- =============================================================================

-- select * from mcp.resumo_geral;              -- precisa FUNCIONAR
-- select * from public.transactions limit 1;   -- precisa FALHAR
-- select * from public.profiles limit 1;       -- precisa FALHAR
-- select * from auth.users limit 1;            -- precisa FALHAR
