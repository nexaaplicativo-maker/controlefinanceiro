-- =============================================================================
-- Nexa — ligar a transação à meta que ela alimenta
-- 2026-11-11
--
-- POR QUE
--   Quando você guarda R$ 500 na reserva, o dinheiro sai da conta E entra na
--   reserva. As duas coisas são verdade, e o app precisa registrar as duas:
--   uma despesa, que derruba o saldo, e a soma em goals.current_amount.
--
--   O problema é que o patrimônio soma `reserva + investido`, e o "investido"
--   saía das transações em Investimentos — incluindo essa. O mesmo dinheiro
--   aparecia nos dois termos. Cinco aportes de R$ 1.000 viravam R$ 10.000.
--
--   A correção provisória (commit F1) reconhece o aporte pelo TÍTULO que o app
--   escreve. Funciona, mas é frágil: basta alguém mudar a string em um dos
--   lados, ou o usuário escrever o mesmo título à mão, para o defeito voltar
--   em silêncio. Esta coluna torna a ligação explícita.
--
-- SEGURANÇA DESTA MUDANÇA
--   Coluna nova, anulável, sem default. Nenhuma linha existente muda. Dá para
--   rodar com o app no ar.
--
--   `on delete set null`: apagar uma meta NÃO apaga os lançamentos que a
--   alimentaram. O dinheiro saiu da conta de verdade; o histórico continua.
--
-- ORDEM IMPORTA
--   Rode ESTE arquivo ANTES de atualizar o app. O código que grava `goal_id`
--   falha inteiro se a coluna não existir — o insert é recusado e o aporte
--   não acontece.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PASSO 1 — A COLUNA
-- -----------------------------------------------------------------------------

alter table public.transactions
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

comment on column public.transactions.goal_id is
  'Meta que este lançamento alimenta (ou da qual retira). Quando preenchido, '
  'o valor NÃO entra no patrimônio investido — ele já é contado pelo '
  'current_amount da meta. Nulo = investimento comum ou lançamento qualquer.';


-- -----------------------------------------------------------------------------
-- PASSO 2 — ÍNDICE
--
-- O acesso é "os lançamentos desta meta". Parcial porque a esmagadora maioria
-- das linhas tem goal_id nulo e nunca é alvo dessa busca.
-- -----------------------------------------------------------------------------

create index if not exists transactions_goal_id_idx
  on public.transactions (user_id, goal_id)
  where goal_id is not null;


-- -----------------------------------------------------------------------------
-- PASSO 3 — RLS
--
-- Nada a fazer: a RLS de `transactions` é por linha (`user_id = auth.uid()`),
-- não por coluna. Registrado para constar que foi verificado.
--
-- Uma observação: a referência a `goals` não vaza nada. O Postgres valida a
-- chave estrangeira ignorando RLS, mas um usuário não consegue LER a meta de
-- outro, e tentar apontar para uma meta alheia só seria possível adivinhando
-- o UUID dela.
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- PASSO 4 — CONFERIR (rode e me mande o resultado)
-- -----------------------------------------------------------------------------

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transactions'
  and column_name = 'goal_id';

-- Esperado: 1 linha (uuid, YES).
-- Enquanto não devolver nada, NÃO libere o deploy que grava goal_id.


-- -----------------------------------------------------------------------------
-- PASSO 5 — QUANTOS APORTES ANTIGOS EXISTEM (somente leitura)
--
-- Mostra os lançamentos que hoje são reconhecidos pelo título. Serve para você
-- decidir se vale preencher o goal_id deles — e para saber o tamanho do
-- estrago que o defeito causou no patrimônio.
-- -----------------------------------------------------------------------------

select
  count(*)                                   as lancamentos,
  coalesce(sum(t.amount), 0)                 as total_contado_em_dobro
from public.transactions t
where t.category = 'Investimentos'
  and lower(t.title) like 'aporte - reserva%';


-- -----------------------------------------------------------------------------
-- PASSO 6 — BACKFILL (OPCIONAL, e só depois de ver o passo 5)
--
-- Liga os aportes antigos à meta "Reserva de Emergência" do mesmo usuário.
-- Está comentado de propósito: é a única parte deste arquivo que ESCREVE em
-- linha existente, e você deve rodá-la sabendo o que vai mudar.
--
-- Sem o backfill nada quebra — o código mantém o reconhecimento por título
-- para as linhas antigas. O backfill só deixa de depender dele.
-- -----------------------------------------------------------------------------

-- update public.transactions t
-- set goal_id = g.id
-- from public.goals g
-- where g.user_id = t.user_id
--   and g.title = 'Reserva de Emergência'
--   and t.category = 'Investimentos'
--   and lower(t.title) like 'aporte - reserva%'
--   and t.goal_id is null;


-- =============================================================================
-- COMO DESFAZER
--
--   drop index if exists public.transactions_goal_id_idx;
--   alter table public.transactions drop column if exists goal_id;
--
-- Perde só a ligação. Os lançamentos e as metas continuam intactos, e o
-- reconhecimento por título volta a ser o único caminho.
-- =============================================================================
