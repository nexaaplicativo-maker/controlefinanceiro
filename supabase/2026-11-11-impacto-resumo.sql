-- =============================================================================
-- Nexa — impacto da revisão, TUDO EM UMA LINHA
-- 2026-11-11
--
-- O editor do Supabase mostra só o resultado do último comando. Este arquivo
-- junta os oito blocos num SELECT só, para uma execução responder tudo.
--
-- SOMENTE LEITURA. Nenhum INSERT, UPDATE ou DELETE.
--
-- Cole inteiro, rode, e me mande a linha.
-- =============================================================================

with

-- Custo mensal mediano, por pessoa, sobre meses fechados.
custo as (
  select user_id, percentile_cont(0.5) within group (order by total) as custo_mensal
  from (
    select user_id, to_char(date, 'YYYY-MM') as mes, sum(amount) as total
    from public.transactions
    where type = 'expense'
      and category <> 'Investimentos'
      and date < date_trunc('month', current_date)
    group by user_id, mes
  ) m
  group by user_id
),

-- Patrimônio: reserva + investido líquido, já sem a contagem dupla.
patrimonio as (
  select
    p.id as user_id,
    coalesce((select sum(g.current_amount) from public.goals g
              where g.user_id = p.id and g.title = 'Reserva de Emergência'), 0)
    + coalesce((select sum(case when t.type = 'expense' then t.amount else -t.amount end)
                from public.transactions t
                where t.user_id = p.id
                  and t.category = 'Investimentos'
                  and t.goal_id is null
                  and lower(coalesce(t.title, '')) not like 'aporte - reserva%'), 0) as total
  from public.profiles p
),

-- Meses fechados sem nenhuma receita lançada.
meses_sem_receita as (
  select user_id, to_char(date, 'YYYY-MM') as mes,
         sum(case when type = 'income' and category <> 'Investimentos' then amount else 0 end) as receita
  from public.transactions
  where date < date_trunc('month', current_date)
  group by user_id, mes
),

-- Mês corrente, para o gatilho antigo do gargalo.
mes_atual as (
  select user_id,
         sum(case when type = 'income'  and category <> 'Investimentos' then amount else 0 end) as receita,
         sum(case when type = 'expense' and category in ('Variáveis','Cartões','Cartões de Crédito') then amount else 0 end) as gargalo
  from public.transactions
  where to_char(date, 'YYYY-MM') = to_char(current_date, 'YYYY-MM')
  group by user_id
),

divida_cara as (
  select user_id, sum(current_balance) as saldo
  from public.debts
  where coalesce(status, 'ativa') = 'ativa' and monthly_rate >= 0.03
  group by user_id
)

select
  -- 0. Tamanho da base
  (select count(*) from public.profiles)                                   as b0_pessoas,
  (select count(*) from public.transactions)                               as b0_lancamentos,

  -- 1. F1 — aporte contado em dobro
  (select count(*) from public.transactions
    where category = 'Investimentos' and goal_id is null
      and lower(coalesce(title, '')) like 'aporte - reserva%')             as b1_aportes_em_dobro,

  -- 2. F2 — quem PERDE o estágio Independência
  (select count(*) from patrimonio pa join custo c using (user_id)
    where c.custo_mensal > 0
      and pa.total >= c.custo_mensal * 92
      and pa.total <  c.custo_mensal * 300)                                as b2_PERDEM_independencia,
  (select count(*) from patrimonio pa join custo c using (user_id)
    where c.custo_mensal > 0 and pa.total >= c.custo_mensal * 300)         as b2_seguem_independentes,

  -- 3. F4 — a renda de referência cai
  (select count(distinct user_id) from meses_sem_receita where receita = 0) as b3_pessoas_com_mes_sem_receita,
  (select count(*) from meses_sem_receita where receita = 0)                as b3_meses_que_viram_zero,

  -- 4. F6 — a meta de reserva sobe
  (select count(*) from public.profiles p
    where not exists (select 1 from public.transactions t
                      where t.user_id = p.id and t.type = 'expense'
                        and t.category <> 'Investimentos'
                        and t.date < date_trunc('month', current_date)))   as b4_sem_historico_de_despesa,

  -- 5. F5 — quem SAI do Modo Emergência
  (select count(*) from mes_atual m
     left join divida_cara d using (user_id)
    where m.receita > 0 and (m.gargalo / m.receita) > 0.5
      and coalesce(d.saldo, 0) = 0)                                        as b5_SAEM_da_emergencia,
  (select count(*) from divida_cara where saldo > 0)                       as b5_seguem_por_divida_cara,

  -- 6. F8 — quem usa a estratégia 80/20
  (select count(*) from public.profiles where strategy = '80_20')          as b6_estrategia_80_20,

  -- 7. F3 — lançamentos que podem ter nascido no mês errado
  (select count(*) from public.transactions
    where created_at is not null
      and extract(hour from created_at) < 3
      and date = (created_at at time zone 'UTC')::date
      and to_char(date, 'YYYY-MM') <> to_char(created_at - interval '3 hours', 'YYYY-MM'))
                                                                           as b7_cairam_no_mes_errado,

  -- 8. F9 — parcelamentos em risco (já sabemos: 0)
  (select count(distinct installment_group) from public.transactions
    where installment_group is not null and extract(day from date) >= 29)  as b8_series_em_risco;
