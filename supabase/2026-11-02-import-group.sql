-- =============================================================================
-- Nexa (controlefinanceiro) — agrupar o que veio na mesma importação
-- 2026-11-02
--
-- POR QUE
--   Uma fatura lida por IA vira dezenas de lançamentos. Hoje, para desfazer
--   uma importação, só apagando um por um — 34 confirmações.
--
--   O app já resolve isso para parcelamento: `installment_group` liga as
--   parcelas, e apagar uma pergunta se quer apagar a série inteira, com
--   desfazer (app/page.tsx, handleDeleteTransaction). Esta coluna dá à
--   importação o mesmo tratamento, pelo mesmo caminho.
--
--   Não reaproveitamos `installment_group`: ele significa "mesma compra
--   dividida no tempo". Uma fatura é o oposto — compras diferentes no mesmo
--   documento. Misturar os dois quebraria a lógica de parcela futura.
--
-- SEGURANÇA DESTA MUDANÇA
--   Coluna nova, anulável, sem default. Nenhuma linha existente muda. Dá para
--   rodar com o app no ar.
--
--   As ~34 compras já importadas ficam com `import_group` nulo e continuam
--   sem agrupamento — não há como descobrir retroativamente quais vieram
--   juntas. Para essas, use o modo de seleção da lista, que não depende desta
--   coluna.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PASSO 1 — A COLUNA
-- -----------------------------------------------------------------------------

alter table public.transactions
  add column if not exists import_group uuid;

comment on column public.transactions.import_group is
  'Liga os lançamentos criados na mesma leitura por IA, para desfazer a '
  'importação inteira de uma vez. Nulo = lançamento avulso ou anterior a '
  'esta coluna. Não confundir com installment_group (parcelas da mesma compra).';


-- -----------------------------------------------------------------------------
-- PASSO 2 — ÍNDICE
--
-- O acesso é sempre "todas as linhas deste grupo, deste usuário", na hora de
-- apagar. Parcial porque lançamento avulso nunca é alvo dessa busca.
-- -----------------------------------------------------------------------------

create index if not exists transactions_user_import_group_idx
  on public.transactions (user_id, import_group)
  where import_group is not null;


-- -----------------------------------------------------------------------------
-- PASSO 3 — RLS
--
-- Nada a fazer: a RLS de `transactions` é por linha (`user_id = auth.uid()`),
-- não por coluna. A exclusão em lote continua restrita ao dono, inclusive
-- quando feita por `import_group`. Registrado para constar que foi verificado.
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- PASSO 4 — CONFERIR
-- -----------------------------------------------------------------------------

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transactions'
  and column_name = 'import_group';

-- Esperado: 1 linha (uuid, YES).
-- Enquanto não devolver nada, NÃO libere o deploy que grava import_group:
-- o insert falha e a importação por IA para de funcionar inteira.


-- =============================================================================
-- COMO DESFAZER
--
--   drop index if exists public.transactions_user_import_group_idx;
--   alter table public.transactions drop column if exists import_group;
--
-- Perde só o agrupamento. Os lançamentos continuam intactos.
-- =============================================================================
