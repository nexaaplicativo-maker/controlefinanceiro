-- =============================================================================
-- Nexa (controlefinanceiro) — subcategoria em `transactions`
-- 2026-11-02
--
-- POR QUE
--   Importar uma fatura de cartão e ver o gasto separado em Transporte,
--   Alimentação, Mercado etc. Hoje a IA é obrigada a classificar em apenas
--   quatro categorias macro (Contas Fixas, Variáveis, Cartões, Investimentos),
--   porque é nelas que o app todo se apoia.
--
--   Trocar o significado de `category` quebraria em silêncio:
--     - app/page.tsx:444            custo fixo do mês
--     - components/BudgetModal.tsx  orçamento de 3 categorias
--     - lib/advisor-context.ts:110  contexto do consultor
--     - components/SubscriptionTrackerModal.tsx
--     - app/api/auto-budget/route.ts
--   Nenhum deles daria erro. O gasto só pararia de ser contado.
--
--   Então o detalhe entra num segundo eixo. Um Uber é Transporte E é Variável:
--   são perguntas diferentes, e cada uma fica na sua coluna.
--
-- SEGURANÇA DESTA MUDANÇA
--   Coluna nova, anulável, sem default. Nenhuma linha existente muda, nenhuma
--   consulta atual é afetada (ninguém faz `select *` esperando um shape fixo —
--   o app lê por nome de campo). Dá para rodar com o app no ar.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PASSO 1 — A COLUNA
-- -----------------------------------------------------------------------------

alter table public.transactions
  add column if not exists subcategoria text;

comment on column public.transactions.subcategoria is
  'Segundo eixo de classificação: onde o dinheiro foi gasto (Transporte, '
  'Alimentação, Mercado...). Vocabulário fechado em lib/subcategorias.ts. '
  'Nulo = não classificado. `category` continua sendo a natureza do gasto.';


-- -----------------------------------------------------------------------------
-- PASSO 2 — RLS
--
-- Nada a fazer. A RLS de `transactions` é por linha (`user_id = auth.uid()`),
-- não por coluna, então a coluna nova já está protegida pelas políticas que
-- existem. Este passo está aqui só para registrar que foi verificado, e não
-- esquecido.
-- -----------------------------------------------------------------------------


-- -----------------------------------------------------------------------------
-- PASSO 3 — ÍNDICE
--
-- A tela vai filtrar e agrupar por subcategoria dentro de um mês, sempre do
-- próprio usuário. O índice composto cobre esse acesso; subcategoria sozinha
-- não teria seletividade suficiente para valer o custo de escrita.
--
-- Parcial, porque lançamento sem subcategoria nunca é alvo de filtro.
-- -----------------------------------------------------------------------------

create index if not exists transactions_user_subcategoria_idx
  on public.transactions (user_id, subcategoria)
  where subcategoria is not null;


-- -----------------------------------------------------------------------------
-- PASSO 4 — CONFERIR
-- -----------------------------------------------------------------------------

-- 4a. A coluna existe?
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'transactions'
  and column_name = 'subcategoria';

-- 4b. O índice existe?
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'transactions'
  and indexname = 'transactions_user_subcategoria_idx';

-- Esperado: 4a devolve 1 linha (text, YES) e 4b devolve 1 linha.
-- Enquanto 4a não devolver nada, NÃO libere o deploy que grava subcategoria:
-- o insert falha e a importação por IA para de funcionar inteira.


-- =============================================================================
-- COMO DESFAZER
--
--   drop index if exists public.transactions_user_subcategoria_idx;
--   alter table public.transactions drop column if exists subcategoria;
--
-- Perde as subcategorias já classificadas, e nada além disso.
-- =============================================================================
