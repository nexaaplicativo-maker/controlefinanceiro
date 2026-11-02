-- =============================================================================
-- Nexa (controlefinanceiro) — tornar o bucket `receipts` privado
-- 2026-10-03
--
-- ⚠️  A ORDEM DOS PASSOS É O QUE IMPORTA AQUI.
--     Virar o bucket privado antes dos passos 2 e 3 derruba os comprovantes.
--
-- POR QUE
--   Hoje o bucket é público: o link de um comprovante é permanente e abre sem
--   autenticação nenhuma. Documento financeiro com URL eterna vaza por
--   histórico de navegador, log de proxy e print compartilhado — e, uma vez
--   vazado, vale para sempre.
--
--   O código já está pronto para o bucket privado:
--     - upload grava em `<user_id>/<timestamp>.<ext>`  (TransactionModal.tsx:96)
--     - leitura usa createSignedUrl, 5 min de validade  (lib/receipts.ts:38)
--     - `getPublicUrl` não é mais chamado em lugar nenhum
--
--   Falta a parte do banco, que é este arquivo.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PASSO 1 — DIAGNÓSTICO (rode sozinho, antes de tudo)
-- -----------------------------------------------------------------------------

-- 1a. O bucket é público hoje?
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'receipts';

-- 1b. Já existe política no Storage? (o esperado num bucket público é nenhuma)
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;

-- 1c. Quantos registros ainda guardam URL pública inteira em vez do caminho?
--     São os que QUEBRAM quando o bucket virar privado.
select count(*) filter (where receipt_url like 'http%')  as url_antiga_quebra,
       count(*) filter (where receipt_url is not null
                          and receipt_url not like 'http%') as caminho_ok,
       count(*) filter (where receipt_url is not null)   as total_com_comprovante
from public.transactions;

-- 1d. Os arquivos estão todos namespaced por usuário?
--     A política do Passo 2 usa a primeira pasta do caminho como dono. Arquivo
--     solto na raiz do bucket fica inacessível depois — ninguém consegue assinar.
select case when (storage.foldername(name))[1] is null then '⚠️ solto na raiz'
            else '✅ em pasta de usuário' end as situacao,
       count(*)
from storage.objects
where bucket_id = 'receipts'
group by 1;


-- -----------------------------------------------------------------------------
-- PASSO 2 — POLÍTICAS DO STORAGE
--
-- Rode com o bucket AINDA PÚBLICO. Política sobrando em bucket público é
-- inofensiva: a leitura pública passa por fora delas. Assim, quando você virar
-- a chave no Passo 4, o acesso já está de pé e não há intervalo quebrado.
--
-- O dono é identificado pela primeira pasta do caminho, que é o user_id gravado
-- no upload: `<user_id>/<timestamp>.<ext>`.
--
-- SE DER "must be owner of table objects": seu projeto não permite mexer em
-- storage.objects pelo SQL Editor. Use Storage → Policies → New policy no
-- painel, criando as mesmas quatro regras pela interface.
-- -----------------------------------------------------------------------------

drop policy if exists "receipts_select_own" on storage.objects;
create policy "receipts_select_own" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_update_own" on storage.objects;
create policy "receipts_update_own" on storage.objects for update
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_delete_own" on storage.objects;
create policy "receipts_delete_own" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- -----------------------------------------------------------------------------
-- PASSO 3 — MIGRAR OS REGISTROS ANTIGOS  →  NÃO É MAIS NECESSÁRIO
--
-- Resolvido no código, em 2026-11-01. Não rode nada deste passo.
--
-- A versão original mandava reescrever `transactions.receipt_url`, trocando a
-- URL pública pelo caminho. Era o passo mais arriscado do arquivo: um regex
-- errado gravaria vazio e apagaria o vínculo com o arquivo, de forma
-- irreversível, para ganhar quase nada — havia 1 registro legado.
--
-- Agora `caminhoDoComprovante` (lib/receipts-caminho.ts) extrai o caminho da
-- própria URL no momento de abrir, e assina como qualquer outro. O banco pode
-- continuar guardando a URL inteira para sempre.
--
--   - os dois formatos funcionam, antes e depois do bucket virar privado
--   - nenhuma linha do banco é alterada, então não há o que desfazer
--   - coberto por 10 testes em lib/receipts.test.ts, incluindo query string,
--     fragmento, percent-encoding e URL de formato desconhecido
--
-- A consulta abaixo continua útil só como diagnóstico. Ela não altera nada.
-- -----------------------------------------------------------------------------

select count(*) filter (where receipt_url like 'http%')  as url_antiga,
       count(*) filter (where receipt_url is not null
                          and receipt_url not like 'http%') as caminho,
       count(*) filter (where receipt_url is not null)   as total
from public.transactions;


-- -----------------------------------------------------------------------------
-- PASSO 4 — VIRAR A CHAVE
--
-- Só depois de 2 e 3 concluídos. No painel:
--   Storage → receipts → ⋮ → Make private
--
-- Ou por SQL:
--   update storage.buckets set public = false where id = 'receipts';
--
-- A partir daqui, toda leitura passa pelas políticas do Passo 2.
-- -----------------------------------------------------------------------------


-- =============================================================================
-- PASSO 5 — TESTE, QUE É O QUE PROVA
--
-- Metadado não garante funcionamento. Com a sua conta, no app:
--
--   1. abra um lançamento ANTIGO que tenha comprovante → tem que exibir
--   2. crie um lançamento NOVO com comprovante → upload tem que passar
--   3. abra o comprovante novo → tem que exibir
--
--   4. copie o link assinado que abriu, espere 5 minutos e cole de novo:
--      tem que FALHAR. Se continuar abrindo, o bucket ainda está público.
--
-- O item 1 valida a leitura de registro legado (lib/receipts.ts). Se o antigo
-- não abrir, dá para voltar na hora: Storage → receipts → Make public,
-- enquanto investiga. Nenhum dado foi alterado, então não há rollback de SQL.
-- =============================================================================


-- =============================================================================
-- O QUE ISTO NÃO RESOLVE
--
-- Excluir a conta continua deixando os arquivos órfãos no bucket. SQL não
-- alcança o Storage, então `delete_user()` não tem como apagá-los — está
-- registrado em 2026-10-03-delete-user.sql e exige uma Edge Function com
-- service role.
--
-- Com o bucket privado o risco diminui bastante (sem sessão do dono, ninguém
-- assina a URL), mas o arquivo continua existindo, e a política de privacidade
-- promete exclusão completa. Continua pendente.
-- =============================================================================
