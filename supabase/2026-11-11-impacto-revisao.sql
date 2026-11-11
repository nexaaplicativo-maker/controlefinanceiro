-- =============================================================================
-- Nexa — quanto a revisão de lógica muda para quem já usa
-- 2026-11-11
--
-- SOMENTE LEITURA. Nenhum INSERT, UPDATE ou DELETE. Pode rodar em produção
-- com o app no ar, quantas vezes quiser.
--
-- Cada bloco responde "quantas pessoas veem um número diferente depois de X".
-- Rode um por vez e me mande os resultados: com eles eu digo quem é afetado
-- antes de a mudança chegar.
--
-- APROXIMAÇÃO ASSUMIDA
-- O app calcula a mediana sobre os 6 meses FECHADOS com lançamento, pulando
-- os meses em que a pessoa não usou. Reproduzir isso aqui exigiria repetir a
-- regra em SQL — e duas cópias da mesma regra é exatamente o que esta revisão
-- passou o tempo todo corrigindo. Então aqui a conta é aproximada, e serve
-- para dimensionar, não para auditar.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0 — Tamanho da base
-- -----------------------------------------------------------------------------

select
  (select count(*) from public.profiles)                                as pessoas,
  (select count(*) from public.transactions)                            as lancamentos,
  (select count(distinct user_id) from public.transactions)              as pessoas_com_lancamento,
  (select count(*) from public.goals where title = 'Reserva de Emergência') as reservas_criadas;


-- -----------------------------------------------------------------------------
-- 1 — F1: aporte de reserva contado duas vezes
--
-- Já rodamos e deu zero. Deixo aqui para reconferir depois de o botão
-- "Poupar" voltar a ser usado.
-- -----------------------------------------------------------------------------

select
  count(*)                      as lancamentos_de_aporte,
  coalesce(sum(amount), 0)      as valor_contado_em_dobro,
  count(distinct user_id)       as pessoas_afetadas
from public.transactions
where category = 'Investimentos'
  and goal_id is null
  and lower(title) like 'aporte - reserva%';


-- -----------------------------------------------------------------------------
-- 2 — F2: quem cai de Independência para Acumulação
--
-- O alvo passou de 92x para 300x o custo mensal. Quem está entre os dois
-- perde o Estágio 5.
-- -----------------------------------------------------------------------------

with custo as (
  select
    user_id,
    percentile_cont(0.5) within group (order by total) as custo_mensal
  from (
    select user_id, to_char(date, 'YYYY-MM') as mes, sum(amount) as total
    from public.transactions
    where type = 'expense'
      and category <> 'Investimentos'
      and date < date_trunc('month', current_date)
    group by user_id, mes
  ) por_mes
  group by user_id
),
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
)
select
  count(*) filter (where pa.total >= c.custo_mensal * 300)                               as seguem_independentes,
  count(*) filter (where pa.total >= c.custo_mensal * 92
                     and pa.total <  c.custo_mensal * 300)                               as PERDEM_independencia,
  count(*) filter (where pa.total < c.custo_mensal * 92)                                 as nunca_estiveram
from patrimonio pa
join custo c on c.user_id = pa.user_id
where c.custo_mensal > 0;


-- -----------------------------------------------------------------------------
-- 3 — F4: a renda de referência cai para quem tem mês sem receita
--
-- Mês ATIVO (com algum lançamento) e SEM receita passou a contar zero na
-- mediana, em vez de sumir. Quanto mais meses assim, mais a renda cai.
-- -----------------------------------------------------------------------------

with meses as (
  select
    user_id,
    to_char(date, 'YYYY-MM') as mes,
    sum(case when type = 'income' and category <> 'Investimentos' then amount else 0 end) as receita
  from public.transactions
  where date < date_trunc('month', current_date)
  group by user_id, mes
)
select
  count(distinct user_id) filter (where receita = 0)        as pessoas_com_mes_sem_receita,
  count(*) filter (where receita = 0)                       as meses_que_passam_a_contar_zero,
  count(distinct user_id)                                   as pessoas_com_historico
from meses;


-- -----------------------------------------------------------------------------
-- 4 — F6: a meta de reserva SOBE para quem não tem histórico de despesa
--
-- O custo deixou de ser chutado em 70% da renda e passou a ser o consumo
-- planejado da estratégia — 80% no 50/30/20.
-- -----------------------------------------------------------------------------

select
  p.strategy,
  count(*) as pessoas_sem_historico_de_despesa
from public.profiles p
where not exists (
  select 1 from public.transactions t
  where t.user_id = p.id
    and t.type = 'expense'
    and t.category <> 'Investimentos'
    and t.date < date_trunc('month', current_date)
)
group by p.strategy
order by 2 desc;


-- -----------------------------------------------------------------------------
-- 5 — F5: quem SAI do Modo Emergência
--
-- O gargalo acima de 50% deixou de classificar Emergência. Quem estava lá só
-- por causa disso — sem dívida cara e sem déficit recorrente — sobe de
-- estágio e volta a receber sugestão de aporte.
-- -----------------------------------------------------------------------------

with mes_atual as (
  select
    user_id,
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
  count(*) filter (where m.receita > 0 and (m.gargalo / m.receita) > 0.5
                     and coalesce(d.saldo, 0) = 0)            as SAEM_da_emergencia,
  count(*) filter (where coalesce(d.saldo, 0) > 0)            as seguem_por_divida_cara
from mes_atual m
left join divida_cara d on d.user_id = m.user_id;


-- -----------------------------------------------------------------------------
-- 6 — F8: quem usa a estratégia 80/20
--
-- O alerta dessas pessoas deixou de medir gargalo (teto de 40%) e passou a
-- medir consumo total (teto de 80%).
-- -----------------------------------------------------------------------------

select coalesce(strategy, '(não escolhida)') as estrategia, count(*) as pessoas
from public.profiles
group by 1
order by 2 desc;


-- -----------------------------------------------------------------------------
-- 7 — F3: lançamentos que podem ter nascido no mês errado
--
-- Gravados entre 00:00 e 03:00 UTC, ou seja, entre 21:00 e 23:59 em Brasília
-- do dia anterior. E cuja data ficou no dia seguinte ao da criação.
-- -----------------------------------------------------------------------------

select
  count(*) as lancamentos_suspeitos,
  count(distinct user_id) as pessoas,
  count(*) filter (where to_char(date, 'YYYY-MM') <> to_char(created_at - interval '3 hours', 'YYYY-MM'))
    as caíram_no_MES_errado
from public.transactions
where created_at is not null
  and extract(hour from created_at) < 3
  and date = (created_at at time zone 'UTC')::date;


-- -----------------------------------------------------------------------------
-- 8 — F9: parcelamentos que podem ter pulado um mês
--
-- Compras parceladas lançadas nos dias 29, 30 ou 31. Com o `setMonth` antigo,
-- a parcela seguinte podia transbordar para o mês errado.
-- -----------------------------------------------------------------------------

select
  count(distinct installment_group) as series_em_risco,
  count(*)                          as parcelas,
  count(distinct user_id)           as pessoas
from public.transactions
where installment_group is not null
  and extract(day from date) >= 29;


-- =============================================================================
-- O QUE EU FAÇO COM ISSO
--
-- Os blocos 2 e 5 são os que mudam ESTÁGIO, que é a mudança mais visível.
-- O 3 e o 4 mudam NÚMEROS (renda de referência e meta de reserva).
-- O 7 e o 8 não mudam nada daqui para frente — mostram o estrago que já
-- aconteceu e que talvez valha corrigir à mão, se for pouca coisa.
-- =============================================================================
